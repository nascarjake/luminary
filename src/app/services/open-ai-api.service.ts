import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, throwError } from 'rxjs';
import { OAAssistant } from '../../lib/entities/OAAssistant';
import { OAThread } from '../../lib/entities/OAThread';
import { OAThreadMessage } from '../../lib/entities/OAThreadMessage';
import { OAThreadRun } from '../../lib/entities/OAThreadRun';
import { OAResponseList } from '../../lib/objects/OAResponseList';
import { AvailableFunctions, OARequiredAction } from '../../lib/entities/OAFunctionCall';
import { Observable, Subject } from 'rxjs';

interface OAModel {
  id: string;
  created: number;
  object: string;
  owned_by: string;
}

@Injectable({
  providedIn: 'root'
})
export class OpenAiApiService {
  private apiUrl: string = environment.openai.apiUrl;
  private apiKey: string = '<unknown>';
  private apiKeySubject = new Subject<string>();
  public apiKey$ = this.apiKeySubject.asObservable();

  private readonly DEFAULT_PROCESS_FUNCTION = {
    type: 'function' as const,
    function: {
      name: 'processOutput',
      description: 'Process and forward the assistant\'s output to the next assistant in the pipeline',
      parameters: {
        type: 'object',
        properties: {
          output: {
            type: 'string',
            description: 'The output to process and forward'
          }
        },
        required: ['output']
      }
    }
  };

  constructor(private http: HttpClient) {}

  public getApiKey(): string {
    if (!this.apiKey || this.apiKey === '<unknown>') {
      console.warn('OpenAI API key not initialized');
      throw new Error('OpenAI API key not initialized');
    }
    return this.apiKey;
  }

  public setApiKey(apiKey: string): void {
    if (!apiKey) {
      console.warn('Cannot set empty API key');
      throw new Error('Cannot set empty API key');
    }
    console.log('Setting OpenAI API key:', apiKey);
    this.apiKey = apiKey;
    this.apiKeySubject.next(apiKey);
  }

  public validateApiKey(): Promise<boolean> {
    return this.listModels()
      .then(() => true)
      .catch(() => false);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.apiKey}`,
      'OpenAI-Beta': 'assistants=v2'  // Update to v2
    });
  }

  public getAssistant(id: string): Promise<OAAssistant> {
    return this.http.get<OAAssistant>(`${this.apiUrl}/assistants/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public getThread(id: string): Promise<OAThread> {
    return this.http.get<OAThread>(`${this.apiUrl}/threads/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public getThreadMessage(thread: OAThread, id: string): Promise<OAThreadMessage> {
    return this.http.get<OAThreadMessage>(`${this.apiUrl}/threads/${thread.id}/messages/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public listAssistants(): Promise<OAResponseList<OAAssistant>> {
    return this.http.get<OAResponseList<OAAssistant>>(`${this.apiUrl}/assistants`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public listThreads(): Promise<OAResponseList<OAThread>> {
    return this.http.get<OAResponseList<OAThread>>(`${this.apiUrl}/threads`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public listThreadMessages(thread: Partial<OAThread>): Promise<OAResponseList<OAThreadMessage>> {
    return this.http.get<OAResponseList<OAThreadMessage>>(`${this.apiUrl}/threads/${thread.id}/messages`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public createAssistant(assistant: Partial<OAAssistant>): Promise<OAAssistant> {
    console.log('Creating assistant with payload:', assistant);
    return this.http.post<OAAssistant>(`${this.apiUrl}/assistants`, assistant, { headers: this.getHeaders() })
      .pipe(
        catchError((error) => {
          console.error('Error creating assistant:', error);
          console.error('Error response:', error.error);
          return this.handleError(error);
        })
      )
      .toPromise();
  }

  public createThread(): Promise<OAThread> {
    return this.http.post<OAThread>(`${this.apiUrl}/threads`, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public createThreadMessage(thread: Partial<OAThread>, message: { content: string; role: 'user', file_ids?: string[] }): Promise<OAThreadMessage> {
    return this.http.post<OAThreadMessage>(`${this.apiUrl}/threads/${thread.id}/messages`, message, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public updateAssistant(id: string, assistant: Partial<OAAssistant>): Promise<OAAssistant> {
    console.log('Updating assistant with payload:', assistant);
    // Remove id from the request body since it's in the URL
    const { id: _, ...requestBody } = assistant;
    return this.http.post<OAAssistant>(`${this.apiUrl}/assistants/${id}`, requestBody, { headers: this.getHeaders() })
      .pipe(
        catchError((error) => {
          console.error('Error updating assistant:', error);
          console.error('Error response:', error.error);
          return this.handleError(error);
        })
      )
      .toPromise();
  }

  public deleteAssistant(id: string): Promise<void> {
    return this.http.delete<void>(`${this.apiUrl}/assistants/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public updateThread(thread: OAThread): Promise<OAThread> {
    return this.http.post<OAThread>(`${this.apiUrl}/threads/${thread.id}`, thread, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public updateThreadMessage(thread: OAThread, message: OAThreadMessage): Promise<OAThreadMessage> {
    return this.http.post<OAThreadMessage>(`${this.apiUrl}/threads/${thread.id}/messages/${message.id}`, message, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public deleteThread(thread: OAThread): Promise<void> {
    return this.http.delete<void>(`${this.apiUrl}/threads/${thread.id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public runStatus(run: OAThreadRun): Promise<OAThreadRun> {
    return this.http.get<OAThreadRun>(`${this.apiUrl}/threads/${run.thread_id}/runs/${run.id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public runThread(thread: Partial<OAThread>, assistant: Partial<OAAssistant>): Promise<OAThreadRun> {
    return this.http.post<OAThreadRun>(`${this.apiUrl}/threads/${thread.id}/runs`, { assistant_id: assistant.id }, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
  }

  public submitToolOutputs(run: OAThreadRun, toolOutputs: { tool_call_id: string, output: string }[]): Promise<OAThreadRun> {
    return this.http.post<OAThreadRun>(
      `${this.apiUrl}/threads/${run.thread_id}/runs/${run.id}/submit_tool_outputs`,
      { tool_outputs: toolOutputs },
      { headers: this.getHeaders() }
    )
    .pipe(catchError(this.handleError))
    .toPromise();
  }

  public cancelRun(threadId: string, runId: string): Promise<OAThreadRun> {
    return this.http.post<OAThreadRun>(
      `${this.apiUrl}/threads/${threadId}/runs/${runId}/cancel`,
      {},
      { headers: this.getHeaders() }
    )
    .pipe(catchError(this.handleError))
    .toPromise();
  }

  public async listModels(): Promise<OAModel[]> {
    const response = await this.http.get<OAResponseList<OAModel>>(`${this.apiUrl}/models`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
      .toPromise();
    
    // Filter for models that are compatible with the assistants API
    const compatibleModels = response.data.filter(model => 
      model.id.startsWith('gpt-4') || model.id.startsWith('gpt-3.5-turbo')
    );
    
    return compatibleModels;
  }

  public async createOrUpdateAssistant(assistant: Partial<OAAssistant>): Promise<OAAssistant> {
    if (assistant.id) {
      return this.updateAssistant(assistant.id, assistant);
    } else {
      return this.createAssistant(assistant);
    }
  }

  public async createMessage(threadId: string, content: string): Promise<OAThreadMessage> {
    return this.http.post<OAThreadMessage>(
      `${this.apiUrl}/threads/${threadId}/messages`,
      { role: 'user', content },
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError)).toPromise();
  }

  private handleError(error: HttpErrorResponse): Promise<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error from OpenAI
      if (error.error?.error) {
        errorMessage = error.error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Invalid API key';
      } else if (error.status === 404) {
        errorMessage = 'Assistant not found';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded';
      } else if (error.status >= 500) {
        errorMessage = 'OpenAI service error';
      }
    }

    console.error('OpenAI API Error:', {
      status: error.status,
      message: errorMessage,
      error: error.error
    });

    return Promise.reject({
      status: error.status,
      message: errorMessage,
      error: error.error
    });
  }
}