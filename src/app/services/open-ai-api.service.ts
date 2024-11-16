import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, throwError } from 'rxjs';
import { OAAsistant } from '../../lib/entities/OAAssistant';
import { OAThread } from '../../lib/entities/OAThread';
import { OAThreadMessage } from '../../lib/entities/OAThreadMessage';
import { OAThreadRun } from '../../lib/entities/OAThreadRun';
import { OAResponseList } from '../../lib/objects/OAResponseList';
import { AvailableFunctions, OARequiredAction } from '../../lib/entities/OAFunctionCall';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OpenAiApiService {
  private apiUrl: string = environment.openai.apiUrl;
  private apiKey: string = '<unknown>';

  constructor(private http: HttpClient) {}

  public getApiKey(): string {
    return this.apiKey;
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  public validateApiKey(): Promise<boolean> {
    return this.http.get(`${this.apiUrl}/models`, { headers: this.getHeaders() })
      .pipe(
        catchError(() => {
          return throwError(() => new Error('Invalid API key'));
        })
      )
      .toPromise()
      .then(() => true)
      .catch(() => false);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.apiKey}`,
      'OpenAI-Beta': 'assistants=v2'  // Update to v2
    });
  }

  public getAssistant(id: string): Promise<OAAsistant> {
    return this.http.get<OAAsistant>(`${this.apiUrl}/assistants/${id}`, { headers: this.getHeaders() })
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

  public listAssistants(): Promise<OAResponseList<OAAsistant>> {
    return this.http.get<OAResponseList<OAAsistant>>(`${this.apiUrl}/assistants`, { headers: this.getHeaders() })
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

  public createAssistant(assistant: Partial<OAAsistant>): Promise<OAAsistant> {
    return this.http.post<OAAsistant>(`${this.apiUrl}/assistants`, assistant, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError))
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

  public updateAssistant(assistant: OAAsistant): Promise<OAAsistant> {
    return this.http.post<OAAsistant>(`${this.apiUrl}/assistants/${assistant.id}`, assistant, { headers: this.getHeaders() })
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

  public deleteAssistant(assistant: OAAsistant): Promise<void> {
    return this.http.delete<void>(`${this.apiUrl}/assistants/${assistant.id}`, { headers: this.getHeaders() })
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

  public runThread(thread: Partial<OAThread>, assistant: Partial<OAAsistant>): Promise<OAThreadRun> {
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

  private handleError(error: HttpErrorResponse): Promise<never> {
    const errorMsg = error.error instanceof ErrorEvent ? error.error.message : `Server returned code ${error.status}`;
    return Promise.reject(new Error(errorMsg));
  }
}