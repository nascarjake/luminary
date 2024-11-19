import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { ObjectSchema, ObjectInstance, ObjectField } from '../../../../interfaces/object-system';
import { ObjectInstanceService } from '../../../../services/object-instance.service';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

@Component({
  selector: 'app-instance-editor',
  styleUrls: ['./instance-editor.component.scss'],
  template: `
    <div class="instance-editor">
      <div class="editor-header">
        <h2>{{ isEdit ? 'Edit Instance' : 'Create Instance' }}</h2>
      </div>

      <div class="editor-content">
        <!-- Form Section -->
        <div class="editor-form">
          <form [formGroup]="form">
            <ng-container *ngFor="let field of schema.fields">
              <div class="field-group">
                <label [for]="field.name">{{ field.name }}</label>
                <div class="field-description" *ngIf="field.description">
                  {{ field.description }}
                </div>
                
                <!-- String input -->
                <input 
                  *ngIf="field.type === 'string'"
                  [id]="field.name"
                  type="text" 
                  pInputText 
                  [formControlName]="field.name"
                  [class.ng-invalid]="isFieldInvalid(field.name)">

                <!-- Number input -->
                <p-inputNumber
                  *ngIf="field.type === 'number'"
                  [id]="field.name"
                  [formControlName]="field.name"
                  [useGrouping]="false"
                  mode="decimal"
                  [minFractionDigits]="0"
                  [maxFractionDigits]="0"
                  [class.ng-invalid]="isFieldInvalid(field.name)">
                </p-inputNumber>

                <!-- Boolean input -->
                <p-checkbox
                  *ngIf="field.type === 'boolean'"
                  [id]="field.name"
                  [binary]="true"
                  [formControlName]="field.name"
                  [label]="field.description">
                </p-checkbox>

                <!-- Date input -->
                <p-calendar
                  *ngIf="field.type === 'date'"
                  [id]="field.name"
                  [formControlName]="field.name"
                  [showTime]="true"
                  [showSeconds]="true"
                  dateFormat="yy-mm-dd"
                  [class.ng-invalid]="isFieldInvalid(field.name)">
                </p-calendar>

                <!-- Error message -->
                <small class="p-error block mt-1" *ngIf="isFieldInvalid(field.name)">
                  This field is required
                </small>
              </div>
            </ng-container>
          </form>
        </div>

        <!-- JSON Preview Section -->
        <div class="json-preview">
          <div class="preview-header">
            <h3>JSON Preview</h3>
            <p-button
              icon="pi pi-copy"
              severity="secondary"
              [text]="true"
              [rounded]="true"
              (onClick)="copyJson()"
              pTooltip="Copy JSON">
            </p-button>
          </div>
          <div #jsonEditor></div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <p-button
          severity="secondary"
          label="Cancel"
          (onClick)="close()"
          [outlined]="true">
        </p-button>
        <p-button
          severity="primary"
          [label]="isEdit ? 'Save Changes' : 'Create Instance'"
          (onClick)="save()"
          [loading]="saving">
        </p-button>
      </div>
    </div>
  `
})
export class InstanceEditorComponent implements OnInit, OnDestroy {
  @ViewChild('jsonEditor') jsonEditorElement!: ElementRef;
  
  form: FormGroup;
  schema: ObjectSchema;
  instance?: ObjectInstance;
  isEdit = false;
  saving = false;
  editor?: EditorView;

  constructor(
    private fb: FormBuilder,
    private ref: DynamicDialogRef,
    private config: DynamicDialogConfig,
    private messageService: MessageService,
    private instanceService: ObjectInstanceService
  ) {
    this.schema = this.config.data.schema;
    this.instance = this.config.data.instance;
    this.isEdit = !!this.instance;
  }

  ngOnInit() {
    this.initForm();
    this.form.valueChanges.subscribe(() => {
      this.updateJsonPreview();
    });
  }

  ngAfterViewInit() {
    this.initCodeMirror();
  }

  ngOnDestroy() {
    this.editor?.destroy();
  }

  private initCodeMirror() {
    const startState = EditorState.create({
      doc: this.getFormattedJson(),
      extensions: [
        basicSetup,
        json(),
        oneDark,
        EditorState.readOnly.of(true),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px"
          },
          ".cm-scroller": {
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
            lineHeight: "1.5"
          },
          ".cm-content": {
            padding: "1rem"
          },
          "&.cm-focused": {
            outline: "none"
          }
        })
      ]
    });

    this.editor = new EditorView({
      state: startState,
      parent: this.jsonEditorElement.nativeElement
    });
  }

  private updateJsonPreview() {
    if (this.editor) {
      const json = this.getFormattedJson();
      this.editor.dispatch({
        changes: {
          from: 0,
          to: this.editor.state.doc.length,
          insert: json
        }
      });
    }
  }

  private getFormattedJson(): string {
    return JSON.stringify(this.form.value, null, 2);
  }

  copyJson() {
    navigator.clipboard.writeText(this.getFormattedJson());
    this.messageService.add({
      severity: 'success',
      summary: 'Copied',
      detail: 'JSON copied to clipboard'
    });
  }

  async save() {
    if (this.form.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please check all required fields'
      });
      return;
    }

    try {
      this.saving = true;
      const data = this.form.value;
      
      if (this.isEdit) {
        await this.ref.close(data);
      } else {
        await this.ref.close(data);
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save instance'
      });
      console.error('Error saving instance:', error);
    } finally {
      this.saving = false;
    }
  }

  close() {
    this.ref.close();
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return control ? control.invalid && control.touched : false;
  }

  private initForm() {
    const group: any = {};
    
    this.schema.fields.forEach(field => {
      const validators = [];
      if (field.required) {
        validators.push(Validators.required);
      }
      
      let value = this.instance?.[field.name] ?? null;
      if (field.type === 'date' && value) {
        value = new Date(value);
      }
      
      group[field.name] = [value, validators];
    });

    this.form = this.fb.group(group);
  }
}
