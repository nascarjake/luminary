import { Injectable } from '@angular/core';
import { AssistantFunctionImplementations, FunctionImplementation } from '../interfaces/function-implementations';
import { FunctionDefinition } from '../components/function-editor/function-editor.component';
import { ConfigService } from './config.service';

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

      // Get the app config directory and ensure the functions subdirectory exists
      this.baseDir = await window.electron.path.appConfigDir();
      await window.electron.functions.ensureDir(this.baseDir);
    }
    return this.baseDir;
  }

  async saveFunctionImplementations(assistantId: string, functions: FunctionDefinition[]): Promise<void> {
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
            timeout: f.implementation!.timeout
          }))
      };

      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      await window.electron.functions.save(baseDir, assistantId, implementations);
    } catch (error) {
      console.error('Failed to save function implementations:', error);
      throw new Error(`Failed to save function implementations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async loadFunctionImplementations(assistantId: string): Promise<FunctionImplementation[]> {
    try {
      const baseDir = await this.ensureBaseDir();

      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const data = await window.electron.functions.load(baseDir, assistantId);
      if (!data) {
        return [];
      }

      return data.functions;
    } catch (error) {
      console.error('Failed to load function implementations:', error);
      throw new Error(`Failed to load function implementations: ${error instanceof Error ? error.message : String(error)}`);
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
          timeout: impl.timeout
        }
      };
    });
  }
}
