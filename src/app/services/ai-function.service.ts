import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { AvailableFunctions } from '../../lib/entities/OAFunctionCall';
import { OpenAiApiService } from './open-ai-api.service';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { GeneratedObjectsService, ScriptOutline } from './generated-objects.service';
import { AiCommunicationService } from './ai-communication.service';
import { PictoryUtils, PictoryJobResponse, PictoryJobStatus } from '../utils/pictory.utils';
import type { Electron } from 'electron-api';

declare global {
  interface Window {
    electron: Electron;
  }
}

interface ProjectCounters {
  scripts: number;
  videos: number;
}

@Injectable({
  providedIn: 'root'
})
export class AiFunctionService {
  private readonly SCRIPT_ASSISTANT_ID = 'asst_c79BRUGFLalWEhogodtMf53y';
  private readonly PICTORY_ASSISTANT_ID = 'asst_s0Hhqom7vmDUbdFRdTMNZlt1';
  private readonly BATCH_SIZE = 3;
  private readonly BATCH_DELAY = 60000;
  private readonly projectCounters = new Map<string, ProjectCounters>();
  private systemMessageSource = new Subject<string>();
  systemMessage$ = this.systemMessageSource.asObservable();
  private pictoryUtils: PictoryUtils;

  constructor(
    private messageService: MessageService,
    private openAiApiService: OpenAiApiService,
    private http: HttpClient,
    private generatedObjects: GeneratedObjectsService,
    private aiCommunicationService: AiCommunicationService
  ) {
    this.pictoryUtils = new PictoryUtils(http);
  }

  private emitSystemMessage(message: string) {
    this.systemMessageSource.next(message);
    this.aiCommunicationService.emitSystemMessage(message);
  }

  /**
   * Gets or creates project counters for a given thread
   */
  private getProjectCounters(threadId: string): ProjectCounters {
    if (!this.projectCounters.has(threadId)) {
      this.projectCounters.set(threadId, { scripts: 0, videos: 0 });
    }
    return this.projectCounters.get(threadId)!;
  }

  private async processBatch<T>(
    items: T[],
    processItem: (item: T, index: number) => Promise<void>,
    batchSize: number = this.BATCH_SIZE,
    delayBetweenBatches: number = this.BATCH_DELAY
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process items in current batch concurrently
      await Promise.all(batch.map((item, batchIndex) => 
        processItem(item, i + batchIndex)
      ));
      
      // If there are more items to process, wait before next batch
      if (i + batchSize < items.length) {
        this.emitSystemMessage(`Waiting ${delayBetweenBatches/1000} seconds before processing next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
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

      console.log(`🔄 Processing ${outlines.length} outline(s)`);
      this.emitSystemMessage(`Processing ${outlines.length} outline${outlines.length !== 1 ? 's' : ''}...`);
      
      // Process outlines in batches
      await this.processBatch(outlines, async (outline, index) => {
        const outlineTitle = outline.title || `Outline ${index + 1}`;
        this.emitSystemMessage(`Processing ${outlineTitle} (${index + 1}/${outlines.length})`);
        
        try {
          // Create a new thread for the outline
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
          console.log(`🤖 Starting assistant for outline on thread:`, thread.id);
          const run = await this.openAiApiService.runThread(thread, { id: this.SCRIPT_ASSISTANT_ID });
          console.log('✅ Assistant started, run ID:', run.id, 'for thread:', thread.id);
          
          // Add outline to generated objects
          this.generatedObjects.addOutline(outline);
          
          this.messageService.add({
            severity: 'success',
            summary: 'Outline Processing',
            detail: `Processed ${outlineTitle}`
          });
        } catch (error) {
          console.error(`❌ Error processing outline:`, error);
          throw error;
        }
      });

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

      // Start the assistant with rate limiting
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
   * @param scriptJson JSON string containing the content to send to Pictory
   * @param threadId The thread ID for tracking project counters
   * @param title Optional title of the video
   * @returns A promise that resolves with {success: true}
   */
  async sendToPictory(scriptJson: string, threadId: string, title: string): Promise<{ success: true }> {
    console.log('🚀 sendToPictory started with:', { scriptJson, threadId, title });
    try {
       // Increment video counter for this project
       const counters = this.getProjectCounters(threadId);
       counters.videos++;
       console.log('📊 Video counter incremented:', counters.videos);
      
       // Parse JSON content
      let content: any;
      try {
        content = JSON.parse(scriptJson);
        console.log('📝 Parsed content:', content);
      } catch (error) {
        console.error('❌ JSON parsing failed:', error);
        throw new Error('Invalid JSON format for Pictory content');
      }

      // Create storyboard
      console.log('📤 Creating storyboard with Pictory API');
      const response = await this.pictoryUtils.createStoryboard(content);
      console.log('✅ Pictory API request successful, job ID:', response.jobId);
      this.emitSystemMessage(`🎥 Video generation started. Job ID: ${response.jobId}`);

      // Save initial Pictory request
      this.generatedObjects.addPictoryRequest({
        jobId: response.jobId,
        content: content,
        title: title,
        threadId: threadId,
        preview: ''
      });

      // Poll for job completion
      console.log('⏳ Waiting for video preview...');
      this.emitSystemMessage('⏳ Waiting for video preview...');
      const jobStatus = await this.pictoryUtils.pollJobUntilComplete(response.jobId);

      if (!jobStatus.data.renderParams) {
        throw new Error('No render parameters received');
      }

      // Start video render
      this.emitSystemMessage('🎬 Starting video render...');
      const renderStatus = await this.pictoryUtils.renderVideo(jobStatus.data.renderParams);

      if (!renderStatus.data.videoURL) {
        throw new Error('No video URL received');
      }

      // Save the render status
      this.generatedObjects.addPictoryRender({
        jobId: renderStatus.job_id,
        preview: renderStatus.data.preview || '',
        video: renderStatus.data.videoURL,
        thumbnail: renderStatus.data.thumbnail || '',
        duration: renderStatus.data.videoDuration || 0
      });

      // Download and save the video
      const videoName = title || `video-${renderStatus.job_id}`;
      const videoPath = await this.pictoryUtils.downloadVideo(renderStatus.data.videoURL, videoName);

      // Save video object
      this.generatedObjects.addVideo({
        name: videoName,
        file: videoPath,
        url: renderStatus.data.videoURL,
        thumbnail: renderStatus.data.thumbnail || ''
      });

      this.emitSystemMessage(`✨ Video generated and saved to: ${videoPath}`);
      console.log('✨ Video generation complete!', renderStatus);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error in sendToPictory:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Pictory Error',
        detail: `Failed to generate video: ${errorMessage}`
      });
      this.emitSystemMessage(`❌ Error: Failed to generate video: ${errorMessage}`);
      throw error;
    }
  }
}
