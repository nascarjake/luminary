import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IAssistantNode, IGraphSaveData, IGraphState } from '../interfaces/graph';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class GraphService {
  private readonly CURRENT_VERSION = '1.0.0';
  private graphState = new BehaviorSubject<IGraphState>({
    nodes: [],
    connections: []
  });

  constructor() {
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

  saveGraph(): void {
    const saveData: IGraphSaveData = {
      ...this.currentState,
      version: this.CURRENT_VERSION,
      lastModified: new Date().toISOString()
    };
    localStorage.setItem('graph_state', JSON.stringify(saveData));
  }

  private loadGraph(): void {
    const savedState = localStorage.getItem('graph_state');
    if (savedState) {
      try {
        const parsed: IGraphSaveData = JSON.parse(savedState);
        if (parsed.version === this.CURRENT_VERSION) {
          this.graphState.next({
            nodes: parsed.nodes,
            connections: parsed.connections
          });
        }
      } catch (e) {
        console.error('Failed to load saved graph state:', e);
      }
    }
  }
}
