import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { AiCommunicationService } from './ai-communication.service';
import { ObjectSchemaService } from './object-schema.service';
import { ObjectInstanceService } from './object-instance.service';
import { GraphService } from './graph.service'; // Import GraphService
import { ConfigService } from './config.service'; // Import ConfigService
import { FunctionNodesService } from './function-nodes.service'; // Import FunctionNodesService
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
  private readonly projectCounters = new Map<string, ProjectCounters>();
  private systemMessageSource = new Subject<string>();
  systemMessage$ = this.systemMessageSource.asObservable();

  constructor(
    private aiCommunicationService: AiCommunicationService,
    private objectSchemaService: ObjectSchemaService,
    private objectInstanceService: ObjectInstanceService,
    private graphService: GraphService,
    private configService: ConfigService,
    private functionNodesService: FunctionNodesService
  ) {
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

  private async downloadMediaFields(instance: any, schemaId: string): Promise<void> {
    const schema = await this.objectSchemaService.getSchema(schemaId);
    if (!schema || !schema.fields) {
      console.error('❌ Invalid schema:', schema);
      return;
    }
    
    const mediaFields = schema.fields.filter(field => field.isMedia);
    console.log('🔍 Media fields to process:', mediaFields);
    for (const field of mediaFields) {
      const url = instance.data[field.name];
      console.log(`📦 Processing media field ${field.name}:`, { url, fieldData: instance.data[field.name] });
      if (url && typeof url === 'string') {
        try {
          // Create a unique filename based on the field and instance
          const ext = url.split('.').pop() || '';
          const filename = `${field.name}-${instance.id}.${ext}`;
          const filePath = await window.electron.path.join(
            await window.electron.path.appConfigDir(),
            'media',
            filename
          );
          console.log(`🎯 Generated file path:`, { filename, filePath });

          // Ensure media directory exists
          const mediaDir = await window.electron.path.join(
            await window.electron.path.appConfigDir(),
            'media'
          );
          console.log(`📁 Creating media directory:`, mediaDir);
          await window.electron.fs.mkdir(mediaDir, { recursive: true });

          // Download the file directly using electron's download utility
          console.log(`⬇️ Attempting to download from ${url} to ${filePath}`);
          this.emitSystemMessage(`⬇️ Downloading media for ${field.name} of ${instance.name || instance.tile || instance.key || instance.id}`);
          await window.electron.download.downloadFile(url, filePath);

          // Update instance with local file path
          console.log(`✅ Download complete, updating instance with path:`, filePath);
          this.emitSystemMessage(`✅ Downloaded media for ${field.name} of ${instance.name || instance.tile || instance.key || instance.id}`);
          instance.data[field.name] = filePath;
          await this.objectInstanceService.updateInstance(instance.id, instance.data);
        } catch (error) {
          console.error(`Failed to download media for field ${field.name}:`, error);
          this.emitSystemMessage(`❌ Error: Failed to download media for field ${field.name}: ${error}`);
          // Don't fail the whole operation if media download fails
        }
      }
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
      await this.downloadMediaFields(instance, schemaId);
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
      const state = this.graphService.state;
      const connections = state.connections.filter(c => c.fromNode === sourceNodeId);
      
      for (const connection of connections) {
        console.log('🔗 Processing connection:', {
          from: connection.fromNode,
          to: connection.toNode,
          output: connection.fromOutput
        });
        const targetNode = state.nodes.find(n => n.id === connection.toNode);
        if (!targetNode) continue;

        // Handle array data
        const dataItems = Array.isArray(data) ? data : [data];
        
        for (const item of dataItems) {
          try {
            if (targetNode.functionId && targetNode.inputs?.find(i => i.schemaId == data.schemaId)) {
              // Handle function node
              const result = await this.runFunctionNode(targetNode, item?.data || item);
              if (!result.success) {
                console.error(`Error running function node ${targetNode.name}:`, result.errors);
                this.emitSystemMessage(`❌ Error in function node ${targetNode.name}: ${result.errors?.join(', ')}`);
                continue;
              }
              if (result.output) {
                await this.routeToNextAssistants(targetNode.id, result.output);
              }
            } else if (targetNode.assistantId && targetNode.inputs?.find(i => i.schemaId == data.schemaId)) {
              // Handle assistant node
              this.aiCommunicationService.routeMessage({
                message: JSON.stringify(item?.data || item),
                assistantId: targetNode.assistantId
              });
              this.emitSystemMessage(`🔄 Starting next assistant: ${targetNode.name}`);
            } else {
              console.warn(`Node ${targetNode.name} has neither functionId nor assistantId`);
            }
          } catch (error) {
            console.error(`Error routing to node ${targetNode.name}:`, error);
            this.emitSystemMessage(`❌ Error routing to node ${targetNode.name}: ${error}`);
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, errors: [error.message] };
    }
  }

  private parseOutputSchemaFromFunctionResult(functionResult: any, output: any, outputErrors: string[], errors: string[]): any {
    const outputName = output?.name?.trim() || '';
    if (!outputName) return false;

    // Pre-compute all variations once
    const noSpaces = outputName.replace(/ /g, '');
    const variations = [
      noSpaces.charAt(0).toLowerCase() + noSpaces.slice(1),  // camelCase (most common in JS/TS)
      noSpaces.toLowerCase(),                                // lowercase no spaces
      noSpaces,                                             // PascalCase
      outputName.toLowerCase(),                             // lowercase with spaces
      outputName                                            // original
    ];

    // Try each variation in order of likelihood
    for (const variant of variations) {
      const value = functionResult[variant];
      if (value !== undefined) return value;
    }

    // No match found
    const errorMsg = `No value found for output ${outputName}`;
    console.error('❌ Error:', errorMsg);
    outputErrors.push(`❌ Error: ${errorMsg}`);
    errors.push(errorMsg);
    return false;
  }

  private async executeTerminalCommand(
    implementation: any,
    args: any,
    baseDir: string
  ): Promise<any> {
    if (!implementation?.command || !implementation?.script) {
      return args;
    }

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
    try {
      const output = await window.electron.terminal.executeCommand({
        command,
        args: [script],
        cwd: normalizedWorkingDir,
        stdin: JSON.stringify(processedArgs),
        env: implementation.environmentVariables
      });

      try {
        // Try to parse as JSON
        return JSON.parse(output);
      } catch {
        // If not JSON, return as is
        return output;
      }
    } catch (execError) {
      this.emitSystemMessage(`❌ Execution Error: Failed to execute command "${command}": ${execError.message}`);
      throw execError;
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
      const profile = this.configService.getActiveProfile();
      if (!profile) {
        throw new Error('No active profile found');
      }
      const profileId = profile.id;
      const assistantPath = await window.electron.path.join(baseDir, `assistant-${profileId}-${assistantId}.json`);
      
      // Initialize function result with args as fallback
      let functionResult = args;
      let implementation;
      let assistant;
      
      try {
        // Try to load and execute assistant function
        const assistantContent = await window.electron.fs.readTextFile(assistantPath);
        assistant = JSON.parse(assistantContent);

        this.emitSystemMessage(`📤 ${assistant.name} called function ${functionName}`);
        
        // Get function implementation from assistant file
        const functions = assistant.functions?.functions ? 
          Object.fromEntries(assistant.functions.functions.map(func => [func.name, func])) : {};
        implementation = functions[functionName];

        if (!implementation) {
          this.emitSystemMessage(`⚠️ Routing Error: Function "${functionName}" not found in assistant implementation`);
          throw new Error(`Function "${functionName}" not found in assistant implementation`);
        }

        // Execute terminal command if present
        functionResult = await this.executeTerminalCommand(implementation, args, baseDir);

      } catch (error) {
        console.warn('⚠️ Failed to load/execute assistant function:', error);
        this.emitSystemMessage(`⚠️ Function Error: ${error.message}`);
        throw error;
      }

      if (functionName === 'sendOutput' && typeof functionResult === 'object' && !('result' in functionResult) && 'results' in functionResult){
        functionResult.result = functionResult.results;
      }

      // For default function (sendOutput), try to parse result field
      if (functionName === 'sendOutput' && typeof functionResult === 'object' && 'result' in functionResult) {
        try {
          if(typeof functionResult.result === 'string') {
            const parsedResult = JSON.parse(functionResult.result);
            functionResult = parsedResult;
            if(functionResult.result && typeof functionResult.result === 'string'){
              const parsedResult2 = JSON.parse(functionResult.result);
              functionResult = parsedResult2;
            }
          } else {
            functionResult = functionResult.result;
          }
        } catch (e) {
          // If parsing fails, keep original functionResult
          console.log('parsing failure', e);
          this.emitSystemMessage('⚠️ Parsing Error: Failed to parse result for ' + assistant.name);
        }
      }

      // Find nodes for this assistant
      const state = this.graphService.state;
      const sourceNodes = state.nodes.filter(n => n.assistantId === assistantId);
      
      if (sourceNodes.length === 0) {
        console.log('ℹ️ No source nodes found, returning function result');
        this.emitSystemMessage(`✅ Successfully executed function: ${functionName} for ${assistant.name}`);
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
              const errorMsg = 'No schema found for single output';
              this.emitSystemMessage(`⚠️ Validation Error: ${errorMsg}`);
              console.warn('⚠️', errorMsg);
              continue;
            }

            const outputErrors = [];
            // Check if functionResult has a key matching the output name
            const parsedValue = typeof functionResult === 'object' ? this.parseOutputSchemaFromFunctionResult(functionResult, output, outputErrors, errors) : undefined;
            const outputValue = parsedValue ? parsedValue : functionResult;

            if(!outputValue && outputErrors.length > 0) {
              this.emitSystemMessage(outputErrors.join('\n'));
            }

            // Handle array of objects
            if (Array.isArray(outputValue)) {
              console.log('📦 Processing array of objects:', outputValue.length);
              for (const item of outputValue) {
                console.log('✨ Validating array item against schema:', output.schemaId);
                const validationResult = await this.validateAndSaveInstance(item, output.schemaId);
                if (!validationResult.valid) {
                  const errorMsg = `Validation failed for ${output.name}: ${validationResult.errors?.join(', ')}`;
                  this.emitSystemMessage(`❌ Validation Error: ${errorMsg}`);
                  console.error('❌ Validation Error:', errorMsg, item);
                  errors.push(errorMsg);
                } else {
                  console.log('✅ Validation successful for array item');
                  this.emitSystemMessage(`✅ Saved ${output.name} ${item.name || item.title || item.label || item.key || item.text || item.id || ''}`);
                  results.push(validationResult.instance);
                  await this.routeToNextAssistants(sourceNode.id, validationResult.instance);
                }
              }
            } else {
              console.log('✨ Validating single output against schema:', output.schemaId, outputValue);
              const validationResult = await this.validateAndSaveInstance(outputValue, output.schemaId);
              if (!validationResult.valid) {
                const errorMsg = `Validation failed for ${output.name}: ${validationResult.errors?.join(', ')}`;
                this.emitSystemMessage(`❌ Validation Error: ${errorMsg}`);
                console.error('❌ Validation Error:', errorMsg, outputValue);
                errors.push(errorMsg);
              } else {
                console.log('✅ Validation successful for single output');
                this.emitSystemMessage(`✅ Saved ${output.name} ${outputValue.name || outputValue.title || outputValue.label || outputValue.key || outputValue.text || outputValue.id || ''}`);
                results.push(validationResult.instance);
                await this.routeToNextAssistants(sourceNode.id, validationResult.instance);
              }
            }
          } else {
            // Multiple outputs case - expect object with keys matching output names
            if (typeof functionResult !== 'object') {
              const errorMsg = 'Multiple outputs require object result with keys matching output names';
              console.error('❌ Error:', errorMsg);
              this.emitSystemMessage(`❌ Error: ${errorMsg}`);
              errors.push(errorMsg);
              continue;
            }

            const outputErrors = [];
            let passed = false;

            for (const output of outputs) {
              if (!output.schemaId) {
                console.warn('⚠️ No schema found for output:', output.name);
                this.emitSystemMessage(`⚠️ No schema found for output: ${output.name}`);
                continue;
              }

              const outputValue = this.parseOutputSchemaFromFunctionResult(functionResult, output, outputErrors, errors);
              passed = !(outputValue === false);
              if(!passed) continue;
              
              console.log('✨ Validating output against schema:', output.name, output.schemaId);
              const validationResult = await this.validateAndSaveInstance(outputValue, output.schemaId);
              if (!validationResult.valid) {
                const errorMsg = `Validation failed for ${output.name}: ${validationResult.errors?.join(', ')}`;
                this.emitSystemMessage(`❌ Validation Error: ${errorMsg}`);
                console.error('❌ Validation Error:', errorMsg, outputValue);
                errors.push(errorMsg);
              } else {
                console.log('✅ Validation successful for:', output.name);
                this.emitSystemMessage(`✅ Saved ${output.name} ${outputValue.name || outputValue.title || outputValue.label || outputValue.key || outputValue.text || outputValue.id || ''}`);
                results.push(validationResult.instance);
                await this.routeToNextAssistants(sourceNode.id, validationResult.instance);
              }
            }
            
            if(!passed && outputErrors.length > 0) {
              this.emitSystemMessage(outputErrors.join('\n'));
            }
          }
        }

        // Only check connections if this is an output function
        if (!implementation?.isOutput) {
          console.log('ℹ️ Not an output function, returning result directly');
          return { output: JSON.stringify(functionResult) };
        }
          
        // Now handle connections for routing
        /*const connections = state.connections.filter(c => c.fromNode === sourceNode.id);
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
        }*/
      }

      if (errors.length > 0) {
        console.warn('⚠️ Function completed with errors:', errors);
      }

      this.emitSystemMessage(`✅ Successfully executed function: ${functionName} for ${assistant.name}`);

      return { output: JSON.stringify(functionResult) };
    } catch (error) {
      console.error('❌ Error executing function:', error);
      throw error;
    }
  }

  private async runFunctionNode(
    node: any,
    data: any
  ): Promise<{ success: boolean; output?: any; errors?: string[] }> {
    try {
      // Get app config directory
      const baseDir = await window.electron.path.appConfigDir();
      const profile = this.configService.getActiveProfile();
      if (!profile) {
        throw new Error('No active profile found');
      }

      // Load function node configuration
      const functionConfig = await this.functionNodesService.getFunctionNode(profile.id, node.functionId);
      if (!functionConfig) {
        throw new Error(`Function node ${node.functionId} not found`);
      }

      // Execute the function's terminal command
      const output = await this.executeTerminalCommand(functionConfig, data, baseDir);

      // Validate output against the function's output schema
      if (node.outputs?.length > 0) {
        const outputSchema = node.outputs[0].schemaId;
        const validationResult = await this.validateAndSaveInstance(output, outputSchema);
        if (!validationResult.valid) {
          return { success: false, errors: validationResult.errors };
        }
        return { success: true, output: validationResult.instance };
      }

      return { success: true, output };
    } catch (error) {
      console.error('Error running function node:', error);
      return { success: false, errors: [error.message] };
    }
  }
}
