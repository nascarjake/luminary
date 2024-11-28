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
import { ObjectSchema } from '../../interfaces/object-system';

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
  };
}

const DEFAULT_FUNCTION: FunctionDefinition = {
  name: '',
  description: '',
  strict: false,
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  implementation: {
    command: '',
    script: '',
    workingDir: '',
    timeout: 30000, 
    isOutput: false,
    outputSchema: undefined
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
    DropdownModule
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
          <div class="">
            <div class="p-field-checkbox" *ngIf="functionImpl">
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

          <div class="definition-section">
            <h3>Function Definition</h3>
            <p class="section-description">Define how the AI should call this function</p>
            <div class="editor-container" #editorContainer></div>
            <div *ngIf="error" class="error-message">{{ error }}</div>
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

              
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <p-button 
          label="Cancel" 
          (onClick)="onCancel()" 
          styleClass="p-button-text"
        ></p-button>
        <p-button 
          label="Save" 
          (onClick)="onSave()"
          [disabled]="!!error"
        ></p-button>
      </div>
    </p-dialog>
  `,
  styles: [`
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
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<FunctionDefinition>();
  @Output() cancel = new EventEmitter<void>();

  private editor?: EditorView;
  error: string | null = null;
  isEditing = false;
  functionImpl: FunctionDefinition['implementation'] | null = null;
  availableSchemas: any[] = [];
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

  constructor() {
    console.log('FunctionEditor constructor');
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

      // If this is an output function, find and select the matching schema
      if (this.functionImpl?.isOutput && this.functionImpl?.outputSchema) {
        const selectedSchema = this.outputSchemas.find(s => s.id === this.functionImpl?.outputSchema);
        if (selectedSchema) {
          this.functionImpl.outputSchema = selectedSchema.id;
        }
      }

      console.log('Initialized functionImpl:', this.functionImpl);
    }
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
      console.log('Set functionImpl:', this.functionImpl);
      this.isEditing = !!this.function;

      // If this is an output function, find and select the matching schema
      if (this.functionImpl?.isOutput && this.functionImpl?.outputSchema) {
        const selectedSchema = this.outputSchemas.find(s => s.id === this.functionImpl?.outputSchema);
        if (selectedSchema) {
          this.functionImpl.outputSchema = selectedSchema.id;
        }
      }

      // Update available schemas when dialog opens
      this.availableSchemas = this.outputSchemas;

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
    try {
      const parsed = JSON.parse(jsonString);
      
      // Validate required fields
      if (!parsed.name || typeof parsed.name !== 'string') {
        throw new Error('Function must have a name');
      }
      if (!parsed.description || typeof parsed.description !== 'string') {
        throw new Error('Function must have a description');
      }
      if (!parsed.parameters || typeof parsed.parameters !== 'object') {
        throw new Error('Function must have parameters object');
      }
      if (!parsed.parameters.type || parsed.parameters.type !== 'object') {
        throw new Error('Parameters must have type: "object"');
      }
      if (!parsed.parameters.properties || typeof parsed.parameters.properties !== 'object') {
        throw new Error('Parameters must have properties object');
      }
      if (!Array.isArray(parsed.parameters.required)) {
        throw new Error('Parameters must have required array');
      }

      this.error = null;
      return true;
    } catch (e) {
      this.error = e.message;
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
        properties[field.name] = {
          type: field.type.toLowerCase(),
          description: field.description || `${field.name} field`
        };
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

  onSave() {
    if (!this.editor) return;
    
    const jsonString = this.editor.state.doc.toString();
    if (this.validateJson(jsonString)) {
      const functionDef = JSON.parse(jsonString);
      // Merge the implementation details with the function definition
      const fullFunction: FunctionDefinition = {
        ...functionDef,
        implementation: this.functionImpl || undefined
      };
      this.save.emit(fullFunction);
      this.visible = false;
      this.visibleChange.emit(false);
    }
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
