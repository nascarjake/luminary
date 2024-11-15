import { Injectable } from '@angular/core';
import OpenAI from 'openai';
import { environment } from '../../environments/environment';
import { OpenAiApiService } from './open-ai-api.service';
import { OAThreadMessage } from '../../lib/entities/OAThreadMessage';
import { OAThread } from '../../lib/entities/OAThread';
import { OAThreadRun } from '../../lib/entities/OAThreadRun';

@Injectable({
  providedIn: 'root'
})
export class AiMessageService {
  private openai: OpenAI;
  private outputCache: { [key: string]: string } = {};

  constructor(private openAiApiService: OpenAiApiService) {
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    this.openai = new OpenAI({
      apiKey: this.openAiApiService.getApiKey(),
      baseURL: environment.openai.apiUrl,
      defaultHeaders: {
        'OpenAI-Beta': 'assistants=v2'
      }
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
    send_output: this.sendOutput.bind(this)
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

    const stream = await this.openai.beta.threads.runs.create(
      threadId,
      {
        assistant_id: assistantId,
        stream: true,
        additional_messages: [
          { role: "user", content: message },
        ],
      }
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

    const request = {
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
    let tool_outputs = [];
    let output: OAThreadMessage | null = null;

    for await (const event of stream) {
      console.log('event', event.event);
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
            const tools_called = event.data.required_action.submit_tool_outputs.tool_calls;

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
          }
        }
      }
    }
    return output as OAThreadMessage;
  }

  /**
   * Gets all the messages from a given thread.
   */
  async getThreadMessages(threadId: string): Promise<OAThreadMessage[]> {
    const response = await this.openai.beta.threads.messages.list(threadId);
    return response.data as OAThreadMessage[];
  }
}
