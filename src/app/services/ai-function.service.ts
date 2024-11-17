import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { AvailableFunctions } from '../../lib/entities/OAFunctionCall';
import { OpenAiApiService } from './open-ai-api.service';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';
import { GeneratedObjectsService, ScriptOutline } from './generated-objects.service';

interface ProjectCounters {
  scripts: number;
  videos: number;
}

interface PictoryAuth {
  access_token: string;
  expires_in: number;
  token_type: string;
  expiration_time?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AiFunctionService {
  // TODO: Move these to environment config
  private readonly SCRIPT_ASSISTANT_ID = 'asst_c79BRUGFLalWEhogodtMf53y';
  private readonly PICTORY_ASSISTANT_ID = 'asst_s0Hhqom7vmDUbdFRdTMNZlt1';
  private readonly PICTORY_API_URL = 'https://api.pictory.ai/pictoryapis/v1/video/storyboard';
  private readonly PICTORY_AUTH_URL = 'https://api.pictory.ai/pictoryapis/v1/oauth2/token';
  private readonly PICTORY_CLIENT_ID = 'oqqfosh7c8m9ql5r6627j8j8d';
  private readonly PICTORY_CLIENT_SECRET = 'AQICAHhZHg7OR+8D6W0rh82dGpyRZ7ID33czntuqbdVLgOrR3AFOPm9QYl5gWVvoDg485dbhAAAAlDCBkQYJKoZIhvcNAQcGoIGDMIGAAgEAMHsGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMehxJpkpYjlFpPdlfAgEQgE7AVAL1qSm3LVtz6F9riYuoKItZ39An2WAkdbaNgra1LWT/mLPEmIiZ81lfkQbrllfI0WcV24I2jXfERmno4inWpt6FF8Ivaj/LaS4CYqU=';
  private readonly PICTORY_USER_ID = 'Eric';

  // Pictory auth token cache
  private pictoryAuthToken: PictoryAuth | null = null;

  // Project-level counters
  private projectCounters: Map<string, ProjectCounters> = new Map();

  // Event emitter for system messages
  private systemMessageSource = new Subject<string>();
  systemMessage$ = this.systemMessageSource.asObservable();

  private emitSystemMessage(message: string) {
    this.systemMessageSource.next(message);
  }

  constructor(
    private messageService: MessageService,
    private openAiApiService: OpenAiApiService,
    private http: HttpClient,
    private generatedObjects: GeneratedObjectsService
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
   * @returns A promise that resolves with {success: true}
   */
  async sendOutlines(outlineJson: string): Promise<{ success: true }> {
    console.log('🚀 sendOutline started with:', { outlineJson });
    try {
      // Parse and validate JSON
      let outlines: ScriptOutline[];
      try {
        const parsed = JSON.parse(outlineJson);
        // Check if the input is an object with a videos array
        if (parsed.videos && Array.isArray(parsed.videos)) {
          outlines = parsed.videos;
        } else if (Array.isArray(parsed)) {
          outlines = parsed;
        } else {
          outlines = [parsed];
        }
        console.log('📝 Parsed outlines:', outlines);
      } catch (error) {
        console.error('❌ JSON parsing failed:', error, outlineJson);
        throw new Error('Invalid JSON format for outline');
      }

      // Process each outline
      console.log(`🔄 Processing ${outlines.length} outline(s)`);
      this.emitSystemMessage(`Processing ${outlines.length} outline${outlines.length !== 1 ? 's' : ''}...`);
      
      const results = await Promise.all(
        outlines.map(async (outline, index) => {
          console.log(`\n--- Processing outline ${index + 1}/${outlines.length} ---`);
          const outlineTitle = outline.title || `Outline ${index + 1}`;
          this.emitSystemMessage(`Processing ${outlineTitle} (${index + 1}/${outlines.length})`);
          
          try {
            // Create a new thread for each outline
            console.log('📨 Creating new thread');
            const thread = await this.openAiApiService.createThread();
            console.log('✅ Thread created:', thread.id);
            
            // Send the outline as a message
            console.log('📤 Sending outline as message to thread:', thread.id);
            await this.openAiApiService.createThreadMessage(thread, {
              content: JSON.stringify(outline),
              role: 'user'
            });
            console.log('✅ Message sent to thread:', thread.id);

            // Start the assistant
            console.log(`🤖 Starting assistant for outline ${index + 1}/${outlines.length} on thread:`, thread.id);
            const run = await this.openAiApiService.runThread(thread, { id: this.SCRIPT_ASSISTANT_ID });
            console.log('✅ Assistant started, run ID:', run.id, 'for thread:', thread.id);
            
            // Add outline to generated objects
            this.generatedObjects.addOutline(outline);
            
            this.messageService.add({
              severity: 'success',
              summary: 'Outline Processing',
              detail: `Processed ${outlineTitle} (${index + 1}/${outlines.length})`
            });

            return { success: true as const };
          } catch (error) {
            console.error(`❌ Error processing outline ${index + 1}/${outlines.length}:`, error);
            throw error;
          }
        })
      );

      console.log('✅ All outlines processed successfully');
      this.emitSystemMessage(`✅ Completed processing all ${outlines.length} outline${outlines.length !== 1 ? 's' : ''}`);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Final error in sendOutline:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to process outline: ${errorMessage}`
      });
      this.emitSystemMessage(`❌ Error: Failed to process outline: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Forwards a movie script to an AI assistant for processing
   * @param script The movie script content
   * @param threadId The thread ID for tracking project counters
   * @param title Optional title of the script
   * @returns A promise that resolves with {success: true}
   */
  async sendScript(script: string, threadId: string, title?: string): Promise<{ success: true }> {
    console.log('🚀 sendScript started:', { threadId, title });
    try {
      // Increment script counter for this project
      const counters = this.getProjectCounters(threadId);
      counters.scripts++;
      console.log('📊 Script counter incremented:', counters.scripts);

      // Create a new thread
      console.log('📨 Creating new thread');
      const thread = await this.openAiApiService.createThread();
      console.log('✅ Thread created:', thread.id);
      
      // Send the script as a message
      console.log('📤 Sending script as message');
      await this.openAiApiService.createThreadMessage(thread, {
        content: script,
        role: 'user'
      });
      console.log('✅ Message sent');

      // Start the assistant
      console.log('🤖 Starting assistant');
      const run = await this.openAiApiService.runThread(thread, { id: this.PICTORY_ASSISTANT_ID });
      console.log('✅ Assistant started, run ID:', run.id);

      // Add script to generated objects
      this.generatedObjects.addScript({
        content: script,
        title,
        threadId: thread.id
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Script Processing',
        detail: `Processed Script #${counters.scripts}${title ? ` - ${title}` : ''}`
      });

      console.log('✅ Script processing completed successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error in sendScript:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to process script: ${errorMessage}`
      });
      this.emitSystemMessage(`❌ Error: Failed to process script: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Sends content to Pictory API for processing
   * @param contentJson JSON string containing the content to send to Pictory
   * @param threadId The thread ID for tracking project counters
   * @param title Optional title of the video
   * @returns A promise that resolves with {success: true}
   */
  async sendToPictory(contentJson: string, threadId: string, title?: string): Promise<{ success: true }> {
    console.log('🚀 sendToPictory started:', { threadId, title });
    try {
      // Increment video counter for this project
      const counters = this.getProjectCounters(threadId);
      counters.videos++;
      console.log('📊 Video counter incremented:', counters.videos);

      // Parse and validate JSON
      let content: any;
      try {
        content = JSON.parse(contentJson);
        console.log('📝 Parsed content:', content);
      } catch (error) {
        console.error('❌ JSON parsing failed:', error);
        throw new Error('Invalid JSON format for Pictory content');
      }

      // Get Pictory auth token
      const authToken = await this.getPictoryAuthToken();

      // Set up headers for Pictory API
      console.log('🔧 Setting up Pictory API headers');
      const headers = new HttpHeaders({
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Pictory-User-Id': this.PICTORY_USER_ID
      });

      if(content.webhook) delete content.webhook;
      if(content.brandLogo) content.brandLogo.url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Test-Logo.svg/2560px-Test-Logo.svg.png';

      // Send request to Pictory API
      console.log('📤 Sending request to Pictory API', content);
      await this.http.post(this.PICTORY_API_URL, content, { headers }).toPromise();
      console.log('✅ Pictory API request successful');

      // Add Pictory request to generated objects
      this.generatedObjects.addPictoryRequest({
        content,
        title,
        threadId
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Video Generation',
        detail: `Generating Video #${counters.videos}${title ? ` - ${title}` : ''}`
      });

      console.log('✅ Pictory processing completed successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error in sendToPictory:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to send to Pictory: ${errorMessage}`
      });
      this.emitSystemMessage(`❌ Error: Failed to send to Pictory: ${errorMessage}`);
      throw error;
    }
  }

  // Get Pictory auth token, using cache if available
  private async getPictoryAuthToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.pictoryAuthToken && this.pictoryAuthToken.expiration_time 
        && Date.now() < this.pictoryAuthToken.expiration_time) {
      return this.pictoryAuthToken.access_token;
    }

    // Get new token
    try {
      const response = await this.http.post<PictoryAuth>(
        this.PICTORY_AUTH_URL,
        {
          client_id: this.PICTORY_CLIENT_ID,
          client_secret: this.PICTORY_CLIENT_SECRET
        }
      ).toPromise();

      if (!response) {
        throw new Error('Failed to get Pictory auth token');
      }

      // Cache the token with expiration time
      this.pictoryAuthToken = {
        ...response,
        expiration_time: Date.now() + (response.expires_in * 1000) // Convert seconds to milliseconds
      };

      return this.pictoryAuthToken.access_token;
    } catch (error) {
      console.error('Error getting Pictory auth token:', error);
      throw new Error('Failed to authenticate with Pictory');
    }
  }
}
