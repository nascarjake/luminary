import { Injectable } from '@angular/core';
import { Body, Client, HttpOptions, getClient } from "@tauri-apps/api/http";
import { environment } from '../../environments/environment';
import { OAAsistant } from '../../lib/entities/OAAssistant';
import { OAThread } from '../../lib/entities/OAThread';
import { OAThreadMessage } from '../../lib/entities/OAThreadMessage';
import { OAResponseList } from '../../lib/objects/OAResponseList';
import { HttpError } from '../../lib/classes/HttpError';

@Injectable({
  providedIn: 'root'
})
export class OpenAiApiService {

  private apiUrl: string = environment.openai.apiUrl;
  private apiKey: string = '<unknown>'
  private client?: Client;

  constructor() {
    getClient().then(client => this.client = client);
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  public async validateApiKey(): Promise<boolean> {
    try {
      const { ok } = await this.client!.get(`${this.apiUrl}/models`, { headers: this.getHeaders() });
      return ok;
    } catch {
      return false;
    }
  }

  private getHeaders(): HttpOptions['headers'] {
    return {
      Authorization: `Bearer ${this.apiKey}`
    };
  }

  public async listAssistants(): Promise<OAResponseList<OAAsistant>> {
    const { data, ok, status } = await this.client!.get<OAResponseList<OAAsistant>>(`${this.apiUrl}/assistants`, { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to get assistants', status);
    return data;
  }

  public async listThreads(): Promise<OAResponseList<OAThread>> {
    const { data, ok, status } = await this.client!.get<OAResponseList<OAThread>>(`${this.apiUrl}/threads`, { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to get threads', status);
    return data;
  }

  public async listThreadMessages(thread: OAThread): Promise<OAResponseList<OAThreadMessage>> {
    const { data, ok, status } = await this.client!.get<OAResponseList<OAThreadMessage>>(`${this.apiUrl}/threads/${thread.id}/messages`, { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to get thread messages', status);
    return data;
  }

  public async createAssistant(assistant: Partial<OAAsistant>): Promise<OAAsistant> {
    const { data, ok, status } = await this.client!.post<OAAsistant>(`${this.apiUrl}/assistants`, Body.json(assistant), { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to create assistant', status);
    return data;
  }

  public async createThread(thread: Partial<OAThread>): Promise<OAThread> {
    const { data, ok, status } = await this.client!.post<OAThread>(`${this.apiUrl}/threads`, Body.json(thread), { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to create thread', status);
    return data;
  }

  public async createThreadMessage(thread: OAThread, message: Partial<OAThreadMessage>): Promise<OAThreadMessage> {
    const { data, ok, status } = await this.client!.post<OAThreadMessage>(`${this.apiUrl}/threads/${thread.id}/messages`, Body.json(message), { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to create thread message', status);
    return data;
  }

  public async updateAssistant(assistant: OAAsistant): Promise<OAAsistant> {
    const { data, ok, status } = await this.client!.post<OAAsistant>(`${this.apiUrl}/assistants/${assistant.id}`, Body.json(assistant), { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to update assistant', status);
    return data;
  }

  public async updateThread(thread: OAThread): Promise<OAThread> {
    const { data, ok, status } = await this.client!.post<OAThread>(`${this.apiUrl}/threads/${thread.id}`, Body.json(thread), { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to update thread', status);
    return data;
  }

  public async updateThreadMessage(thread: OAThread, message: OAThreadMessage): Promise<OAThreadMessage> {
    const { data, ok, status } = await this.client!.post<OAThreadMessage>(`${this.apiUrl}/threads/${thread.id}/messages/${message.id}`, Body.json(message), { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to update thread message', status);
    return data;
  }

  public async deleteAssistant(assistant: OAAsistant): Promise<void> {
    const { ok, status } = await this.client!.delete(`${this.apiUrl}/assistants/${assistant.id}`, { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to delete assistant', status);
  }

  public async deleteThread(thread: OAThread): Promise<void> {
    const { ok, status } = await this.client!.delete(`${this.apiUrl}/threads/${thread.id}`, { headers: this.getHeaders() });
    if (!ok) throw new HttpError('Failed to delete thread', status);
  }

}
