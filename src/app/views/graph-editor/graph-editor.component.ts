import { Component, ElementRef, OnInit, OnDestroy, ViewChild, NgZone, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssistantLibraryComponent } from '../../components/assistant-library/assistant-library.component';
import { FunctionLibraryComponent } from '../../components/function-library/function-library.component';
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
    graphEditor?: {
      hasUnsavedChanges: () => boolean;
    };
  }
}

@Component({
  selector: 'app-graph-editor',
  standalone: true,
  imports: [CommonModule, AssistantLibraryComponent, FunctionLibraryComponent],
  template: `
    <div class="graph-editor-container">
      <div class="sidebar" style="z-index: 3; background: rgb(24 24 24);">
        <app-assistant-library></app-assistant-library>
        <app-function-library></app-function-library>
      </div>
      <canvas 
        class="graph-canvas" 
        #graphCanvas
        (dragover)="onDragOver($event)"
        (drop)="onDrop($event)"
      >
      </canvas>
      <div class="toolbar" style="z-index:0">
        <button class="save-button" (click)="saveGraph()">Save Graph</button>
      </div>
    </div>
  `,
  styles: [`
    .graph-editor-container {
      display: flex;
      height: 100%;
      width: 100%;
      position: relative;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      width: 250px;
      border-right: 1px solid var(--surface-border);
    }

    .graph-canvas {
      flex: 1;
      height: 100%;
    }

    .toolbar {
      position: absolute;
      top: 1rem;
      right: 1rem;
    }

    .save-button {
      padding: 0.5rem 1rem;
      background: var(--primary-color);
      border: none;
      border-radius: 4px;
      color: white;
      cursor: pointer;
      
      &:hover {
        background: var(--primary-600);
      }
    }
  `]
})
export class GraphEditorComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('graphCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private graph: LiteGraph.LGraph | null = null;
  private canvas: LiteGraph.LGraphCanvas | null = null;
  private animationFrameId?: number;
  private isInitialized = false;
  private schemaCache = new Map<string, ObjectSchema>();
  private nodeRegistry = new Map<number, any>();
  private isDirty = false;
  private lastSavedState: string = '';

  constructor(
    private graphService: GraphService, 
    private configService: ConfigService, 
    private functionImplementationsService: FunctionImplementationsService,
    private objectSchemaService: ObjectSchemaService,
    private ngZone: NgZone
  ) {
    // Handle beforeunload event
    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Subscribe to project changes
    this.configService.activeProject$.subscribe(project => {
      if (project && this.isDirty) {
        const shouldSave = confirm('You have unsaved changes in your graph. Would you like to save them before switching projects?');
        if (shouldSave) {
          this.saveGraph();
        }
        this.markClean();
      }
    });
  }

  // Public method to check if there are unsaved changes
  public hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  private markDirty() {
    this.isDirty = true;
  }

  private markClean() {
    this.isDirty = false;
  }

  ngOnInit() {
    window.graphEditor = {
      hasUnsavedChanges: () => {
        return this.hasUnsavedChanges();
      }
    };
    this.initializeLiteGraph();
    
    // Subscribe to graph state changes
    this.graphService.currentState$.subscribe(state => {
      if (this.isInitialized && state) {
        this.loadGraphState(state);
      }
    });
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
    this.registerFunctionNodeType();

    // Then initialize graph
    this.initializeGraph();
    
    this.isInitialized = true;
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
        
        // Restore properties from saved state
        if (info.properties) {
          this.properties = info.properties;
          this.title = this.properties.name || "Assistant";

          // Clear existing inputs/outputs
          this.inputs.length = 0;
          this.outputs.length = 0;

          // Restore inputs
          if (this.properties.inputs) {
            this.properties.inputs.forEach((input: IGraphNodeIO) => {
              this.addInput(input.name, input.type);
            });
          }

          // Restore outputs
          if (this.properties.outputs) {
            this.properties.outputs.forEach((output: IGraphNodeIO) => {
              this.addOutput(output.name, output.type);
            });
          }
        }
        
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
        if (!linkInfo || !this.graph) {
          console.log('No linkInfo or graph');
          return false;
        }

        // Get nodes using graph's getNodeById method
        const fromNode = this.graph.getNodeById(linkInfo.origin_id);
        const toNode = this.graph.getNodeById(linkInfo.target_id);

        if (!fromNode || !toNode) {
          console.log('Nodes not found');
          return false;
        }

        // Ensure properties exist
        if (!fromNode.properties || !toNode.properties) {
          console.log('Missing properties');
          return false;
        }

        // Handle connection based on type
        if (type === (window.LiteGraph as any).OUTPUT) {
          return this.validateConnection(fromNode, toNode, slotIndex);
        } else {
          return this.validateConnection(fromNode, toNode, slotIndex);
        }
      }

      validateConnection(fromNode: any, toNode: any, slotIndex: number): boolean {
        // Get the relevant schemas
        const outputSchema = fromNode.properties.outputs[slotIndex];
        const inputSchema = toNode.properties.inputs[slotIndex];

        if (!outputSchema || !inputSchema) {
          console.log('Missing schema for slot:', slotIndex);
          return false;
        }

        // Check schema compatibility
        return outputSchema.id === inputSchema.id;
      }
    }

    // Register the node type
    window.LiteGraph.registerNodeType("assistant/node", AssistantNode);
    
    // Store reference to component in graph
    if (this.graph) {
      (this.graph as any).component = this;
    }
    
    console.log('Registered AssistantNode type');
  }

  private registerFunctionNodeType() {
    // Define the node class
    class FunctionNode extends (window.LiteGraph as any).LGraphNode {
      properties: {
        functionId: string;
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
        this.title = "Function";
        this.properties = {
          functionId: "",
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
        
        // Restore properties from saved state
        if (info.properties) {
          this.properties = info.properties;
          this.title = this.properties.name || "Function";

          // Clear existing inputs/outputs
          this.inputs.length = 0;
          this.outputs.length = 0;

          // Restore inputs
          if (this.properties.inputs) {
            this.properties.inputs.forEach((input: IGraphNodeIO) => {
              this.addInput(input.name, input.type);
            });
          }

          // Restore outputs
          if (this.properties.outputs) {
            this.properties.outputs.forEach((output: IGraphNodeIO) => {
              this.addOutput(output.name, output.type);
            });
          }
        }
        
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
      }

      onConnectionsChange(type: number, slotIndex: number, connected: boolean, linkInfo: any): boolean {
        if (!linkInfo || !this.graph) {
          console.log('No linkInfo or graph');
          return false;
        }

        // Get nodes using graph's getNodeById method
        const fromNode = this.graph.getNodeById(linkInfo.origin_id);
        const toNode = this.graph.getNodeById(linkInfo.target_id);

        if (!fromNode || !toNode) {
          console.log('Nodes not found');
          return false;
        }

        // Ensure properties exist
        if (!fromNode.properties || !toNode.properties) {
          console.log('Missing properties');
          return false;
        }

        // Handle connection based on type
        if (type === (window.LiteGraph as any).OUTPUT) {
          return this.validateConnection(fromNode, toNode, slotIndex);
        } else {
          return this.validateConnection(fromNode, toNode, slotIndex);
        }
      }

      validateConnection(fromNode: any, toNode: any, slotIndex: number): boolean {
        // Get the relevant schemas
        const outputSchema = fromNode.properties.outputs[slotIndex];
        const inputSchema = toNode.properties.inputs[slotIndex];

        if (!outputSchema || !inputSchema) {
          console.log('Missing schema for slot:', slotIndex);
          return false;
        }

        // Check schema compatibility
        return outputSchema.id === inputSchema.id;
      }
    }

    // Register the node type
    window.LiteGraph.registerNodeType("function/node", FunctionNode);
    
    // Store reference to component in graph
    if (this.graph) {
      (this.graph as any).component = this;
    }
    
    console.log('Registered FunctionNode type');
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
      this.canvas.render_connection_arrows = false;
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

        this.nodeRegistry.set(node.id, {
          id: node.id.toString(),
          assistantId: node.properties?.assistantId || '',
          functionId: node.properties?.functionId || '',
          name: node.properties?.name || '',
          inputs: node.properties?.inputs || [],
          outputs: node.properties?.outputs || [],
          position: {
            x: node.pos[0],
            y: node.pos[1]
          }
        });
        
        console.log('Node registered:', this.nodeRegistry.get(node.id));
        this.markDirty();

        // Add remove listener to the node
        node.onRemoved = () => {
          // Remove from registry when node is removed
          this.nodeRegistry.delete(node.id);
          console.log('Node removed from registry:', node.id);
          this.markDirty();
        };
      };

      // Track connections using connectionChange event
      this.graph.connectionChange = (node: any) => {
        this.markDirty();
      };

      // Track node movement using canvas events
      if (this.canvas) {
        this.canvas.onNodeMoved = (node: any) => {
          const registryNode = this.nodeRegistry.get(node.id);
          if (registryNode) {
            registryNode.position = {
              x: node.pos[0],
              y: node.pos[1]
            };
            this.nodeRegistry.set(node.id, registryNode);
          }
          this.markDirty();
        };
      }
      
      // Start graph execution
      this.graph.start();

      // Load saved state
      const state = this.graphService.state;
      this.loadGraphState(state);
      this.markClean(); // Initial state is clean
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

    console.log('Loading graph state:', state);

    // Clear existing graph
    this.graph.clear();
    this.nodeRegistry.clear();

    // Load nodes
    state.nodes.forEach(node => {
      console.log('Loading node:', node);
      
      // Convert string ID to number for LiteGraph
      const numericId = parseInt(node.id);
      if (numericId > this.graph!.last_node_id) {
        this.graph!.last_node_id = numericId;
      }

      // Create node with proper type
      const nodeType = node.functionId ? 'function/node' : 'assistant/node';
      const graphNode = window.LiteGraph.createNode(nodeType) as LiteGraph.LGraphNode;
      if (graphNode) {
        // Set position and ID
        graphNode.pos = [node.position.x, node.position.y];
        graphNode.id = numericId;
        
        // Configure the node with saved properties
        graphNode.configure({
          id: numericId,
          type: nodeType,
          pos: [node.position.x, node.position.y],
          size: [180, 60],
          properties: {
            assistantId: node.assistantId,
            functionId: node.functionId,
            name: node.name,
            inputs: node.inputs || [],
            outputs: node.outputs || []
          },
          flags: {},
          mode: 0,
          inputs: (node.inputs || []).map((input: any) => ({
            name: input.name,
            type: input.type,
            link: null
          })),
          outputs: (node.outputs || []).map((output: any) => ({
            name: output.name,
            type: output.type,
            links: null
          })),
          title: node.name || (node.functionId ? "Function" : "Assistant")
        });

        // Add to graph
        this.graph!.add(graphNode);
        
        console.log('Created graph node:', {
          id: graphNode.id,
          properties: graphNode.properties,
          inputs: graphNode.inputs,
          outputs: graphNode.outputs
        });

        // Store the original node data in registry
        this.nodeRegistry.set(numericId, node);
      }
    });

    // Load connections after all nodes are created
    state.connections.forEach(conn => {
      console.log('Loading connection:', conn);
      const fromId = parseInt(conn.fromNode);
      const toId = parseInt(conn.toNode);
      const fromNode = this.graph!.getNodeById(fromId);
      const toNode = this.graph!.getNodeById(toId);

      console.log('Found nodes for connection:', {
        fromNode: fromNode ? { id: fromNode.id, properties: fromNode.properties } : null,
        toNode: toNode ? { id: toNode.id, properties: toNode.properties } : null
      });

      if (fromNode && toNode) {
        const fromSlot = parseInt(conn.fromOutput);
        const toSlot = parseInt(conn.toInput);
        fromNode.connect(fromSlot, toNode, toSlot);
      }
    });

    // Force a redraw
    if (this.canvas) {
      this.canvas.setDirty(true, true);
    }
    this.markClean();
  }

  private createAssistantNode(assistantId: string, name: string, position: [number, number]): LiteGraph.LGraphNode | null {
    console.log('Creating assistant node:', { assistantId, name, position });
    
    if (!this.graph) {
      console.error('Cannot create node: graph not initialized');
      return null;
    }

    const node = window.LiteGraph.createNode('assistant/node') as LiteGraph.LGraphNode;
    if (!node) {
      console.error('Failed to create assistant node');
      return null;
    }

    // Set node properties
    node.properties = {
      assistantId,
      name,
      inputs: [],
      outputs: []
    };

    console.log('Node properties set:', node.properties);

    // Set position
    node.pos = position;

    // Add to graph
    this.graph.add(node);

    return node;
  }

  private createFunctionNode(functionId: string, name: string, position: [number, number]): LiteGraph.LGraphNode | null {
    if (!this.graph) {
      console.error('Cannot create node: graph not initialized');
      return null;
    }

    // Create node instance
    const node = window.LiteGraph.createNode('function/node') as LiteGraph.LGraphNode;
    if (!node) {
      console.error('Failed to create function node');
      return null;
    }

    // Set node properties
    node.properties = {
      functionId,
      name,
      inputs: [],
      outputs: []
    };

    console.log('Node properties set:', node.properties);

    // Set position
    node.pos = position;

    // Add to graph
    this.graph.add(node);

    return node;
  }

  private findSlotIndex(node: LiteGraph.LGraphNode, slotName: string, type: 'input' | 'output'): number {
    const slots = type === 'input' ? node.inputs : node.outputs;
    return slots?.findIndex(slot => slot.name === slotName) ?? -1;
  }

  async saveGraph() {
    try {
      if (!this.graph) {
        console.error('Cannot save graph: graph not initialized');
        return;
      }

      const nodes = Array.from(this.nodeRegistry.values()).map(node => {
          return {
          id: node.id,
          assistantId: node.assistantId,
          functionId: node.functionId,
          name: node.name,
          inputs: node.inputs,
          outputs: node.outputs,
          position: {
            x: node.position.x,
            y: node.position.y
          }
        }
      });

      const links = this.graph.links ? Object.values(this.graph.links) : [];
      const connections = links.map(link => ({
        fromNode: link.origin_id.toString(),
        fromOutput: link.origin_slot.toString(),
        toNode: link.target_id.toString(),
        toInput: link.target_slot.toString()
      }));

      const newState = {
        nodes,
        connections
      };

      // First update the in-memory state
      this.graphService.updateState(newState);
      
      // Then persist to disk
      await this.graphService.saveGraph();
      
      this.markClean();
    } catch (error) {
      console.error('Error saving graph:', error);
    }
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

      const nodeData = JSON.parse(data);
      if (!this.graph || !this.canvas) {
        console.error('Graph or canvas not initialized');
        return;
      }

      // Get drop position relative to canvas
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Create appropriate node type
      let node;
      if (nodeData.type === 'function/node') {
        node = this.createFunctionNode(nodeData.id, nodeData.name, [x, y]);
        if (node && nodeData.inputs && nodeData.outputs) {
          node.properties.inputs = nodeData.inputs;
          node.properties.outputs = nodeData.outputs;
          
          // Add inputs and outputs to the node
          nodeData.inputs.forEach((input: any) => {
            node.addInput(input.name, input.type);
          });
          
          nodeData.outputs.forEach((output: any) => {
            node.addOutput(output.name, output.type);
          });
        }
        await this.updateFunctionNodeSchemas(node, nodeData);
      } else {
        // Handle assistant node
        node = this.createAssistantNode(nodeData.id, nodeData.name, [x, y]);
      }

      if (!node) {
        console.error('Failed to create node');
        return;
      }

      // If it's an assistant node, update its schemas
      if (nodeData.type !== 'function/node') {
        await this.updateNodeSchemas(node, nodeData);
      }

      this.markDirty();
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  }

  private async updateNodeSchemas(graphNode: LiteGraph.LGraphNode, assistant: any) {
    try {
      const activeProfile = await this.configService.getActiveProfile();
      if (!activeProfile) return;

      const activeProject = await this.configService.getActiveProject();
      if (!activeProject) return;

      const config = await this.functionImplementationsService.loadFunctionImplementations(
        activeProfile.id,
        activeProject.id,
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
          type: schema?.name || schemaId,
          schemaId,
          description: schema?.description
        };
      });

      graphNode.properties.outputs = config.outputs.map(schemaId => {
        const schema = this.schemaCache.get(schemaId);
        return {
          name: schema?.name || schemaId,
          type: schema?.name || schemaId,
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
      // Update node registry with the new inputs and outputs
      const existingNode = this.nodeRegistry.get(graphNode.id);
      if (existingNode) {
        this.nodeRegistry.set(graphNode.id, {
          ...existingNode,
          name: assistant.name,
          inputs: graphNode.properties.inputs,
          outputs: graphNode.properties.outputs
        });
      }
      
      // Force node to resize based on new slots
      graphNode.size = graphNode.computeSize();
      if (this.canvas) {
        this.canvas.setDirty(true, true);
      }
    } catch (error) {
      console.error('Failed to update node schemas:', error);
    }
  }

  private async updateFunctionNodeSchemas(graphNode: LiteGraph.LGraphNode, nodeData: any) {
    try {
      // Load all schemas first
      await Promise.all(
        [...nodeData.inputs, ...nodeData.outputs].map(async (io: any) => {
          if (!this.schemaCache.has(io.schemaId)) {
            const schema = await this.objectSchemaService.getSchema(io.schemaId);
            if (schema) {
              this.schemaCache.set(io.schemaId, schema);
            }
          }
        })
      );

      // Update node properties with schema information
      graphNode.properties.inputs = nodeData.inputs.map((input: any) => {
        const schema = this.schemaCache.get(input.schemaId);
        return {
          name: schema?.name || input.schemaId,
          type: schema?.name || input.schemaId,
          schemaId: input.schemaId,
          description: schema?.description
        };
      });

      graphNode.properties.outputs = nodeData.outputs.map((output: any) => {
        const schema = this.schemaCache.get(output.schemaId);
        return {
          name: schema?.name || output.schemaId,
          type: schema?.name || output.schemaId,
          schemaId: output.schemaId,
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
      graphNode.properties.functionId = nodeData.id;
      graphNode.properties.name = nodeData.name;
      graphNode.title = nodeData.name;

      // Update node registry
      const existingNode = this.nodeRegistry.get(graphNode.id);
      if (existingNode) {
        this.nodeRegistry.set(graphNode.id, {
          ...existingNode,
          name: nodeData.name,
          inputs: graphNode.properties.inputs,
          outputs: graphNode.properties.outputs
        });
      }
      
      // Force node to resize based on new slots
      graphNode.size = graphNode.computeSize();
      if (this.canvas) {
        this.canvas.setDirty(true, true);
      }
    } catch (error) {
      console.error('Failed to update function node schemas:', error);
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
