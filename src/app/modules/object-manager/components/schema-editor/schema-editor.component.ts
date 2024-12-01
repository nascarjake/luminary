import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ObjectField, ObjectSchema } from '../../../../interfaces/object-system';
import { MessageService } from 'primeng/api';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { defaultKeymap } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import { oneDark } from '@codemirror/theme-one-dark';

@Component({
  selector: 'app-schema-editor',
  templateUrl: './schema-editor.component.html',
  styleUrls: ['./schema-editor.component.scss']
})
export class SchemaEditorComponent implements OnInit, OnDestroy {
  @ViewChild('jsonEditorContainer') jsonEditorContainer: ElementRef;

  schemaForm: FormGroup;
  isEdit = false;
  saving = false;
  showJsonEditor = false;
  jsonEditorView: EditorView | null = null;

  fieldTypes = [
    { label: 'String', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Boolean', value: 'boolean' },
    { label: 'Date', value: 'date' },
    { label: 'Array', value: 'array' },
    { label: 'Object', value: 'object' }
  ];

  arrayItemTypes = [
    { label: 'String', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Boolean', value: 'boolean' },
    { label: 'Date', value: 'date' },
    { label: 'Object', value: 'object' }
  ];

  mediaTypes = [
    { label: 'Image', value: 'image' },
    { label: 'Video', value: 'video' },
    { label: 'Audio', value: 'audio' }
  ];

  constructor(
    private fb: FormBuilder,
    private ref: DynamicDialogRef,
    private config: DynamicDialogConfig,
    private messageService: MessageService
  ) {
    this.schemaForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      isFinalOutput: [false],
      fields: this.fb.array([])
    });
  }

  ngOnInit() {
    if (this.config.data?.schema) {
      this.isEdit = true;
      this.initializeForm(this.config.data.schema);
    } else {
      this.addField(); // Add one field by default for new schemas
    }
  }

  ngOnDestroy() {
    if (this.jsonEditorView) {
      this.jsonEditorView.destroy();
    }
  }

  get fields() {
    return this.schemaForm.get('fields') as FormArray;
  }

  addField() {
    const fieldGroup = this.createFieldFormGroup();
    this.fields.push(fieldGroup);
  }

  removeField(index: number) {
    this.fields.removeAt(index);
  }

  createFieldFormGroup(field?: ObjectField) {
    return this.fb.group({
      name: [field?.name || '', Validators.required],
      description: [field?.description || ''],
      type: [field?.type || 'string', Validators.required],
      required: [field?.required || false],
      isMedia: [field?.isMedia || false],
      mediaType: [field?.validation?.mediaType || null],
      validation: this.fb.group({
        required: [field?.validation?.required || false],
        minLength: [field?.validation?.minLength || null],
        maxLength: [field?.validation?.maxLength || null],
        pattern: [field?.validation?.pattern || ''],
        min: [field?.validation?.min || null],
        max: [field?.validation?.max || null],
        enum: [field?.validation?.enum || []],
        minItems: [field?.validation?.minItems || null],
        maxItems: [field?.validation?.maxItems || null],
        items: this.fb.group({
          type: [field?.validation?.items?.type || undefined],
          validation: this.fb.group({
            minLength: [field?.validation?.items?.validation?.minLength || null],
            maxLength: [field?.validation?.items?.validation?.maxLength || null],
            pattern: [field?.validation?.items?.validation?.pattern || ''],
            min: [field?.validation?.items?.validation?.min || null],
            max: [field?.validation?.items?.validation?.max || null],
            enum: [field?.validation?.items?.validation?.enum || []]
          })
        }) || null,
        properties: [field?.validation?.properties || []]
      })
    });
  }

  initializeForm(schema: ObjectSchema) {
    this.schemaForm.patchValue({
      name: schema.name,
      description: schema.description,
      isFinalOutput: schema.isFinalOutput || false
    });

    schema.fields.forEach(field => {
      const fieldGroup = this.createFieldFormGroup(field);
      this.fields.push(fieldGroup);
    });
  }

  private removeEmpty(obj: any): any {
    if (obj === null || obj === undefined) {
      return undefined;
    }

    if (Array.isArray(obj)) {
      const filtered = obj.map(item => this.removeEmpty(item)).filter(item => item !== undefined);
      return filtered.length ? filtered : undefined;
    }

    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Special case for boolean values - keep false
        if (typeof value === 'boolean') {
          cleaned[key] = value;
          continue;
        }
        
        const cleanedValue = this.removeEmpty(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return Object.keys(cleaned).length ? cleaned : undefined;
    }

    // Keep non-empty strings, numbers, and booleans
    if (obj === '' || obj === 0) {
      return undefined;
    }
    return obj;
  }

  async save() {
    if (this.schemaForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please check all required fields'
      });
      return;
    }

    try {
      this.saving = true;
      const formValue = this.schemaForm.value;
      
      // Transform the form data to match the schema interface
      const schemaData = {
        ...formValue,
        fields: formValue.fields.map((field: any) => {
          // Move mediaType into validation if field is media
          const validation = field.isMedia && field.mediaType 
            ? { ...field.validation, mediaType: field.mediaType }
            : field.validation;

          return {
            name: field.name,
            type: field.type,
            description: field.description,
            required: field.required,
            isMedia: field.isMedia,
            validation
          };
        })
      };

      // Clean up the schema data by removing empty values
      const cleanedData = this.removeEmpty(schemaData);

      await this.ref.close(cleanedData);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save schema'
      });
      console.error('Error saving schema:', error);
    } finally {
      this.saving = false;
    }
  }

  close() {
    this.ref.close();
  }

  showJsonExampleEditor() {
    this.showJsonEditor = true;
    setTimeout(() => {
      if (this.jsonEditorContainer) {
        this.initJsonEditor();
      }
    });
  }

  initJsonEditor() {
    const startState = EditorState.create({
      doc: '{\n  // Paste your JSON example here\n}',
      extensions: [
        basicSetup,
        json(),
        oneDark,
        keymap.of(defaultKeymap),
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
      ],
    });

    this.jsonEditorView = new EditorView({
      state: startState,
      parent: this.jsonEditorContainer.nativeElement,
    });
  }

  convertJsonToSchema() {
    try {
      if (!this.jsonEditorView) return;
      
      const jsonContent = this.jsonEditorView.state.doc.toString();
      const jsonObject = Function(`return ${jsonContent}`)();
      
      // Clear existing fields
      while (this.fields.length) {
        this.fields.removeAt(0);
      }
      
      // Convert each property to a field
      Object.entries(jsonObject).forEach(([key, value]) => {
        const field = this.createFieldFormGroup({
          name: key,
          type: this.getTypeFromValue(value),
          description: this.extractComment(jsonContent, key) || key,
          required: false,
          isMedia: false,
          validation: {}
        });
        this.fields.push(field);
      });
      
      this.showJsonEditor = false;
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'JSON example converted to schema fields'
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to parse JSON example. Please check the syntax.'
      });
    }
  }

  private getTypeFromValue(value: any): string {
    if (value === null) return 'string';
    switch (typeof value) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'object': return 'object';
      default: return 'string';
    }
  }

  private extractComment(jsonContent: string, key: string): string | null {
    const lines = jsonContent.split('\n');
    const keyLine = lines.findIndex(line => line.includes(`"${key}"`) || line.includes(`${key}:`));
    if (keyLine === -1) return null;

    const commentMatch = lines[keyLine].match(/\/\/\s*(.+)$/);
    return commentMatch ? commentMatch[1].trim() : null;
  }
}
