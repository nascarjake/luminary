import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IAssistantNode, IGraphSaveData, IGraphState } from '../interfaces/graph';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '../services/config.service';

@Injectable({
  providedIn: 'root'
})
export class GraphService {
  private readonly CURRENT_VERSION = '1.0.0';
  private graphState = new BehaviorSubject<IGraphState>({
    nodes: [],
    connections: []
  });

  constructor(private configService: ConfigService) {
    // Load saved graph state if exists
    this.loadGraph();
  }

  get state$(): Observable<IGraphState> {
    return this.graphState.asObservable();
  }

  get currentState(): IGraphState {
    return this.graphState.value;
  }

  addNode(assistantId: string, name: string, position: { x: number, y: number }): IAssistantNode {
    const node: IAssistantNode = {
      id: uuidv4(),
      assistantId,
      name,
      position,
      inputs: [],  // These will be populated based on assistant's schema
      outputs: []  // These will be populated based on assistant's schema
    };

    const currentState = this.currentState;
    this.graphState.next({
      ...currentState,
      nodes: [...currentState.nodes, node]
    });

    return node;
  }

  addConnection(fromNode: string, fromOutput: string, toNode: string, toInput: string): void {
    const currentState = this.currentState;
    this.graphState.next({
      ...currentState,
      connections: [...currentState.connections, {
        fromNode,
        fromOutput,
        toNode,
        toInput
      }]
    });
  }

  removeNode(nodeId: string): void {
    const currentState = this.currentState;
    this.graphState.next({
      nodes: currentState.nodes.filter(n => n.id !== nodeId),
      connections: currentState.connections.filter(
        c => c.fromNode !== nodeId && c.toNode !== nodeId
      )
    });
  }

  removeConnection(fromNode: string, fromOutput: string, toNode: string, toInput: string): void {
    const currentState = this.currentState;
    this.graphState.next({
      ...currentState,
      connections: currentState.connections.filter(
        c => !(c.fromNode === fromNode && 
               c.fromOutput === fromOutput && 
               c.toNode === toNode && 
               c.toInput === toInput)
      )
    });
  }

  private async getConfigDir(): Promise<string> {
    return await window.electron.path.appConfigDir();
  }

  async saveGraph(): Promise<void> {
    try {
      const configDir = await this.getConfigDir();
      const activeProfile = this.configService.getActiveProfile();
      
      if (!activeProfile) {
        console.warn('No active profile found, cannot save graph');
        return;
      }

      const graphData: IGraphSaveData = {
        ...this.currentState,
        version: this.CURRENT_VERSION,
        lastModified: new Date().toISOString()
      };

      await window.electron.graph.save(configDir, activeProfile.id, graphData);
      console.log('Graph saved successfully for profile:', activeProfile.id);
    } catch (error) {
      console.error('Error saving graph:', error);
      throw error;
    }
  }

  private async loadGraph(): Promise<void> {
    try {
      const configDir = await this.getConfigDir();
      const activeProfile = this.configService.getActiveProfile();
      
      if (!activeProfile) {
        console.warn('No active profile found, starting with empty graph');
        return;
      }

      const graphData = await window.electron.graph.load(configDir, activeProfile.id);
      
      if (graphData) {
        // Version check and migration could be added here if needed
        const { version, lastModified, ...state } = graphData;
        this.graphState.next(state);
        console.log('Graph loaded successfully for profile:', activeProfile.id);
      } else {
        // Initialize empty graph for new profile
        this.graphState.next({
          nodes: [],
          connections: []
        });
        console.log('No existing graph found for profile:', activeProfile.id);
      }
    } catch (error) {
      console.error('Error loading graph:', error);
      // Don't throw here - just start with empty graph
    }
  }

  async reloadGraph(): Promise<void> {
    await this.loadGraph();
  }
}
