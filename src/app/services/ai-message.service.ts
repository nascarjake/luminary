import { Injectable } from '@angular/core';
import OpenAI from 'openai';
import { environment } from '../../environments/environment';
import { OpenAiApiService } from './open-ai-api.service';
import { AiFunctionService } from './ai-function.service';
import { OAThreadMessage } from '../../lib/entities/OAThreadMessage';
import { OAThread } from '../../lib/entities/OAThread';
import { OAThreadRun } from '../../lib/entities/OAThreadRun';
import { MessageService } from 'primeng/api';
import { AiCommunicationService } from './ai-communication.service';
import { Subject } from 'rxjs';

const timers = {};

@Injectable({
  providedIn: 'root'
})
export class AiMessageService {
  private openai: OpenAI | null = null;
  private outputCache: { [key: string]: string } = {};

  constructor(
    private readonly openAiApiService: OpenAiApiService,
    private readonly aiFunctionService: AiFunctionService,
    private readonly messageService: MessageService,
    private readonly aiCommunicationService: AiCommunicationService
  ) {
    // Subscribe to system messages
    this.aiCommunicationService.systemMessage$.subscribe(message => {
      this.emitSystemMessage(message);
    });

    // Subscribe to message routing
    this.aiCommunicationService.routeMessage$.subscribe(async params => {
      try {
        await this.generateAIResponse(params);
      } catch (error) {
        console.error('Error generating AI response:', error);
        this.emitSystemMessage(`Error generating AI response: ${error.message}`);
      }
    });

    // Subscribe to API key changes
    this.openAiApiService.apiKey$.subscribe(apiKey => {
      if (apiKey) {
        this.updateApiKey(apiKey);
      }
    });
  }

  // Event emitter for system messages
  private systemMessageSource = new Subject<string>();
  systemMessage$ = this.systemMessageSource.asObservable();

  private emitSystemMessage(message: string) {
    this.systemMessageSource.next(message);
  }

  private showToastAndSystemMessage(severity: string, summary: string, detail: string) {
    this.messageService.add({
      severity,
      summary,
      detail
    });
    this.emitSystemMessage(detail);
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = this.openAiApiService.getApiKey();
      console.log('Creating OpenAI client with API key:', apiKey);
      if (!apiKey || apiKey === '<unknown>') {
        throw new Error('OpenAI API key not initialized');
      }
      this.openai = new OpenAI({
        apiKey: apiKey,
        baseURL: environment.openai.apiUrl,
        defaultHeaders: {
          'OpenAI-Beta': 'assistants=v2'
        },
        dangerouslyAllowBrowser: true
      });
    }
    return this.openai;
  }

  // Re-initialize OpenAI client when API key changes
  public updateApiKey(apiKey: string) {
    this.openAiApiService.setApiKey(apiKey);
    this.openai = null; // Force re-initialization
  }

  private async sendOutput(output: { output: string }, threadId: string): Promise<{ returnMessage: string }> {
    console.log('official output', output);
    this.outputCache[threadId] = output.output;
    return { returnMessage: output.output };
  }

  private async handleRequiredAction(run: OAThreadRun): Promise<void> {
    if (run.required_action?.type !== 'submit_tool_outputs') {
      return;
    }

    const toolOutputs: { tool_call_id: string; output: string }[] = [];

    for (const toolCall of run.required_action.submit_tool_outputs.tool_calls) {
      if (toolCall.type !== 'function') continue;

      try {
        const args = JSON.parse(toolCall.function.arguments);
        const { output } = await this.aiFunctionService.executeFunction(
          toolCall.function.name,
          args,
          run.assistant_id
        );
        
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: output
        });
      } catch (error: any) {
        console.error('Error executing function:', error);
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: `Error: ${error.message}`
        });
      }
    }

    if (toolOutputs.length > 0) {
      await this.getOpenAI().beta.threads.runs.submitToolOutputs(
        run.thread_id,
        run.id,
        { tool_outputs: toolOutputs }
      );
    }
  }

  /**
   * Generates an AI response for a given message.
   * If a threadId is provided, it adds the message to the existing thread.
   * If no threadId is provided, it creates a new thread with the message.
   */
  async generateAIResponse({ 
    message, 
    initMessage, 
    assistantId, 
    threadId = '' 
  }: {
    message: string;
    initMessage?: string;
    assistantId: string;
    threadId?: string;
  }): Promise<OAThreadMessage> {
    try {
      if (!threadId) {
        return this.generateThread({ message, initMessage }, assistantId);
      }

      const request: any = {
        assistant_id: assistantId,
        stream: true,
        additional_messages: [
          { role: "user", content: message },
        ],
      }

      const stream = await this.getOpenAI().beta.threads.runs.create(
        threadId,
        request
      );

      return this.handleResponse(stream);
    } catch (error) {
      // Extract error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown OpenAI API error';
      
      // Emit system message with the error
      this.emitSystemMessage(`❌ OpenAI API Error: ${errorMessage}`);
      
      // Re-throw the error
      throw error;
    }
  }

  /**
   * Creates a new thread with a given message and generates an AI response.
   */
  private async generateThread({ 
    message, 
    initMessage 
  }: {
    message: string;
    initMessage?: string;
  }, assistantId: string): Promise<OAThreadMessage> {
    const messages = [{ role: "user", content: message }];
    if (initMessage) {
      messages.unshift({ role: "user", content: initMessage });
    }

    const request: any = {
      assistant_id: assistantId,
      thread: {
        messages,
      },
      stream: true
    };
    console.log('ai request', JSON.stringify(request));
    const stream = await this.getOpenAI().beta.threads.createAndRun(request);

    return this.handleResponse(stream);
  }

  /**
   * Handles the response from the AI.
   * Waits for the 'thread.message.completed' event and then returns the data.
   */
  private async handleResponse(stream: any): Promise<OAThreadMessage> {
    let run_id = '';
    let thread_id = '';
    let tool_outputs = [];
    let output: OAThreadMessage | null = null;

    try {
      for await (const event of stream) {
        if(!event.event.includes('delta'))
          console.log('event', event.event);
        
        // Keep track of IDs for cleanup
        if (event.data?.id) run_id = event.data.id;
        if (event.data?.thread_id) thread_id = event.data.thread_id;
        
        if (event.event === 'thread.message.completed') {
          output = event.data as OAThreadMessage;
          if (this.outputCache[event.data.thread_id]) {
            const cachedData = JSON.parse(this.outputCache[event.data.thread_id]);
            output = {
              ...output,
              content: [{
                type: 'text',
                text: {
                  value: cachedData.returnMessage || '',
                  annotations: []
                }
              }]
            };
            delete this.outputCache[event.data.thread_id];
          }
        } else if (event.event === 'thread.run.requires_action') {
          if (event.data.status === 'requires_action') {
            await this.handleRequiredAction(event.data);
          }
        } else if (event.event === 'thread.run.failed') {
          const errorMessage = event.data.last_error?.message || 'Unknown error occurred';
          await this.cleanupFailedRun(thread_id, run_id, errorMessage);
          throw new Error(errorMessage);
        } else if (event.event === 'thread.run.cancelled') {
          await this.cleanupFailedRun(thread_id, run_id, 'Operation cancelled');
          throw new Error('Thread run cancelled');
        } else if (event.event === 'thread.run.expired') {
          await this.cleanupFailedRun(thread_id, run_id, 'Operation timed out');
          throw new Error('Thread run expired');
        } else if (event.event === 'thread.run.in_progress') {
          clearTimeout(timers[thread_id]);
          this.emitSystemMessage('Generating...');
        } else if (event.event === 'thread.run.queued') {
          timers[thread_id] = setTimeout(() => {
            this.showToastAndSystemMessage('info', 'Processing', 'Your request is queued and will be processed shortly.');
          }, 5000)
        }
      }
      return output as OAThreadMessage;
    } catch (error) {
      // Ensure cleanup happens for any uncaught errors
      if (thread_id && run_id) {
        await this.cleanupFailedRun(thread_id, run_id, error instanceof Error ? error.message : 'Unknown error');
      }
      throw error;
    }
  }

  /**
   * Cleans up a failed run by cancelling it and showing an error message
   */
  public async cleanupFailedRun(threadId: string, runId: string, errorMessage: string): Promise<void> {
    try {
      // Try to cancel the run
      await this.openAiApiService.cancelRun(threadId, runId);
      
      // Show error message
      this.showToastAndSystemMessage('error', 'Assistant Error', `❌ Error: ${errorMessage}`);
    } catch (cleanupError) {
      // If cleanup fails, log it but don't throw - we want to show the original error
      console.error('Failed to cleanup run:', cleanupError);
      this.emitSystemMessage(`❌ Error: Failed to cleanup run - ${cleanupError}`);
    }
  }

  /**
   * Gets all the messages from a given thread.
   */
  async getThreadMessages(threadId: string): Promise<any> {
    const response = await this.getOpenAI().beta.threads.messages.list(threadId);
    return response.data;
  }

  /**
   * Gets the current run for a thread, if any.
   */
  public async getCurrentRun(threadId: string): Promise<any | null> {
    try {
      const runs = await this.getOpenAI().beta.threads.runs.list(threadId);
      const currentRun = runs.data.find(run => 
        run.status === 'in_progress' || 
        run.status === 'queued' || 
        run.status === 'requires_action'
      );
      return currentRun || null;
    } catch (error) {
      console.error('Failed to get current run:', error);
      return null;
    }
  }
}
