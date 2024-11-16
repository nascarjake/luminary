import { Injectable } from '@angular/core';
import OpenAI from 'openai';
import { environment } from '../../environments/environment';
import { OpenAiApiService } from './open-ai-api.service';
import { AiFunctionService } from './ai-function.service';
import { OAThreadMessage } from '../../lib/entities/OAThreadMessage';
import { OAThread } from '../../lib/entities/OAThread';
import { OAThreadRun } from '../../lib/entities/OAThreadRun';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiMessageService {
  private openai: OpenAI;
  private outputCache: { [key: string]: string } = {};

  constructor(
    private readonly openAiApiService: OpenAiApiService,
    private readonly aiFunctionService: AiFunctionService,
    private readonly messageService: MessageService
  ) {
    this.initializeOpenAI();
    // Subscribe to system messages from AiFunctionService
    this.aiFunctionService.systemMessage$.subscribe(message => {
      this.systemMessageSource.next(message);
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

  private initializeOpenAI() {
    this.openai = new OpenAI({
      apiKey: this.openAiApiService.getApiKey(),
      baseURL: environment.openai.apiUrl,
      defaultHeaders: {
        'OpenAI-Beta': 'assistants=v2'
      },
      dangerouslyAllowBrowser: true
    });
  }

  // Re-initialize OpenAI client when API key changes
  public updateApiKey(apiKey: string) {
    this.openAiApiService.setApiKey(apiKey);
    this.initializeOpenAI();
  }

  private async sendOutput(output: { output: string }, threadId: string): Promise<{ returnMessage: string }> {
    console.log('official output', output);
    this.outputCache[threadId] = output.output;
    return { returnMessage: output.output };
  }

  private externalFunctions = {
    sendOutlines: async (args: any, threadId: string) => {
      return this.aiFunctionService.sendOutlines(args.output);
    },
    sendScript: async (args: any, threadId: string) => {
      return this.aiFunctionService.sendScript(args.output, threadId, args.title);
    },
    sendToPictory: async (args: any, threadId: string) => {
      return this.aiFunctionService.sendToPictory(args.output, threadId, args.title);
    }
  };

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

    const stream = await this.openai.beta.threads.runs.create(
      threadId,
      request
    );

    return this.handleResponse(stream);
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
    const stream = await this.openai.beta.threads.createAndRun(request);

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
            if (event.data.required_action?.type === 'submit_tool_outputs') {
              run_id = event.data.id;
              thread_id = event.data.thread_id;
              const tools_called = event.data.required_action.submit_tool_outputs.tool_calls;

              try {
                for (let tool of tools_called) {
                  console.log('tool called', tool);
                  const tool_name = tool.function.name;
                  const tool_args = JSON.parse(tool.function.arguments);

                  const tool_output = await this.externalFunctions[tool_name](tool_args, event.data.thread_id);
                  console.log('ran ' + tool_name, this.externalFunctions[tool_name]);
                  console.log('output ', tool_output);
                  
                  tool_outputs.push({
                    tool_call_id: tool.id,
                    output: JSON.stringify(tool_output)
                  });
                }

                console.log('sending output', tool_outputs);
                stream = this.openai.beta.threads.runs.submitToolOutputsStream(
                  event.data.thread_id,
                  run_id,
                  {
                    tool_outputs
                  }
                );
                return this.handleResponse(stream);
              } catch (error) {
                // Clean up the run if tool execution fails
                await this.cleanupFailedRun(thread_id, run_id, 'Tool execution failed');
                throw error;
              }
            }
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
        } else if (event.event === 'thread.run.queued') {
          this.showToastAndSystemMessage('info', 'Processing', 'Your request is queued and will be processed shortly.');
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
    const response = await this.openai.beta.threads.messages.list(threadId);
    return response.data;
  }

  /**
   * Gets the current run for a thread, if any.
   */
  public async getCurrentRun(threadId: string): Promise<any | null> {
    try {
      const runs = await this.openai.beta.threads.runs.list(threadId);
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
