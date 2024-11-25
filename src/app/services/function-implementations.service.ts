import { Injectable } from '@angular/core';
import { AssistantFunctionImplementations, FunctionImplementation } from '../interfaces/function-implementations';
import { FunctionDefinition } from '../components/function-editor/function-editor.component';
import { ConfigService } from './config.service';

interface AssistantConfig {
  functions: AssistantFunctionImplementations;
  inputs: string[];
  outputs: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FunctionImplementationsService {
  private baseDir: string | null = null;

  constructor(private configService: ConfigService) {}

  private async ensureBaseDir(): Promise<string> {
    if (!this.baseDir) {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      // Get the app config directory
      this.baseDir = await window.electron.path.appConfigDir();
    }
    return this.baseDir;
  }

  async saveFunctionImplementations(profileId: string, assistantId: string, functions: FunctionDefinition[], inputSchemas: string[] = [], outputSchemas: string[] = []): Promise<void> {
    try {
      const baseDir = await this.ensureBaseDir();

      const implementations: AssistantFunctionImplementations = {
        assistantId,
        functions: functions
          .filter(f => f.implementation)
          .map(f => ({
            name: f.name,
            command: f.implementation!.command,
            script: f.implementation!.script,
            workingDir: f.implementation!.workingDir,
            timeout: f.implementation!.timeout,
            isOutput: f.implementation!.isOutput
          }))
      };

      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      // Save to the new assistant configuration file
      await window.electron.assistant.save(baseDir, profileId, assistantId, {
        functions: implementations,
        inputs: inputSchemas,
        outputs: outputSchemas
      });
    } catch (error) {
      console.error('Failed to save assistant configuration:', error);
      throw new Error(`Failed to save assistant configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async loadFunctionImplementations(profileId: string, assistantId: string): Promise<AssistantConfig> {
    try {
      const baseDir = await this.ensureBaseDir();

      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const config = await window.electron.assistant.load(baseDir, profileId, assistantId);
      if (!config) {
        return { functions: { assistantId, functions: [] }, inputs: [], outputs: [] };
      }

      return config;
    } catch (error) {
      console.error('Failed to load assistant configuration:', error);
      throw new Error(`Failed to load assistant configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async mergeFunctionImplementations(
    functions: FunctionDefinition[],
    implementations: FunctionImplementation[]
  ): Promise<FunctionDefinition[]> {
    return functions.map(func => {
      const impl = implementations.find(i => i.name === func.name);
      if (!impl) return func;

      return {
        ...func,
        implementation: {
          command: impl.command,
          script: impl.script,
          workingDir: impl.workingDir,
          timeout: impl.timeout,
          isOutput: impl.isOutput
        }
      };
    });
  }
}
