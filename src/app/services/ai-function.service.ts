import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { AvailableFunctions } from '../../lib/entities/OAFunctionCall';
import { OpenAiApiService } from './open-ai-api.service';
import { environment } from '../../environments/environment';

interface ScriptOutline {
  // TODO: Define the structure of your outline object
  [key: string]: any;
  title?: string;
}

interface ProjectCounters {
  scripts: number;
  videos: number;
}

@Injectable({
  providedIn: 'root'
})
export class AiFunctionService implements AvailableFunctions {
  // TODO: Move these to environment config
  private readonly SCRIPT_ASSISTANT_ID = 'asst_c79BRUGFLalWEhogodtMf53y';
  private readonly PICTORY_ASSISTANT_ID = 'asst_s0Hhqom7vmDUbdFRdTMNZlt1';
  private readonly PICTORY_API_URL = 'https://api.pictory.ai/pictoryapis/v1/video/storyboard';
  private readonly PICTORY_AUTH_TOKEN = 'your_pictory_auth_token';
  private readonly PICTORY_USER_ID = 'your_pictory_user_id';

  // Project-level counters
  private projectCounters: Map<string, ProjectCounters> = new Map();

  constructor(
    private messageService: MessageService,
    private openAiApiService: OpenAiApiService,
    private http: HttpClient
  ) {}

  /**
   * Gets or creates project counters for a given thread
   */
  private getProjectCounters(threadId: string): ProjectCounters {
    if (!this.projectCounters.has(threadId)) {
      this.projectCounters.set(threadId, { scripts: 0, videos: 0 });
    }
    return this.projectCounters.get(threadId)!;
  }

  /**
   * Processes a JSON string containing script outlines and sends each to an AI assistant
   * @param outlineJson JSON string containing an array or single object of script outlines
   * @returns A promise that resolves with a success message
   */
  async sendOutline(outlineJson: string): Promise<string> {
    try {
      // Parse and validate JSON
      let outlines: ScriptOutline[];
      try {
        const parsed = JSON.parse(outlineJson);
        outlines = Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        throw new Error('Invalid JSON format for outline');
      }

      // Process each outline
      const results = await Promise.all(
        outlines.map(async (outline) => {
          try {
            // Create a new thread for each outline
            const thread = await this.openAiApiService.createThread();
            
            // Send the outline as a message
            await this.openAiApiService.createThreadMessage(thread, {
              content: JSON.stringify(outline),
              role: 'user'
            });

            // Start the assistant
            const run = await this.openAiApiService.runThread(thread, { id: this.SCRIPT_ASSISTANT_ID });
            
            return {
              threadId: thread.id,
              runId: run.id,
              outline
            };
          } catch (error) {
            console.error('Error processing outline:', error);
            return {
              error: error instanceof Error ? error.message : 'Unknown error',
              outline
            };
          }
        })
      );

      const successful = results.filter(r => !('error' in r));
      const failed = results.filter(r => 'error' in r);

      // Notify user of results
      this.messageService.add({
        severity: successful.length > 0 ? 'success' : 'warn',
        summary: 'Outline Processing',
        detail: `Processed ${outlines.length} outline${outlines.length !== 1 ? 's' : ''}`
      });

      return JSON.stringify({ successful, failed });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to process outline: ${errorMessage}`
      });
      throw error;
    }
  }

  /**
   * Forwards a movie script to an AI assistant for processing
   * @param script The movie script content
   * @param threadId The thread ID for tracking project counters
   * @param title Optional title of the script
   * @returns A promise that resolves with a success message
   */
  async sendScript(script: string, threadId: string, title?: string): Promise<string> {
    try {
      // Increment script counter for this project
      const counters = this.getProjectCounters(threadId);
      counters.scripts++;

      // Create a new thread
      const thread = await this.openAiApiService.createThread();
      
      // Send the script as a message
      await this.openAiApiService.createThreadMessage(thread, {
        content: script,
        role: 'user'
      });

      // Start the assistant
      const run = await this.openAiApiService.runThread(thread, { id: this.PICTORY_ASSISTANT_ID });

      this.messageService.add({
        severity: 'success',
        summary: 'Script Processing',
        detail: `Processed Script #${counters.scripts}${title ? ` - ${title}` : ''}`
      });

      return JSON.stringify({
        threadId: thread.id,
        runId: run.id,
        scriptNumber: counters.scripts
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to process script: ${errorMessage}`
      });
      throw error;
    }
  }

  /**
   * Sends content to Pictory API for processing
   * @param contentJson JSON string containing the content to send to Pictory
   * @param threadId The thread ID for tracking project counters
   * @param title Optional title of the video
   * @returns A promise that resolves with the Pictory API response
   */
  async sendToPictory(contentJson: string, threadId: string, title?: string): Promise<string> {
    try {
      // Increment video counter for this project
      const counters = this.getProjectCounters(threadId);
      counters.videos++;

      // Parse and validate JSON
      let content: any;
      try {
        content = JSON.parse(contentJson);
      } catch (error) {
        throw new Error('Invalid JSON format for Pictory content');
      }

      // Set up headers for Pictory API
      const headers = new HttpHeaders({
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': this.PICTORY_AUTH_TOKEN,
        'X-Pictory-User-Id': this.PICTORY_USER_ID
      });

      // Send request to Pictory API
      const response = await this.http.post(this.PICTORY_API_URL, content, { headers }).toPromise();

      this.messageService.add({
        severity: 'success',
        summary: 'Video Generation',
        detail: `Generating Video #${counters.videos}${title ? ` - ${title}` : ''}`
      });

      return JSON.stringify({
        response,
        videoNumber: counters.videos
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to send to Pictory: ${errorMessage}`
      });
      throw error;
    }
  }
}
