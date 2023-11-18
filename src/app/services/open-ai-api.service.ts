import { Injectable } from '@angular/core';
import { Body, Client, HttpOptions, getClient } from "@tauri-apps/api/http"
import { environment } from '../../environments/environement';

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

}
