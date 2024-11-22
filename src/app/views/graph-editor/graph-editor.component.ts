import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssistantLibraryComponent } from '../../components/assistant-library/assistant-library.component';
import { GraphService } from '../../services/graph.service';

declare const LGraph: any;
declare const LGraphCanvas: any;

@Component({
  selector: 'app-graph-editor',
  standalone: true,
  imports: [CommonModule, AssistantLibraryComponent],
  template: `
    <div class="graph-editor-container">
      <app-assistant-library></app-assistant-library>
      <div 
        class="graph-canvas" 
        #graphCanvas
        (dragover)="onDragOver($event)"
        (drop)="onDrop($event)"
      >
      </div>
    </div>
  `,
  styleUrls: ['./graph-editor.component.scss']
})
export class GraphEditorComponent implements OnInit {
  @ViewChild('graphCanvas', { static: true }) canvasRef!: ElementRef;
  
  private graph: any;
  private canvas: any;

  constructor(private graphService: GraphService) {}

  ngOnInit() {
    if (typeof LGraph !== 'undefined') {
      this.initializeGraph();
      this.registerAssistantNodeType();
    }
  }

  private initializeGraph() {
    this.graph = new LGraph();
    
    const canvasElement = this.canvasRef.nativeElement;
    this.canvas = new LGraphCanvas(canvasElement, this.graph);
    
    // Set canvas size
    this.canvas.resize(canvasElement.offsetWidth, canvasElement.offsetHeight);
    
    // Start graph execution
    this.graph.start();

    // Load saved state
    const state = this.graphService.currentState;
    this.loadGraphState(state);
  }

  private loadGraphState(state: any) {
    // Clear existing nodes
    this.graph.clear();

    // Add nodes
    state.nodes.forEach((node: any) => {
      const graphNode = LGraph.createNode('assistant/base');
      graphNode.pos = [node.position.x, node.position.y];
      graphNode.properties.assistantId = node.assistantId;
      graphNode.properties.name = node.name;
      this.graph.add(graphNode);
    });

    // Add connections
    state.connections.forEach((conn: any) => {
      const fromNode = this.graph.getNodeById(conn.fromNode);
      const toNode = this.graph.getNodeById(conn.toNode);
      if (fromNode && toNode) {
        fromNode.connect(conn.fromOutput, toNode, conn.toInput);
      }
    });
  }

  private registerAssistantNodeType() {
    const nodeType = "assistant/base";
    
    LGraph.registerNodeType(nodeType, {
      title: "Assistant",
      
      inputs: [], // Will be populated based on assistant's input schemas
      outputs: [], // Will be populated based on assistant's output schemas
      
      properties: {
        assistantId: "",
        name: "Assistant Node"
      },

      onExecute: function() {
        // Handle node execution
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer) return;

    const data = event.dataTransfer.getData('application/json');
    if (!data) return;

    try {
      const assistant = JSON.parse(data);
      if (assistant.type === 'assistant') {
        // Get drop position relative to canvas
        const rect = this.canvasRef.nativeElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Add node to graph service
        const node = this.graphService.addNode(assistant.id, assistant.name, { x, y });

        // Create visual node
        const graphNode = LGraph.createNode('assistant/base');
        graphNode.pos = [x, y];
        graphNode.properties.assistantId = assistant.id;
        graphNode.properties.name = assistant.name;
        this.graph.add(graphNode);
      }
    } catch (error) {
      console.error('Failed to parse dropped data:', error);
    }
  }
}
