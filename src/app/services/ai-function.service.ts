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
import { GraphService } from './graph.service'; // Import GraphService
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
    private http: HttpClient,
    private messageService: MessageService,
    private openAiApiService: OpenAiApiService,
    private aiCommunicationService: AiCommunicationService,
    private objectSchemaService: ObjectSchemaService,
    private objectInstanceService: ObjectInstanceService,
    private graphService: GraphService // Inject GraphService
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
          await this.objectInstanceService.createInstance(this.outlineSchemaId, {
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
      await this.objectInstanceService.createInstance(this.scriptSchemaId, {
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
      await this.objectInstanceService.createInstance(this.scriptSchemaId, {
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
      await this.objectInstanceService.createInstance(this.scriptSchemaId, {
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
      await this.objectInstanceService.createInstance(this.scriptSchemaId, {
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

  private async validateAndSaveInstance(data: any, schemaId: string): Promise<{ valid: boolean; instance?: any; errors?: string[] }> {
    try {
      // Validate data against schema
      const validationResult = await this.objectSchemaService.validateInstance(schemaId, data);
      
      if (!validationResult.valid) {
        return { valid: false, errors: validationResult.errors };
      }

      // Save validated instance
      const instance = await this.objectInstanceService.createInstance(schemaId, data);
      return { valid: true, instance };
    } catch (error) {
      console.error('Error in validation:', error);
      return { valid: false, errors: [error.message] };
    }
  }

  private async routeToNextAssistants(
    sourceNodeId: string, 
    data: any
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      const state = this.graphService.currentState;
      const connections = state.connections.filter(c => c.fromNode === sourceNodeId);
      
      for (const connection of connections) {
        const targetNode = state.nodes.find(n => n.id === connection.toNode);
        if (!targetNode) continue;

        // Handle array data
        const dataItems = Array.isArray(data) ? data : [data];
        
        for (const item of dataItems) {
          try {
            // Create new message for target assistant
            await this.openAiApiService.createMessage(
              targetNode.assistantId,
              JSON.stringify(item)
            );
          } catch (error) {
            console.error(`Error routing to assistant ${targetNode.assistantId}:`, error);
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, errors: [error.message] };
    }
  }

  async executeFunction(
    functionName: string,
    args: any,
    assistantId: string
  ): Promise<{ output: string }> {
    try {
      console.log('🛠️ Executing Function:', {
        function: functionName,
        assistant: assistantId,
        arguments: args
      });

      // Get app config directory and load assistant implementation
      const baseDir = await window.electron.path.appConfigDir();
      const profileId = '97980360-679d-45ed-83fa-2dda2e21fc72'; // TODO: Get this from service
      const assistantPath = await window.electron.path.join(baseDir, `assistant-${profileId}-${assistantId}.json`);
      
      // Initialize function result with args as fallback
      let functionResult = args;
      let implementation;
      
      try {
        // Try to load and execute assistant function
        const assistantContent = await window.electron.fs.readTextFile(assistantPath);
        const assistant = JSON.parse(assistantContent);
        
        // Get function implementation from assistant file
        const functions = assistant.functions?.functions ? 
          Object.fromEntries(assistant.functions.functions.map(func => [func.name, func])) : {};
        implementation = functions[functionName];

        // Execute terminal command if present
        if (implementation?.command && implementation?.script) {
          const { command, script, workingDir } = implementation;
          
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
          console.log('🖥️ Executing terminal command:', command);
          const output = await window.electron.terminal.executeCommand({
            command,
            args: [script],
            cwd: normalizedWorkingDir,
            stdin: JSON.stringify(processedArgs)
          });

          try {
            // Try to parse as JSON
            const jsonData = JSON.parse(output);
            functionResult = jsonData;
          } catch {
            // If not JSON, return as is
            functionResult = { output };
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to load/execute assistant function:', error);
      }

      // Find nodes for this assistant
      const state = this.graphService.currentState;
      const sourceNodes = state.nodes.filter(n => n.assistantId === assistantId);
      
      if (sourceNodes.length === 0) {
        console.log('ℹ️ No source nodes found, returning function result');
        return { output: JSON.stringify(functionResult) };
      }

      const results = [];
      const errors = [];

      // Process nodes and connections only for output functions
      for (const sourceNode of sourceNodes) {
        console.log('🔄 Processing source node:', sourceNode.id);
        
        // Process all outputs first
        const outputs = sourceNode.outputs || [];
        if (outputs.length > 0) {
          console.log('📤 Processing outputs:', outputs.length);
          
          if (outputs.length === 1) {
            // Single output case
            const output = outputs[0];
            if (!output.schemaId) {
              console.warn('⚠️ No schema found for single output');
              continue;
            }

            // Check if functionResult has a key matching the output name
            const outputValue = typeof functionResult === 'object' && functionResult[output.name] !== undefined
              ? functionResult[output.name]
              : functionResult;

            console.log('✨ Validating single output against schema:', output.schemaId);
            const validationResult = await this.validateAndSaveInstance(outputValue, output.schemaId);
            if (!validationResult.valid) {
              const errorMsg = `Validation failed for ${output.name}: ${validationResult.errors?.join(', ')}`;
              console.error('❌ Validation Error:', errorMsg);
              errors.push(errorMsg);
            } else {
              console.log('✅ Validation successful for single output');
              results.push(validationResult.instance);
            }
          } else {
            // Multiple outputs case - expect object with keys matching output names
            if (typeof functionResult !== 'object') {
              const errorMsg = 'Multiple outputs require object result with keys matching output names';
              console.error('❌ Error:', errorMsg);
              errors.push(errorMsg);
              continue;
            }

            for (const output of outputs) {
              if (!output.schemaId) {
                console.warn('⚠️ No schema found for output:', output.name);
                continue;
              }

              const outputValue = functionResult[output.name];
              if (outputValue === undefined) {
                const errorMsg = `No value found for output ${output.name}`;
                console.error('❌ Error:', errorMsg);
                errors.push(errorMsg);
                continue;
              }

              console.log('✨ Validating output against schema:', output.name, output.schemaId);
              const validationResult = await this.validateAndSaveInstance(outputValue, output.schemaId);
              if (!validationResult.valid) {
                const errorMsg = `Validation failed for ${output.name}: ${validationResult.errors?.join(', ')}`;
                console.error('❌ Validation Error:', errorMsg);
                errors.push(errorMsg);
              } else {
                console.log('✅ Validation successful for:', output.name);
                results.push(validationResult.instance);
              }
            }
          }
        }

        // Only check connections if this is an output function
        if (!implementation?.isOutput) {
          console.log('ℹ️ Not an output function, returning result directly');
          return { output: JSON.stringify(functionResult) };
        }
          
        // Now handle connections for routing
        const connections = state.connections.filter(c => c.fromNode === sourceNode.id);
        if (connections.length === 0) {
          console.log('ℹ️ No connections found for node:', sourceNode.id);
          continue;
        }

        for (const connection of connections) {
          console.log('🔗 Processing connection:', {
            from: connection.fromNode,
            to: connection.toNode,
            output: connection.fromOutput
          });

          // Get output schema
          const outputDot = sourceNode.outputs.find(o => o.name === connection.fromOutput);
          if (!outputDot?.schemaId) {
            console.log('⚠️ No schema found for output:', connection.fromOutput);
            continue;
          }

          // Find the matching validated result for this output
          const outputValue = typeof functionResult === 'object' && functionResult[outputDot.name] !== undefined
            ? functionResult[outputDot.name]
            : functionResult;

          try {
            const routingResult = await this.routeToNextAssistants(connection.toNode, outputValue);
            if (!routingResult.success) {
              errors.push(...(routingResult.errors || []));
            }
          } catch (error) {
            console.error('❌ Error routing to next assistant:', error);
            errors.push(error.message);
          }
        }
      }

      if (errors.length > 0) {
        console.warn('⚠️ Function completed with errors:', errors);
      }

      return { output: JSON.stringify(functionResult) };
    } catch (error) {
      console.error('❌ Error executing function:', error);
      throw error;
    }
  }
}
