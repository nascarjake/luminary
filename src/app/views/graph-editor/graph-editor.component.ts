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
  private nodeRegistry = new Map<number, any>();

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

      // Add graph event listeners
      this.graph.onNodeAdded = (node: any) => {
        console.log('Node added:', node);
        if (!node.id) {
          node.id = this.graph!.last_node_id++;
        }
      };
      
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
      nodeRegistry: Map<number, any>;

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
        
        // Initialize inputs and outputs arrays
        this.inputs = [];
        this.outputs = [];
        
        // Initialize node registry
        this.nodeRegistry = new Map<number, any>();
      }

      configure(info: any) {
        super.configure(info);
        return this;
      }

      onAdded(graph: any) {
        if (super.onAdded) {
          super.onAdded(graph);
        }

        // Ensure node has an ID
        if (!this.id) {
          this.id = ++graph.last_node_id;
        }

        // Get reference to the component's nodeRegistry
        const component = (graph as any).component;
        if (component) {
          this.nodeRegistry = component.nodeRegistry;
        }

        // Register this node
        this.nodeRegistry.set(this.id, this);

        console.log('Node added to graph (onAdded):', {
          nodeId: this.id,
          graphNodes: Array.from(this.nodeRegistry.keys()),
          nodesById: Array.from(this.nodeRegistry.entries())
        });
      }

      onConnectionsChange(type: number, slotIndex: number, connected: boolean, linkInfo: any): boolean {
        console.log('onConnectionsChange', { 
          type, 
          slotIndex, 
          connected, 
          linkInfo,
          nodeId: this.id,
          graph: this.graph,
          isOutput: type === (window.LiteGraph as any).OUTPUT
        });
        
        if (!linkInfo || !this.graph) {
          console.log('No linkInfo or graph');
          return false;
        }

        // Get nodes using graph's getNodeById method
        const fromNode = this.graph.getNodeById(linkInfo.origin_id);
        const toNode = this.graph.getNodeById(linkInfo.target_id);
        
        console.log('Found nodes:', {
          fromNode: fromNode?.id,
          toNode: toNode?.id,
          fromNodeProps: fromNode?.properties,
          toNodeProps: toNode?.properties,
          thisNode: this.id
        });

        if (!fromNode || !toNode) {
          console.log('Nodes not found', { 
            fromNodeId: linkInfo.origin_id, 
            toNodeId: linkInfo.target_id
          });
          return false;
        }

        // Ensure properties exist
        if (!fromNode.properties || !toNode.properties) {
          console.log('Missing properties');
          return false;
        }

        // Handle connection based on type
        if (type === (window.LiteGraph as any).OUTPUT) {
          // Someone is connecting TO our output (we are fromNode)
          console.log('Handling output connection - we are source');
          return this.validateConnection(fromNode, toNode, slotIndex);
        } else {
          // Someone is connecting FROM their output TO our input (we are toNode)
          console.log('Handling input connection - we are target');
          return this.validateConnection(fromNode, toNode, slotIndex);
        }
      }

      validateConnection(fromNode: any, toNode: any, slotIndex: number): boolean {
        console.log('Validating connection:', {
          fromId: fromNode.id,
          toId: toNode.id,
          slotIndex,
          fromOutputs: fromNode.properties.outputs,
          toInputs: toNode.properties.inputs,
          thisNode: this.id
        });

        // Ensure we have schemas to validate
        if (!fromNode.properties.outputs || !toNode.properties.inputs) {
          console.log('Missing input/output schemas');
          return false;
        }

        // Get the relevant schemas
        const outputSchema = fromNode.properties.outputs[slotIndex];
        const inputSchema = toNode.properties.inputs[slotIndex];

        if (!outputSchema || !inputSchema) {
          console.log('Missing schema for slot:', slotIndex);
          return false;
        }

        // Check schema compatibility
        const isCompatible = outputSchema.id === inputSchema.id;
        console.log('Schema compatibility:', {
          outputSchema: outputSchema.id,
          inputSchema: inputSchema.id,
          isCompatible,
          fromNode: fromNode.id,
          toNode: toNode.id
        });

        return isCompatible;
      }
    }

    // Register the node class
    (window.LiteGraph as any).registerNodeType('assistant/node', AssistantNode);

    // Store reference to component in graph
    if (this.graph) {
      (this.graph as any).component = this;
    }
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
      const graphNode = window.LiteGraph.createNode('assistant/node');
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

  public async onDrop(event: DragEvent) {
    try {
      event.preventDefault();

      const data = event.dataTransfer?.getData('application/json');
      if (!data) {
        console.error('No data in drag event');
        return;
      }

      const assistant = JSON.parse(data);
      if (!this.graph || !this.canvas) {
        console.error('Graph or canvas not initialized');
        return;
      }

      // Get drop position relative to canvas
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Create node instance
      const node = window.LiteGraph.createNode('assistant/node') as any;
      if (!node) {
        console.error('Failed to create node');
        return;
      }

      // Set node position
      node.pos = [x, y];

      // Add node to graph first
      this.graph.add(node);

      // Ensure node has an ID
      if (!node.id) {
        node.id = ++this.graph.last_node_id;
      }

      // Register node in internal lookup for our own tracking
      this.nodeRegistry.set(node.id, node);

      console.log('Node added to graph:', {
        nodeId: node.id,
        graphNodes: Array.from(this.nodeRegistry.keys()),
        addedNode: this.graph.getNodeById(node.id)
      });

      // Then update schemas
      await this.updateNodeSchemas(node, assistant);

      // Update graph
      this.graph.setDirtyCanvas(true, true);
    } catch (error) {
      console.error('Error handling drop:', error);
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

      // Clear existing inputs/outputs
      graphNode.inputs = [];
      graphNode.outputs = [];

      // Update node properties with schema information
      graphNode.properties.inputs = config.inputs.map(schemaId => {
        const schema = this.schemaCache.get(schemaId);
        return {
          name: schema?.name || schemaId,
          type: schema?.name || schemaId, // Use schema name as type
          schemaId,
          description: schema?.description
        };
      });

      graphNode.properties.outputs = config.outputs.map(schemaId => {
        const schema = this.schemaCache.get(schemaId);
        return {
          name: schema?.name || schemaId,
          type: schema?.name || schemaId, // Use schema name as type
          schemaId,
          description: schema?.description
        };
      });

      // Update node appearance with labeled slots
      graphNode.inputs = graphNode.properties.inputs.map((input: IGraphNodeIO) => ({
        name: input.name,
        type: input.type,
        label: input.name,
        link: null,
        slot_index: graphNode.inputs.length
      }));

      graphNode.outputs = graphNode.properties.outputs.map((output: IGraphNodeIO) => ({
        name: output.name,
        type: output.type,
        label: output.name,
        links: [],
        slot_index: graphNode.outputs.length
      }));
      
      // Update node properties
      graphNode.properties.assistantId = assistant.id;
      graphNode.properties.name = assistant.name;
      graphNode.title = assistant.name;
      
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
