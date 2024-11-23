import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { AvailableFunctions } from '../../lib/entities/OAFunctionCall';
import { OpenAiApiService } from './open-ai-api.service';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AiCommunicationService } from './ai-communication.service';
import { PictoryUtils, PictoryJobResponse, PictoryJobStatus } from '../utils/pictory.utils';
import { ObjectSchemaService } from './object-schema.service';
import { ObjectInstanceService } from './object-instance.service';
import type { Electron } from 'electron-api';

declare global {
  interface Window {
    electron: Electron;
  }
}

// Types moved from generated-objects.service.ts
export interface ScriptOutline {
  id?: string;
  title?: string;
  [key: string]: any;
}

export interface Script {
  id: string;
  title?: string;
  content: string;
  threadId: string;
  createdAt: string;
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
  private readonly BATCH_DELAY = 5000;
  private readonly projectCounters = new Map<string, ProjectCounters>();
  private systemMessageSource = new Subject<string>();
  systemMessage$ = this.systemMessageSource.asObservable();
  private pictoryUtils: PictoryUtils;
  private outlineSchemaId?: string;
  private scriptSchemaId?: string;

  constructor(
    private messageService: MessageService,
    private openAiApiService: OpenAiApiService,
    private http: HttpClient,
    private aiCommunicationService: AiCommunicationService,
    private schemaService: ObjectSchemaService,
    private instanceService: ObjectInstanceService
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
    if (!this.outlineSchemaId) throw new Error('Schemas not initialized');
    
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
          
          // Store outline in object system
          await this.instanceService.createInstance(this.outlineSchemaId, {
            title: outlineTitle,
            content: outline
          });
          
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
    if (!this.scriptSchemaId) throw new Error('Schemas not initialized');

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

      // Store script in object system
      await this.instanceService.createInstance(this.scriptSchemaId, {
        title: title || `Script ${counters.scripts}`,
        content: script,
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
    if (!this.scriptSchemaId) throw new Error('Schemas not initialized');

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
      await this.instanceService.createInstance(this.scriptSchemaId, {
        title: title,
        content: JSON.stringify({title, threadId,content, jobId: response.jobId, preview: ''}),
        threadId: threadId,
        jobId: response.jobId
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
      await this.instanceService.createInstance(this.scriptSchemaId, {
        title: title,
        content: JSON.stringify({
          jobId: renderStatus.job_id,
          preview: renderStatus.data.preview || '',
          video: renderStatus.data.videoURL,
          thumbnail: renderStatus.data.thumbnail || '',
          duration: renderStatus.data.videoDuration || 0
        }),
        threadId: threadId
      });

      // Download and save the video
      const videoName = title || `video-${renderStatus.job_id}`;
      const videoPath = await this.pictoryUtils.downloadVideo(renderStatus.data.videoURL, videoName);

      // Save video object
      await this.instanceService.createInstance(this.scriptSchemaId, {
        title: videoName,
        content: JSON.stringify({
          name: videoName,
          file: videoPath,
          url: renderStatus.data.videoURL,
          thumbnail: renderStatus.data.thumbnail || ''
        }),
        threadId: threadId,
        isFinalOutput: true  // Mark as final output
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

  /**
   * Executes a function based on its implementation details and parameters
   */
  async executeFunction(
    functionName: string,
    args: any,
    assistantId: string
  ): Promise<{ output: string }> {
    try {
      // Get app config directory
      const baseDir = await window.electron.path.appConfigDir();
      
      // Load assistant file
      const profileId = '97980360-679d-45ed-83fa-2dda2e21fc72'; // TODO: Get this from service
      const assistantPath = await window.electron.path.join(baseDir, `assistant-${profileId}-${assistantId}.json`);
      const assistantContent = await window.electron.fs.readTextFile(assistantPath);
      const assistant = JSON.parse(assistantContent);
      
      // Get function implementation from assistant file
      const functions = assistant.functions?.functions ? 
        Object.fromEntries(assistant.functions.functions.map(func => [func.name, func])) : {};
      const implementation = functions[functionName];

      if (!implementation) {
        throw new Error(`No implementation found for function: ${functionName}`);
      }

      const { command, script, workingDir } = implementation;
      
      if (!command || !script) {
        throw new Error(`Invalid implementation for function: ${functionName}`);
      }

      // Process any paths in the arguments to be platform-independent
      const processedArgs: Record<string, any> = {};
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string') {
          try {
            // First try to parse as JSON
            processedArgs[key] = JSON.parse(value);
          } catch {
            // If it's a path-like string (contains / or \), normalize it
            if (value.includes('/') || value.includes('\\')) {
              // If it's not absolute, make it relative to baseDir
              const isAbsolute = value.startsWith('/') || /^[A-Za-z]:/.test(value);
              processedArgs[key] = isAbsolute ? value : await window.electron.path.join(baseDir, value);
            } else {
              processedArgs[key] = value;
            }
          }
        } else {
          processedArgs[key] = value;
        }
      }

      // Normalize working directory path
      const normalizedWorkingDir = workingDir ? (
        workingDir.startsWith('/') || /^[A-Za-z]:/.test(workingDir)
          ? workingDir 
          : await window.electron.path.join(baseDir, workingDir)
      ) : baseDir;

      // Execute the command with output handling
      const result = await window.electron.terminal.executeCommand({
        command,
        args: [script],
        cwd: normalizedWorkingDir,
        stdin: JSON.stringify(processedArgs)
      });

      try {
        // Try to parse as JSON
        const jsonData = JSON.parse(result);
        // If it has a message field, use that
        return { output: jsonData.message || result };
      } catch {
        // If not JSON, return as is
        return { output: result };
      }
    } catch (error: any) {
      console.error('Error executing function:', error);
      throw new Error(`Failed to execute function ${functionName}: ${error.message}`);
    }
  }
}
