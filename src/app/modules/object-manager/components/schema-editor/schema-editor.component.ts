import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ObjectField, ObjectSchema } from '../../../../interfaces/object-system';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-schema-editor',
  styleUrls: ['./schema-editor.component.scss'],
  template: `
    <div class="schema-editor">
      <form [formGroup]="schemaForm">
        <!-- Editor Header -->
        <div class="editor-header">
          <div class="header-content">
            <div class="schema-name">
              <label for="name" class="block font-medium mb-2">Schema Name</label>
              <span class="p-input-icon-left w-full">
                <i class="pi pi-tag"></i>
                <input
                  id="name"
                  type="text"
                  pInputText
                  formControlName="name"
                  placeholder="Enter schema name"
                  class="w-full"
                />
              </span>
            </div>
            <div class="action-buttons">
              <p-button 
                icon="pi pi-times" 
                severity="secondary" 
                (onClick)="close()"
                [text]="true"
                [rounded]="true">
              </p-button>
            </div>
          </div>
          <div class="description">
            <label for="description" class="block font-medium mb-2">Description</label>
            <textarea
              id="description"
              pInputTextarea
              formControlName="description"
              placeholder="Enter schema description"
              [rows]="3"
              class="w-full"
            ></textarea>
          </div>
        </div>

        <!-- Fields Section -->
        <div formArrayName="fields">
          <p-accordion [multiple]="true" styleClass="mb-3">
            <p-accordionTab *ngFor="let field of fields.controls; let i = index" [formGroupName]="i">
              <ng-template pTemplate="header">
                <div class="field-header">
                  <i class="pi pi-database"></i>
                  <span>{{ field.get('name')?.value || 'New Field' }}</span>
                  <p-badge [value]="field.get('type')?.value || ''" severity="info"></p-badge>
                </div>
              </ng-template>

              <div class="field-editor">
                <!-- Field Basic Info -->
                <div class="field-row">
                  <div class="field">
                    <label class="block font-medium mb-2">Field Name</label>
                    <input type="text" pInputText formControlName="name" placeholder="Enter field name" class="w-full" />
                  </div>
                  <div class="field">
                    <label class="block font-medium mb-2">Field Type</label>
                    <p-dropdown
                      formControlName="type"
                      [options]="fieldTypes"
                      placeholder="Select field type"
                      class="w-full">
                    </p-dropdown>
                  </div>
                </div>

                <div class="field-row">
                  <div class="field">
                    <label class="block font-medium mb-2">Description</label>
                    <textarea
                      pInputTextarea
                      formControlName="description"
                      placeholder="Enter field description"
                      [rows]="2"
                      class="w-full">
                    </textarea>
                  </div>
                </div>

                <!-- Validation Rules -->
                <p-fieldset legend="Validation Rules" [toggleable]="true" styleClass="validation-rules">
                  <div class="validation-grid">
                    <!-- Required Field -->
                    <div class="validation-field">
                      <label class="block font-medium mb-2">Required</label>
                      <p-checkbox
                        formControlName="required"
                        [binary]="true"
                        label="Field is required">
                      </p-checkbox>
                    </div>

                    <!-- Type-specific validation -->
                    <ng-container [ngSwitch]="field.get('type')?.value">
                      <!-- String validation -->
                      <ng-container *ngSwitchCase="'string'">
                        <div class="validation-field">
                          <label class="block font-medium mb-2">Min Length</label>
                          <p-inputNumber
                            formControlName="minLength"
                            [min]="0"
                            placeholder="Min length"
                            class="w-full">
                          </p-inputNumber>
                        </div>
                        <div class="validation-field">
                          <label class="block font-medium mb-2">Max Length</label>
                          <p-inputNumber
                            formControlName="maxLength"
                            [min]="0"
                            placeholder="Max length"
                            class="w-full">
                          </p-inputNumber>
                        </div>
                        <div class="validation-field">
                          <label class="block font-medium mb-2">Pattern</label>
                          <input
                            type="text"
                            pInputText
                            formControlName="pattern"
                            placeholder="Regular expression"
                            class="w-full" />
                        </div>
                      </ng-container>

                      <!-- Number validation -->
                      <ng-container *ngSwitchCase="'number'">
                        <div class="validation-field">
                          <label class="block font-medium mb-2">Minimum</label>
                          <p-inputNumber
                            formControlName="min"
                            [useGrouping]="false"
                            mode="decimal"
                            [minFractionDigits]="0"
                            [maxFractionDigits]="0"
                            placeholder="Min value"
                            class="w-full">
                          </p-inputNumber>
                        </div>
                        <div class="validation-field">
                          <label class="block font-medium mb-2">Maximum</label>
                          <p-inputNumber
                            formControlName="max"
                            [useGrouping]="false"
                            mode="decimal"
                            [minFractionDigits]="0"
                            [maxFractionDigits]="0"
                            placeholder="Max value"
                            class="w-full">
                          </p-inputNumber>
                        </div>
                      </ng-container>

                      <!-- Enum validation -->
                      <ng-container *ngSwitchCase="'enum'">
                        <div class="validation-field">
                          <label class="block font-medium mb-2">Enum Values</label>
                          <p-chips
                            formControlName="enumValues"
                            placeholder="Add value"
                            [allowDuplicate]="false"
                            class="w-full">
                          </p-chips>
                        </div>
                      </ng-container>
                    </ng-container>
                  </div>
                </p-fieldset>

                <!-- Delete Field Button -->
                <div class="flex justify-content-end mt-3">
                  <p-button
                    icon="pi pi-trash"
                    severity="danger"
                    (onClick)="removeField(i)"
                    [text]="true">
                  </p-button>
                </div>
              </div>
            </p-accordionTab>
          </p-accordion>

          <!-- Add Field Button -->
          <p-button
            icon="pi pi-plus"
            label="Add Field"
            (onClick)="addField()"
            [outlined]="true"
            class="mb-3">
          </p-button>
        </div>

        <!-- Form Actions -->
        <div class="action-buttons">
          <p-button
            severity="secondary"
            label="Cancel"
            (onClick)="close()"
            [outlined]="true">
          </p-button>
          <p-button
            severity="primary"
            [label]="isEdit ? 'Save Changes' : 'Create Schema'"
            (onClick)="save()"
            [loading]="saving">
          </p-button>
        </div>
      </form>
    </div>
  `
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

  constructor(
    private fb: FormBuilder,
    private ref: DynamicDialogRef,
    private config: DynamicDialogConfig,
    private messageService: MessageService
  ) {
    this.schemaForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
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
    const fieldGroup = this.fb.group({
      name: ['', Validators.required],
      type: ['string', Validators.required],
      description: [''],
      required: [false],
      validation: this.fb.group({
        pattern: [''],
        min: [null],
        max: [null],
        enum: [[]],
        items: [null],
        properties: [[]]
      })
    });

    this.fields.push(fieldGroup);
  }

  removeField(index: number) {
    this.fields.removeAt(index);
  }

  initializeForm(schema: ObjectSchema) {
    this.schemaForm.patchValue({
      name: schema.name,
      description: schema.description
    });

    schema.fields.forEach(field => {
      const fieldGroup = this.fb.group({
        name: [field.name, Validators.required],
        type: [field.type, Validators.required],
        description: [field.description || ''],
        required: [field.required || false],
        validation: this.fb.group({
          pattern: [field.validation?.pattern || ''],
          min: [field.validation?.min || null],
          max: [field.validation?.max || null],
          enum: [field.validation?.enum || []],
          items: [field.validation?.items || null],
          properties: [field.validation?.properties || []]
        })
      });

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
      const schemaData = this.schemaForm.value;
      
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
