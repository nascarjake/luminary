import { Component, ElementRef, ViewChild, Input, Output, EventEmitter, AfterViewInit, OnDestroy, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { defaultKeymap } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { MultiSelectModule } from 'primeng/multiselect'; // Add this import
import { ObjectSchema } from '../../interfaces/object-system';
import { ObjectSchemaService } from '../../services/object-schema.service';

export interface FunctionDefinition {
  name: string;
  description: string;
  strict?: boolean;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
  implementation?: {
    command: string;
    script: string;
    workingDir?: string;
    timeout?: number;
    isOutput?: boolean;
    outputSchema?: string;
    environmentVariables?: Record<string, string>;
  };
  inputs?: string[];
  outputs?: string[];
}

const DEFAULT_FUNCTION: FunctionDefinition = {
  name: '',
  description: '',
  strict: false,
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false
  },
  implementation: {
    command: '',
    script: '',
    workingDir: '',
    timeout: 30000, 
    isOutput: false,
    outputSchema: undefined,
    environmentVariables: {}
  }
};

@Component({
  selector: 'app-function-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    DropdownModule,
    TableModule,
    MultiSelectModule  // Add this import
  ],
  template: `
    <p-dialog 
      [(visible)]="visible"
      [modal]="true"
      [header]="isEditing ? 'Edit Function' : 'Add Function'"
      [style]="{width: '800px', height: '83vh'}"
      (onHide)="onCancel()"
      [contentStyle]="{'padding': '0'}"
      [draggable]="false"
    >
      <div class="function-editor">
        <div class="editor-sections">
          <div class="standalone-section" *ngIf="standalone">
            <h3>Function Details</h3>
            <p class="section-description">Define the basic properties of your function</p>
            <div class="implementation-form">
              <div class="form-field">
                <label>Function Name</label>
                <input type="text" pInputText [(ngModel)]="functionName" 
                       [style]="{'width': '100%'}"
                       placeholder="e.g., Process Video, Generate Thumbnail">
                <small>A descriptive name that explains what this function does</small>
              </div>

              <div class="form-field">
                <label>Input Schemas</label>
                <p-multiSelect
                  [options]="availableSchemas"
                  [(ngModel)]="selectedInputs"
                  [style]="{'width': '100%'}"
                  optionLabel="name"
                  optionValue="id"
                  placeholder="Select input schemas"
                  [filter]="true"
                ></p-multiSelect>
                <small>Select the schemas that this function accepts as input</small>
              </div>

              <div class="form-field">
                <label>Output Schemas</label>
                <p-multiSelect
                  [options]="availableSchemas"
                  [(ngModel)]="selectedOutputs"
                  [style]="{'width': '100%'}"
                  optionLabel="name"
                  optionValue="id"
                  placeholder="Select output schemas"
                  [filter]="true"
                ></p-multiSelect>
                <small>Select the schemas that this function produces as output</small>
              </div>
            </div>
          </div>

          <div class="definition-section" *ngIf="!standalone">
            <h3>Function Definition</h3>
            <p class="section-description">Define how the AI should call this function</p>
            <div class="editor-container" #editorContainer></div>
            <div *ngIf="error" class="error-message">{{ error }}</div>
          </div>

          <div class="output-section" *ngIf="functionImpl && !standalone">
            <div class="p-field-checkbox">
              <p-checkbox [(ngModel)]="functionImpl.isOutput" [binary]="true" inputId="isOutput"></p-checkbox>
              <label for="isOutput" class="p-checkbox-label">Is Output Function</label>
            </div>
            <small>Mark this function as responsible for output formatting</small>

            <div class="form-field" *ngIf="functionImpl?.isOutput">
              <label>Output Schema</label>
              <p-dropdown 
                [(ngModel)]="functionImpl.outputSchema"
                [options]="availableSchemas"
                optionLabel="name"
                optionValue="id"
                placeholder="Select an output schema"
                [style]="{'width': '100%'}"
                (onChange)="onOutputSchemaChange()"
              ></p-dropdown>
              <small>Select the schema this function will output</small>
            </div>
          </div>
          
          <div class="implementation-section">
            <h3>Implementation</h3>
            <p class="section-description">Define how to execute this function</p>
            <div class="implementation-form" *ngIf="functionImpl">
              <div class="form-field">
                <label>Command</label>
                <input type="text" pInputText [(ngModel)]="functionImpl.command" 
                       placeholder="e.g., python, node, bash">
                <small>The command to execute (e.g., python, node)</small>
              </div>
              
              <div class="form-field">
                <label>Script Path</label>
                <div class="p-inputgroup">
                  <input type="text" pInputText [(ngModel)]="functionImpl.script" 
                         placeholder="e.g., scripts/my_function.py">
                  <button pButton type="button" icon="pi pi-folder-open" 
                          (click)="browseScript()" 
                          pTooltip="Browse for script file"></button>
                </div>
                <small>Path to the script file relative to working directory</small>
              </div>
              
              <div class="form-field">
                <label>Working Directory</label>
                <div class="p-inputgroup">
                  <input type="text" pInputText [(ngModel)]="functionImpl.workingDir" 
                         placeholder="Optional: /path/to/working/dir">
                  <button pButton type="button" icon="pi pi-folder-open" 
                          (click)="browseWorkingDir()" 
                          pTooltip="Browse for working directory"></button>
                </div>
                <small>Optional: Working directory for the script</small>
              </div>
              
              <div class="form-field">
                <label>Timeout (ms)</label>
                <p-inputNumber [(ngModel)]="functionImpl.timeout" 
                             [min]="1000" [max]="300000" [step]="1000"
                             placeholder="30000">
                </p-inputNumber>
                <small>Maximum execution time in milliseconds (1000-300000)</small>
              </div>

              <div class="form-field">
                <label>Environment Variables</label>
                <p-table [value]="envVars">
                  <ng-template pTemplate="header">
                    <tr>
                      <th>Key</th>
                      <th>Value</th>
                      <th></th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-envVar let-index="rowIndex">
                    <tr>
                      <td>{{ envVar.key }}</td>
                      <td>{{ envVar.value }}</td>
                      <td>
                        <button pButton type="button" icon="pi pi-trash" 
                                (click)="removeEnvVar(index)" 
                                pTooltip="Remove environment variable"></button>
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
                <div class="p-inputgroup">
                  <input type="text" pInputText [(ngModel)]="newEnvVar.key" 
                         placeholder="Key">
                  <input type="text" pInputText [(ngModel)]="newEnvVar.value" 
                         placeholder="Value">
                  <button pButton type="button" icon="pi pi-plus" 
                          (click)="addEnvVar()" 
                          pTooltip="Add environment variable"></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <div *ngIf="error" class="error-message" style="color: red">{{ error }}</div>
        <p-button 
          label="Cancel" 
          (onClick)="onCancel()" 
          styleClass="p-button-text"
        ></p-button>
        <p-button 
          label="Save" 
          (onClick)="onSave()"
        ></p-button>
      </div>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    .dialog-content {
      height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .form-field {
      margin-bottom: 1rem;
    }

    .form-field label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .form-field small {
      display: block;
      margin-top: 0.25rem;
      color: #666;
    }

    .editor-container {
      flex: 1;
      overflow: hidden;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    .dialog-footer {
      margin-top: 1rem;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid var(--surface-border);
      background-color: var(--surface-section);
    }

    .p-inputgroup {
      display: flex;
      align-items: center;
    }
    .p-inputgroup .p-button {
      margin-left: 4px;
    }
    :host ::ng-deep {
      .p-table {
        margin-bottom: 0.5rem;
      }

      .p-button.p-button-icon-only {
        width: 2rem;
      }
    }

    .function-editor {
      background-color: var(--surface-ground);
      border-radius: 6px;
      overflow: hidden;
      height: 700px;

      .editor-sections {
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
        overflow-y: auto;

        h3 {
          margin: 0;
          color: var(--primary-color);
          font-size: 1.2rem;
        }

        .section-description {
          color: var(--text-color-secondary);
          font-size: 0.875rem;
          margin: 0.5rem 0 1rem;
        }

        .standalone-section {
          background: var(--surface-section);
          border-radius: 6px;
          padding: 1rem;

          .implementation-form {
            display: flex;
            flex-direction: column;
            gap: 1rem;

            .form-field {
              display: flex;
              flex-direction: column;
              gap: 0.5rem;

              label {
                font-weight: 500;
                color: var(--text-color);
              }

              small {
                color: var(--text-color-secondary);
              }

              input {
                width: 100%;
              }
            }
          }
        }

        .definition-section {
          flex: 1;
          min-height: 400px;
          
          .editor-container {
            height: calc(100% - 80px);
            background-color: var(--surface-section);
            border-radius: 6px;
            overflow: hidden;

            :host ::ng-deep .cm-editor {
              height: 100%;

              .cm-scroller {
                font-family: 'JetBrains Mono', monospace;
                padding: 1rem;
              }

              .cm-gutters {
                background-color: var(--surface-section);
                border: none;
              }

              .cm-activeLineGutter,
              .cm-activeLine {
                background-color: var(--surface-hover);
              }

              .cm-line {
                padding: 0 0.5rem;
              }
            }
          }
        }

        .implementation-section {
          background: var(--surface-section);
          border-radius: 6px;
          padding: 1rem;

          .implementation-form {
            display: flex;
            flex-direction: column;
            gap: 1rem;

            .form-field {
              display: flex;
              flex-direction: column;
              gap: 0.5rem;

              label {
                font-weight: 500;
                color: var(--text-color);
              }

              small {
                color: var(--text-color-secondary);
              }

              input, p-inputNumber {
                width: 100%;
              }
            }
          }
        }
      }

      .error-message {
        color: var(--red-500);
        margin-top: 0.5rem;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid var(--surface-border);
      background-color: var(--surface-section);
    }

    .p-inputgroup {
      display: flex;
      align-items: center;
    }
    .p-inputgroup .p-button {
      margin-left: 4px;
    }
  `]
})
export class FunctionEditorComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('editorContainer') private editorContainer!: ElementRef;
  @Input() function: FunctionDefinition | null = null;
  @Input() outputSchemas: ObjectSchema[] = []; 
  @Input() arraySchemas: { inputs: string[], outputs: string[] } = { inputs: [], outputs: [] };
  @Input() standalone = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<FunctionDefinition>();
  @Output() cancel = new EventEmitter<void>();

  private editor?: EditorView;
  error: string | null = null;
  isEditing = false;
  functionImpl: FunctionDefinition['implementation'] | null = null;
  availableSchemas: { id: string; name: string }[] = [];
  envVars: { key: string, value: string }[] = [];
  newEnvVar = { key: '', value: '' };
  private editorExtensions = [
    basicSetup,
    json(),
    keymap.of(defaultKeymap),
    oneDark,
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        this.validateJson(update.state.doc.toString());
      }
    }),
    EditorView.theme({
      "&": {height: "100%"},
      ".cm-scroller": {overflow: "auto"}
    })
  ];

  selectedInputs: string[] = [];
  selectedOutputs: string[] = [];

  constructor(
    private objectSchemaService: ObjectSchemaService
  ) {
    console.log('FunctionEditor constructor');
  }

  private async loadSchemas() {
    try {
      const schemas = await this.objectSchemaService.listSchemas();
      this.availableSchemas = (schemas || []).map(schema => ({
        id: schema.id,
        name: schema.name
      }));
    } catch (error) {
      console.error('Failed to load schemas:', error);
      this.availableSchemas = [];
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('FunctionEditor changes:', changes);
    if (changes['function'] && !changes['function'].firstChange) {
      console.log('Function changed:', changes['function'].currentValue);
      // Initialize implementation form when function changes
      const initialFunction = this.function || DEFAULT_FUNCTION;
      this.functionImpl = initialFunction.implementation 
        ? { ...initialFunction.implementation } 
        : { ...DEFAULT_FUNCTION.implementation! };
      this.isEditing = !!this.function;
      this.functionName = initialFunction.name;
      
      // Initialize selected inputs/outputs if in standalone mode
      if (this.standalone && initialFunction.inputs && initialFunction.outputs) {
        this.selectedInputs = initialFunction.inputs;
        this.selectedOutputs = initialFunction.outputs;
      }
    }


    this.loadSchemas();
    

    // Initialize environment variables from function implementation
    this.envVars = Object.entries(this.functionImpl?.environmentVariables || {})
      .map(([key, value]) => ({ key, value }));

    // If this is an output function, find and select the matching schema
    if (this.functionImpl?.isOutput && this.functionImpl?.outputSchema) {
      const selectedSchema = this.outputSchemas.find(s => s.id === this.functionImpl?.outputSchema);
      if (selectedSchema) {
        this.functionImpl.outputSchema = selectedSchema.id;
      }
    }

    console.log('Initialized functionImpl:', this.functionImpl);
  }

  @Input()
  set visible(value: boolean) {
    console.log('Setting visible:', value, 'Current function:', this.function);
    if (this._visible === value) return; // Don't re-run if value hasn't changed
    
    this._visible = value;
    this.visibleChange.emit(value);

    if (value) {
      // Initialize implementation form when dialog opens
      const initialFunction = this.function || DEFAULT_FUNCTION;
      console.log('Initial function:', initialFunction);
      this.functionImpl = initialFunction.implementation 
        ? { ...initialFunction.implementation } 
        : { ...DEFAULT_FUNCTION.implementation! };
      this.functionName = initialFunction.name;
      console.log('Set functionImpl:', this.functionImpl);
      this.isEditing = !!this.function;

      // Initialize environment variables from function implementation
      this.envVars = Object.entries(this.functionImpl.environmentVariables || {})
        .map(([key, value]) => ({ key, value }));

      // If this is an output function, find and select the matching schema
      if (this.functionImpl?.isOutput && this.functionImpl?.outputSchema) {
        const selectedSchema = this.outputSchemas.find(s => s.id === this.functionImpl?.outputSchema);
        if (selectedSchema) {
          this.functionImpl.outputSchema = selectedSchema.id;
        }
      }

      this.loadSchemas();
      // Initialize editor after view is ready
      setTimeout(() => {
        this.initializeEditor();
      });
    } else {
      // Clean up editor when dialog closes
      this.editor?.destroy();
      this.editor = undefined;
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  private _visible = false;
  functionName = '';

  ngAfterViewInit() {
    // Remove editor initialization from ngAfterViewInit
  }

  ngOnDestroy() {
    this.editor?.destroy();
  }

  private initializeEditor() {
    // Destroy existing editor if it exists
    if (this.editor) {
      this.editor.destroy();
    }

    // Only initialize if we have the container
    if (!this.editorContainer?.nativeElement) {
      return;
    }

    const startState = EditorState.create({
      doc: this.getInitialDoc(),
      extensions: this.editorExtensions
    });

    this.editor = new EditorView({
      state: startState,
      parent: this.editorContainer.nativeElement
    });
  }

  private getInitialDoc(): string {
    const initialFunction = this.function || DEFAULT_FUNCTION;
    const { implementation, ...functionDef } = initialFunction;
    return JSON.stringify(functionDef, null, 2);
  }

  private validateJson(jsonString: string): boolean {
    if (this.standalone) {
      // Skip JSON validation in standalone mode
      return true;
    }
    try {
      const parsed = JSON.parse(jsonString);
      // Validate required fields
      if (!parsed.name) {
        this.error = 'Name is required';
        return false;
      }
      if (!parsed.description) {
        this.error = 'Description is required';
        return false;
      }
      if (!parsed.parameters || typeof parsed.parameters !== 'object') {
        this.error = 'Parameters must be an object';
        return false;
      }
      this.error = null;
      return true;
    } catch (e) {
      this.error = 'Invalid JSON';
      return false;
    }
  }

  // Add method to generate JSON for output schema
  private generateOutputParameters(schema: ObjectSchema): any {
    const schemaFields = this.generateFieldsBySchema(schema);
    const isArray = this.isSchemaArray(schema.id, false); // false for output schemas
    
    if (isArray) {
      return {
        type: 'object',
        properties: {
          result: {
            type: 'array',
            items: {
              type: 'object',
              ...schemaFields
            },
            description: `Array of ${schema.name} objects`
          }
        },
        required: ['result']
      };
    } else {
      return {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            ...schemaFields,
            description: `${schema.name} object`
          }
        },
        required: ['result']
      };
    }
  }

  // Helper method to generate fields from schema
  private generateFieldsBySchema(schema: ObjectSchema): any {
    const properties: any = {};
    const required: string[] = [];

    if (schema.fields) {
      schema.fields.forEach(field => {
        const fieldSchema: any = {
          type: field.type.toLowerCase(),
          description: field.description || `${field.name} field`
        };

        // Handle array type and its validation
        if (field.type === 'array' && field.validation?.items?.type) {
          fieldSchema.items = {
            type: field.validation.items.type.toLowerCase()
          };

          // Add validation rules for array items if present
          if (field.validation.items.validation) {
            Object.entries(field.validation.items.validation).forEach(([key, value]) => {
              if (value !== undefined && 
                  value !== null && 
                  value !== '' && 
                  !(Array.isArray(value) && value.length === 0)) {
                fieldSchema.items[key] = value;
              }
            });
          }

          // Add array-specific validation (minItems, maxItems)
          if (field.validation.minItems !== undefined && field.validation.minItems !== null) {
            fieldSchema.minItems = field.validation.minItems;
          }
          if (field.validation.maxItems !== undefined && field.validation.maxItems !== null) {
            fieldSchema.maxItems = field.validation.maxItems;
          }
        }

        properties[field.name] = fieldSchema;

        if (field.required) {
          required.push(field.name);
        }
      });
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    };
  }

  isSchemaArray(schemaId: string, isInput: boolean): boolean {
    const arrayList = isInput ? this.arraySchemas.inputs : this.arraySchemas.outputs;
    return arrayList.includes(schemaId);
  }

  // Watch for changes to output schema selection
  onOutputSchemaChange() {
    if (this.functionImpl?.isOutput && this.functionImpl?.outputSchema && this.editor) {
      const selectedSchema = this.outputSchemas.find(s => s.id === this.functionImpl?.outputSchema);
      if (selectedSchema) {
        // Get current function definition
        let currentDef;
        try {
          currentDef = JSON.parse(this.editor.state.doc.toString() || '{}');
        } catch (e) {
          currentDef = {};
        }

        // Generate new parameters for the selected schema
        const parameters = this.generateOutputParameters(selectedSchema);
        
        // Update the function definition with new parameters
        const updatedDef = {
          ...currentDef,
          parameters,
        };

        if(!updatedDef.description) {
          updatedDef.description = `Send ${selectedSchema.name} output to the next stage`;
        }

        if(!updatedDef.name) {
          updatedDef.name = `myFunction`;
        }

        // Create a new state with the updated content
        const newState = EditorState.create({
          doc: JSON.stringify(updatedDef, null, 2),
          extensions: this.editorExtensions
        });

        // Replace the entire state
        this.editor.setState(newState);
      }
    }
  }

  addEnvVar() {
    if (this.newEnvVar.key && this.newEnvVar.value) {
      this.envVars.push({ ...this.newEnvVar });
      this.newEnvVar = { key: '', value: '' };
    }
  }

  removeEnvVar(index: number) {
    this.envVars.splice(index, 1);
  }

  onSave() {
    if (!this.functionImpl) return;

    if (this.standalone) {
      if (!this.functionName.trim()) {
        this.error = 'Function name is required';
        return;
      }
      if (!this.functionImpl.command?.trim()) {
        this.error = 'Command is required';
        return;
      }
      if (!this.functionImpl.script?.trim()) {
        this.error = 'Script is required';
        return;
      }
    }

    // Update environment variables in implementation
    this.functionImpl.environmentVariables = this.envVars.reduce((acc, { key, value }) => {
      if (key && value) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    let functionToSave: FunctionDefinition;

    if (this.standalone) {
      // In standalone mode, we only care about the implementation details
      functionToSave = {
        name: this.functionName.trim(),
        description: '',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        },
        implementation: this.functionImpl,
        inputs: this.selectedInputs,  // Add selected inputs
        outputs: this.selectedOutputs  // Add selected outputs
      };
    } else {
      // In normal mode, parse the JSON editor content
      try {
        const editorContent = this.editor?.state.doc.toString() || '{}';
        functionToSave = JSON.parse(editorContent);
        functionToSave.implementation = this.functionImpl;
      } catch (e) {
        this.error = 'Invalid JSON in editor';
        return;
      }
    }

    this.save.emit(functionToSave);
    this.visible = false;
  }

  onCancel() {
    this.cancel.emit();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async browseScript() {
    try {
      const result = await window.electron.dialog.showOpenDialog({
        title: 'Select Script File',
        properties: ['openFile'],
        filters: [
          { name: 'Scripts', extensions: ['py', 'js', 'sh', 'bat', 'cmd'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        // Get the selected file path
        const filePath = result.filePaths[0];
        // If there's a working directory set, try to make the path relative
        if (this.functionImpl?.workingDir) {
          // We'll add the relative path functionality in a moment
          this.functionImpl.script = filePath;
          // Request relative path from main process
          const baseDir = this.functionImpl.workingDir;
          try {
            // Use the path API through electron
            const relativePath = await window.electron.path.relative(baseDir, filePath);
            this.functionImpl.script = relativePath;
          } catch (error) {
            console.error('Error making path relative:', error);
            // Fallback to absolute path
            this.functionImpl.script = filePath;
          }
        } else {
          // No working directory set, use absolute path
          this.functionImpl.script = filePath;
        }
      }
    } catch (error) {
      console.error('Error browsing for script:', error);
    }
  }

  async browseWorkingDir() {
    try {
      const result = await window.electron.dialog.showOpenDialog({
        title: 'Select Working Directory',
        properties: ['openDirectory']
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        this.functionImpl.workingDir = result.filePaths[0];
      }
    } catch (error) {
      console.error('Error browsing for working directory:', error);
    }
  }
}
