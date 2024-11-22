import { Component, ElementRef, OnInit, OnDestroy, ViewChild, NgZone, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssistantLibraryComponent } from '../../components/assistant-library/assistant-library.component';
import { GraphService } from '../../services/graph.service';
import { ConfigService } from '../../services/config.service';
import { FunctionImplementationsService } from '../../services/function-implementations.service';
import { ObjectSchemaService } from '../../services/object-schema.service';
import { IGraphNodeIO } from '../../interfaces/graph';
import { ObjectSchema } from '../../interfaces/object-system';
import * as LiteGraph from 'litegraph.js';

// Global LiteGraph type declarations
declare global {
  interface Window {
    LiteGraph: typeof LiteGraph & {
      createNode(type: string): LiteGraph.LGraphNode;
      registerNodeType(type: string, node: any): void;
    }
    LGraph: typeof LiteGraph.LGraph;
    LGraphCanvas: typeof LiteGraph.LGraphCanvas;
  }
}

@Component({
  selector: 'app-graph-editor',
  standalone: true,
  imports: [CommonModule, AssistantLibraryComponent],
  template: `
    <div class="graph-editor-container">
      <app-assistant-library></app-assistant-library>
      <canvas 
        class="graph-canvas" 
        #graphCanvas
        (dragover)="onDragOver($event)"
        (drop)="onDrop($event)"
      >
      </canvas>
    </div>
  `,
  styleUrls: ['./graph-editor.component.scss']
})
export class GraphEditorComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('graphCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private graph: LiteGraph.LGraph | null = null;
  private canvas: LiteGraph.LGraphCanvas | null = null;
  private animationFrameId?: number;
  private isInitialized = false;
  private schemaCache = new Map<string, ObjectSchema>();

  constructor(
    private graphService: GraphService, 
    private configService: ConfigService, 
    private functionImplementationsService: FunctionImplementationsService,
    private objectSchemaService: ObjectSchemaService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.initializeLiteGraph();
  }

  ngAfterViewInit() {
    // Start the graph loop after view is initialized
    if (this.isInitialized) {
      this.startGraphLoop();
    } else {
      console.error('Graph not properly initialized');
    }
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.graph) {
      this.graph.stop();
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (this.canvas && this.canvasRef) {
      const canvasElement = this.canvasRef.nativeElement;
      this.canvas.resize(canvasElement.offsetWidth, canvasElement.offsetHeight);
    }
  }

  private initializeLiteGraph() {
    if (!window.LiteGraph) {
      console.error('LiteGraph not loaded');
      return;
    }

    // Register node types first
    this.registerAssistantNodeType();

    // Then initialize graph
    this.initializeGraph();
    
    this.isInitialized = true;
  }

  private initializeGraph() {
    // Create graph instance
    this.graph = new window.LGraph();
    
    const canvasElement = this.canvasRef.nativeElement;
    this.canvas = new window.LGraphCanvas(canvasElement, this.graph);
    
    // Configure canvas
    if (this.canvas) {
      this.canvas.background_image = null;
      this.canvas.render_shadows = false;
      this.canvas.render_connection_arrows = true;
      this.canvas.connections_width = 3;
      this.canvas.always_render_background = true;
      this.canvas.default_link_color = "#9CA3AF";
      this.canvas.highquality_render = true;
      
      // Set canvas size
      this.onResize();
    }
    
    // Configure graph
    if (this.graph) {
      (this.graph as any).configure({
        align_to_grid: true
      });
      
      // Start graph execution
      this.graph.start();

      // Load saved state
      const state = this.graphService.currentState;
      this.loadGraphState(state);
    }
  }

  private registerAssistantNodeType() {
    // Define the node class
    class AssistantNode extends (window.LiteGraph as any).LGraphNode {
      properties: {
        assistantId: string;
        name: string;
        inputs: IGraphNodeIO[];
        outputs: IGraphNodeIO[];
      };
      size: [number, number];
      title: string;
      graph: any;

      constructor() {
        super();
        this.title = "Assistant";
        this.properties = {
          assistantId: "",
          name: "",
          inputs: [],
          outputs: []
        };
        this.size = [180, 60];
      }

      onConnectionsChange(type: number, slotIndex: number, connected: boolean, linkInfo: any): boolean {
        if (!linkInfo || !this.graph) return true;

        const fromNode = this.graph._nodes.find((n: any) => n.id === linkInfo.origin_id);
        const toNode = this.graph._nodes.find((n: any) => n.id === linkInfo.target_id);
        
        if (!fromNode || !toNode) return false;

        // Check if schemas match
        const outputSchema = fromNode.properties.outputs[linkInfo.origin_slot].schemaId;
        const inputSchema = toNode.properties.inputs[linkInfo.target_slot].schemaId;
        
        if (outputSchema !== inputSchema) {
          // Schemas don't match, prevent connection
          return false;
        }

        return true;
      }

      onExecute() {
        const inputs = this.properties.inputs;
        const outputs = this.properties.outputs;

        inputs.forEach((input: IGraphNodeIO, index: number) => {
          const value = this.getInputData(index);
          if (value !== undefined) {
            // Process the input based on its schema
            // TODO: Implement input processing
          }
        });

        outputs.forEach((output: IGraphNodeIO, index: number) => {
          // TODO: Set output data based on assistant processing
          this.setOutputData(index, null);
        });
      }

      // Add required LGraphNode methods
      getInputData(index: number): any {
        return super.getInputData(index);
      }

      setOutputData(index: number, data: any) {
        super.setOutputData(index, data);
      }
    }

    // Register the node type
    window.LiteGraph.registerNodeType("assistant/base", AssistantNode);
  }

  private startGraphLoop() {
    if (!this.canvas) return;

    // Run graph loop outside Angular zone for better performance
    this.ngZone.runOutsideAngular(() => {
      const loop = () => {
        if (this.canvas) {
          this.canvas.draw(true);
        }
        this.animationFrameId = requestAnimationFrame(loop);
      };
      loop();
    });
  }

  private loadGraphState(state: any) {
    if (!this.graph) return;

    // Clear existing nodes
    this.graph.clear();

    // Add nodes
    state.nodes.forEach((node: any) => {
      const graphNode = window.LiteGraph.createNode('assistant/base');
      graphNode.pos = [node.position.x, node.position.y];
      graphNode.properties = {
        assistantId: node.assistantId,
        name: node.name
      };
      this.graph?.add(graphNode);
    });

    // Add connections
    state.connections.forEach((conn: any) => {
      const fromNode = this.graph?.getNodeById(conn.fromNode);
      const toNode = this.graph?.getNodeById(conn.toNode);
      if (fromNode && toNode) {
        fromNode.connect(conn.fromOutput, toNode, conn.toInput);
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  async onDrop(event: DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer || !this.graph || !this.isInitialized) {
      console.error('Graph not ready for drops');
      return;
    }

    const data = event.dataTransfer.getData('application/json');
    if (!data) {
      console.error('No data in drop event');
      return;
    }

    try {
      const assistant = JSON.parse(data);
      if (assistant.type === 'assistant') {
        // Get drop position relative to canvas
        const rect = this.canvasRef.nativeElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Create node instance
        const node = window.LiteGraph.createNode('assistant/base') as any;
        if (!node) {
          console.error('Failed to create node');
          return;
        }

        // Set node properties
        node.properties.assistantId = assistant.id;
        node.properties.name = assistant.name;
        node.title = assistant.name;

        // Position the node
        node.pos = [x, y];
        
        // Add node to graph
        this.graph.add(node);

        // Add node to graph service
        const graphNode = this.graphService.addNode(assistant.id, assistant.name, { x, y });
        node.id = parseInt(graphNode.id); // Ensure IDs match between visual and data nodes

        // Load and update node schemas
        await this.updateNodeSchemas(node, assistant);

        // Force graph to redraw
        if (this.canvas) {
          this.canvas.setDirty(true, true);
        }
      }
    } catch (error) {
      console.error('Failed to process dropped assistant:', error);
    }
  }

  private async updateNodeSchemas(graphNode: LiteGraph.LGraphNode, assistant: any) {
    try {
      const activeProfile = await this.configService.getActiveProfile();
      if (!activeProfile) return;

      const config = await this.functionImplementationsService.loadFunctionImplementations(
        activeProfile.id,
        assistant.id
      );

      // Load all schemas first
      await Promise.all(
        [...config.inputs, ...config.outputs].map(async (schemaId) => {
          if (!this.schemaCache.has(schemaId)) {
            const schema = await this.objectSchemaService.getSchema(schemaId);
            if (schema) {
              this.schemaCache.set(schemaId, schema);
            }
          }
        })
      );

      // Update node properties with schema information
      graphNode.properties.inputs = config.inputs.map(schemaId => {
        const schema = this.schemaCache.get(schemaId);
        return {
          name: schema?.name || schemaId,
          type: "object",
          schemaId,
          description: schema?.description
        };
      });

      graphNode.properties.outputs = config.outputs.map(schemaId => {
        const schema = this.schemaCache.get(schemaId);
        return {
          name: schema?.name || schemaId,
          type: "object",
          schemaId,
          description: schema?.description
        };
      });

      // Update node appearance with labeled slots
      graphNode.inputs = graphNode.properties.inputs.map((input: IGraphNodeIO) => ({
        name: input.name,
        type: input.type,
        label: input.name
      }));

      graphNode.outputs = graphNode.properties.outputs.map((output: IGraphNodeIO) => ({
        name: output.name,
        type: output.type,
        label: output.name
      }));
      
      // Force node to resize based on new slots
      graphNode.size = graphNode.computeSize();
      if (this.canvas) {
        this.canvas.setDirty(true, true);
      }
    } catch (error) {
      console.error('Failed to update node schemas:', error);
    }
  }

  private formatSchemaName(schemaId: string): string {
    // Convert schema ID to a readable name
    // Example: "function_call_request" -> "Function Call Request"
    return schemaId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
