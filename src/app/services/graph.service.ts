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
  private _currentState: IGraphState | null = null;
  private currentStateSubject = new BehaviorSubject<IGraphState | null>(null);

  constructor(private configService: ConfigService) {
    // Load saved graph state if exists
    this.loadGraph();

    // Subscribe to profile and project changes
    this.configService.activeProfile$.subscribe(profile => {
      if (profile) {
        console.log('Active profile changed, reloading graph...');
        this.loadGraph();
      }
    });

    this.configService.activeProject$.subscribe(project => {
      if (project) {
        console.log('Active project changed, reloading graph...');
        this.loadGraph();
      }
    });
  }

  public get currentState$(): Observable<IGraphState | null> {
    return this.currentStateSubject.asObservable();
  }

  public get state(): IGraphState | null {
    return this._currentState;
  }

  public setState(state: IGraphState | null): void {
    this._currentState = state;
    this.currentStateSubject.next(state);
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

    const currentState = this.state;
    if (currentState) {
      this.setState({
        ...currentState,
        nodes: [...currentState.nodes, node]
      });
    } else {
      this.setState({
        nodes: [node],
        connections: []
      });
    }

    return node;
  }

  addConnection(fromNode: string, fromOutput: string, toNode: string, toInput: string): void {
    const currentState = this.state;
    if (currentState) {
      this.setState({
        ...currentState,
        connections: [...currentState.connections, {
          fromNode,
          fromOutput,
          toNode,
          toInput
        }]
      });
    } else {
      this.setState({
        nodes: [],
        connections: [{
          fromNode,
          fromOutput,
          toNode,
          toInput
        }]
      });
    }
  }

  removeNode(nodeId: string): void {
    const currentState = this.state;
    if (currentState) {
      this.setState({
        nodes: currentState.nodes.filter(n => n.id !== nodeId),
        connections: currentState.connections.filter(
          c => c.fromNode !== nodeId && c.toNode !== nodeId
        )
      });
    }
  }

  removeConnection(fromNode: string, fromOutput: string, toNode: string, toInput: string): void {
    const currentState = this.state;
    if (currentState) {
      this.setState({
        ...currentState,
        connections: currentState.connections.filter(
          c => !(c.fromNode === fromNode && 
                 c.fromOutput === fromOutput && 
                 c.toNode === toNode && 
                 c.toInput === toInput)
        )
      });
    }
  }

  updateState(state: IGraphState): void {
    console.log('Updating graph state:', state);
    this.setState(state);
  }

  private async getGraphFilePath(): Promise<string> {
    const profile = this.configService.getActiveProfile();
    const project = this.configService.getActiveProject();
    if (!profile) throw new Error('No active profile');
    if (!project) throw new Error('No active project');
    
    const configDir = await window.electron.path.appConfigDir();
    return window.electron.path.join(configDir, `graph-${profile.id}-${project.id}.json`);
  }

  async saveGraph(): Promise<void> {
    try {
      const activeProfile = this.configService.getActiveProfile();
      const activeProject = this.configService.getActiveProject();
      
      if (!activeProfile || !activeProject) {
        console.warn('No active profile or project found, cannot save graph');
        return;
      }

      console.log('Current graph state before save:', this.state);
      
      const graphData: IGraphSaveData = {
        ...this.state,
        version: this.CURRENT_VERSION,
        lastModified: new Date().toISOString()
      };

      console.log('Prepared graph data for save:', graphData);
      
      if (window.electron) {
        const filePath = await this.getGraphFilePath();
        await window.electron.graph.save(filePath, activeProfile.id, activeProject.id, graphData);
        console.log('Graph saved successfully');
      } else {
        console.error('Electron not available, cannot save graph');
      }
    } catch (error) {
      console.error('Error saving graph:', error);
      throw error;
    }
  }

  private async loadGraph(): Promise<void> {
    try {
      const activeProfile = this.configService.getActiveProfile();
      const activeProject = this.configService.getActiveProject();
      
      if (!activeProfile || !activeProject) {
        console.warn('No active profile or project found, starting with empty graph');
        return;
      }

      if (window.electron) {
        const filePath = await this.getGraphFilePath();
        const graphData = await window.electron.graph.load(filePath, activeProfile.id, activeProject.id);
        
        if (graphData) {
          const { version, lastModified, ...state } = graphData;
          this.setState(state);
          console.log('Graph loaded successfully');
        } else {
          // Initialize empty graph for new project
          this.setState({
            nodes: [],
            connections: []
          });
          console.log('No existing graph found');
        }
      } else {
        console.error('Electron not available, cannot load graph');
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
