import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { FunctionNode, FunctionNodesConfig } from '../interfaces/function-nodes';

@Injectable({
  providedIn: 'root'
})
export class FunctionNodesService {
  private functionNodes: FunctionNodesConfig | null = null;

  constructor(
    private configService: ConfigService
  ) {}

  private async ensureBaseDir(): Promise<string> {
    return await window.electron.path.appConfigDir();
  }

  private async getFunctionNodesPath(profileId: string): Promise<string> {
    const baseDir = await this.ensureBaseDir();
    return window.electron.path.join(baseDir, `function-nodes-${profileId}.json`);
  }

  async loadFunctionNodes(profileId: string): Promise<FunctionNodesConfig> {
    try {
      const filePath = await this.getFunctionNodesPath(profileId);
      const content = await window.electron.fs.readTextFile(filePath);
      this.functionNodes = JSON.parse(content);
      return this.functionNodes;
    } catch (error) {
      // If file doesn't exist, create a new config
      const newConfig: FunctionNodesConfig = {
        profileId,
        functions: [],
        version: '1.0.0',
        lastModified: new Date().toISOString()
      };
      await this.saveFunctionNodes(profileId, newConfig);
      return newConfig;
    }
  }

  async saveFunctionNodes(profileId: string, config: FunctionNodesConfig): Promise<void> {
    try {
      const filePath = await this.getFunctionNodesPath(profileId);
      config.lastModified = new Date().toISOString();
      await window.electron.fs.writeTextFile(filePath, JSON.stringify(config, null, 2));
      this.functionNodes = config;
    } catch (error) {
      console.error('Failed to save function nodes:', error);
      throw error;
    }
  }

  async addFunctionNode(profileId: string, functionNode: FunctionNode): Promise<void> {
    const config = await this.loadFunctionNodes(profileId);
    config.functions.push(functionNode);
    await this.saveFunctionNodes(profileId, config);
  }

  async updateFunctionNode(profileId: string, functionNode: FunctionNode): Promise<void> {
    const config = await this.loadFunctionNodes(profileId);
    const index = config.functions.findIndex(f => f.id === functionNode.id);
    if (index === -1) {
      throw new Error(`Function node with id ${functionNode.id} not found`);
    }
    config.functions[index] = functionNode;
    await this.saveFunctionNodes(profileId, config);
  }

  async deleteFunctionNode(profileId: string, functionNodeId: string): Promise<void> {
    const config = await this.loadFunctionNodes(profileId);
    config.functions = config.functions.filter(f => f.id !== functionNodeId);
    await this.saveFunctionNodes(profileId, config);
  }

  async getFunctionNode(profileId: string, functionNodeId: string): Promise<FunctionNode | null> {
    const config = await this.loadFunctionNodes(profileId);
    return config.functions.find(f => f.id === functionNodeId) || null;
  }

  async getAllFunctionNodes(profileId: string): Promise<FunctionNode[]> {
    const config = await this.loadFunctionNodes(profileId);
    return config.functions;
  }

  async listFunctions(): Promise<FunctionNode[]> {
    const profile = this.configService.getActiveProfile();
    if (!profile) throw new Error('No active profile');
    
    const config = await this.loadFunctionNodes(profile.id);
    return config.functions;
  }

  async saveFunction(func: FunctionNode): Promise<void> {
    const profile = await this.configService.getActiveProfile();
    if (!profile) {
      throw new Error('No active profile');
    }

    const config = await this.loadFunctionNodes(profile.id);

    // Ensure function has required fields
    if (!func.name || !func.command || !func.script) {
      throw new Error('Function must have name, command, and script');
    }

    // Ensure inputs and outputs are string arrays
    func.inputs = Array.isArray(func.inputs) ? func.inputs.map(input => String(input)) : [];
    func.outputs = Array.isArray(func.outputs) ? func.outputs.map(output => String(output)) : [];

    // Generate a unique ID if not provided
    if (!func.id) {
      func.id = crypto.randomUUID();
    }

    const existingIndex = config.functions.findIndex(f => f.id === func.id);
    if (existingIndex >= 0) {
      config.functions[existingIndex] = func;
    } else {
      config.functions.push(func);
    }

    await this.saveFunctionNodes(profile.id, config);
  }
}
