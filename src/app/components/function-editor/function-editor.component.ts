import { Component, ElementRef, ViewChild, Input, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { defaultKeymap } from '@codemirror/commands';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

export interface FunctionDefinition {
  name: string;
  description: string;
  strict?: boolean;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

const DEFAULT_FUNCTION: FunctionDefinition = {
  name: '',
  description: '',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
};

@Component({
  selector: 'app-function-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule
  ],
  template: `
    <p-dialog 
      [(visible)]="visible"
      [modal]="true"
      [header]="isEditing ? 'Edit Function' : 'Add Function'"
      [style]="{width: '600px'}"
      (onHide)="onCancel()"
    >
      <div class="function-editor">
        <div class="editor-container" #editorContainer></div>
        <div *ngIf="error" class="error-message">{{ error }}</div>
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
      .editor-container {
        border: 1px solid var(--surface-border);
        border-radius: 6px;
        overflow: hidden;
      }

      .error-message {
        color: var(--red-500);
        margin-top: 0.5rem;
        font-size: 0.875rem;
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
    }

    :host ::ng-deep {
      .cm-editor {
        height: 400px;
        
        .cm-scroller {
          font-family: monospace;
          font-size: 14px;
        }
      }
    }
  `]
})
export class FunctionEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer') private editorContainer!: ElementRef;
  @Input() visible = false;
  @Input() function: FunctionDefinition | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<FunctionDefinition>();
  @Output() cancel = new EventEmitter<void>();

  private editor?: EditorView;
  error: string | null = null;
  isEditing = false;

  ngAfterViewInit() {
    this.initializeEditor();
  }

  ngOnDestroy() {
    this.editor?.destroy();
  }

  private initializeEditor() {
    const startState = EditorState.create({
      doc: this.getInitialDoc(),
      extensions: [
        json(),
        keymap.of(defaultKeymap),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            this.validateJson(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {height: "100%"},
          ".cm-scroller": {overflow: "auto"}
        })
      ]
    });

    this.editor = new EditorView({
      state: startState,
      parent: this.editorContainer.nativeElement
    });
  }

  private getInitialDoc(): string {
    const initialFunction = this.function || DEFAULT_FUNCTION;
    this.isEditing = !!this.function;
    return JSON.stringify(initialFunction, null, 2);
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

  onSave() {
    if (!this.editor) return;
    
    const jsonString = this.editor.state.doc.toString();
    if (this.validateJson(jsonString)) {
      const functionDef = JSON.parse(jsonString);
      this.save.emit(functionDef);
      this.visible = false;
      this.visibleChange.emit(false);
    }
  }

  onCancel() {
    this.cancel.emit();
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
