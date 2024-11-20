import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ObjectField, ObjectSchema } from '../../../../interfaces/object-system';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-schema-editor',
  templateUrl: './schema-editor.component.html',
  styleUrls: ['./schema-editor.component.scss']
})
export class SchemaEditorComponent implements OnInit {
  schemaForm: FormGroup;
  isEdit = false;
  saving = false;
  fieldTypes = [
    { label: 'String', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Boolean', value: 'boolean' },
    { label: 'Date', value: 'date' },
    { label: 'Array', value: 'array' },
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
        items: [field?.validation?.items || null],
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
          // Move mediaType into validation object if field is marked as media
          const validation = {
            ...field.validation
          };
          
          if (field.isMedia && field.mediaType) {
            validation.mediaType = field.mediaType;
          }

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

      if (this.isEdit) {
        await this.ref.close(schemaData);
      } else {
        await this.ref.close(schemaData);
      }
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
}
