import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputNumberModule } from 'primeng/inputnumber';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { OAAssistant } from '../../../lib/entities/OAAssistant';

@Component({
  selector: 'app-assistants',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    ButtonModule,
    CardModule,
    TableModule,
    TooltipModule,
    MultiSelectModule,
    InputNumberModule
  ],
  template: `
    <div class="assistants-page">
      <div class="assistants-list">
        <p-card header="Assistants">
          <p-table [value]="assistants" [tableStyle]="{ 'min-width': '50rem' }">
            <ng-template pTemplate="header">
              <tr>
                <th>Name</th>
                <th>Model</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-assistant>
              <tr>
                <td>{{ assistant.name }}</td>
                <td>{{ assistant.model }}</td>
                <td>{{ assistant.created_at | date:'medium' }}</td>
                <td>
                  <p-button
                    icon="pi pi-pencil"
                    (onClick)="editAssistant(assistant)"
                    [rounded]="true"
                    [text]="true"
                    pTooltip="Edit"
                  ></p-button>
                  <p-button
                    icon="pi pi-trash"
                    (onClick)="deleteAssistant(assistant)"
                    [rounded]="true"
                    [text]="true"
                    severity="danger"
                    pTooltip="Delete"
                  ></p-button>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      </div>

      <div class="assistant-form">
        <p-card [header]="editingAssistant ? 'Edit Assistant' : 'Create Assistant'">
          <form [formGroup]="assistantForm" (ngSubmit)="onSubmit()">
            <div class="form-field">
              <label for="name">Name</label>
              <input id="name" type="text" pInputText formControlName="name" />
            </div>

            <div class="form-field">
              <label for="instructions">Instructions</label>
              <textarea
                id="instructions"
                pInputTextarea
                formControlName="instructions"
                [rows]="5"
                [autoResize]="true"
                placeholder="You are a helpful assistant..."
              ></textarea>
            </div>

            <div class="form-field">
              <label for="model">Model</label>
              <p-dropdown
                id="model"
                formControlName="model"
                [options]="availableModels"
                placeholder="Select a model"
                [style]="{ width: '100%' }"
              ></p-dropdown>
            </div>

            <div class="form-field">
              <label for="temperature">Temperature</label>
              <p-inputNumber
                id="temperature"
                formControlName="temperature"
                [min]="0"
                [max]="2"
                [step]="0.1"
                [showButtons]="true"
                [style]="{ width: '100%' }"
              ></p-inputNumber>
            </div>

            <div class="form-field">
              <label for="functions">Functions</label>
              <p-multiSelect
                id="functions"
                formControlName="tools"
                [options]="availableFunctions"
                optionLabel="name"
                placeholder="Select functions"
                [style]="{ width: '100%' }"
              ></p-multiSelect>
            </div>

            <div class="form-actions">
              <p-button
                *ngIf="editingAssistant"
                type="button"
                label="Cancel"
                (onClick)="cancelEdit()"
                [outlined]="true"
                [style]="{ marginRight: '.5rem' }"
              ></p-button>
              <p-button
                type="submit"
                [label]="editingAssistant ? 'Update' : 'Create'"
                [loading]="loading"
              ></p-button>
            </div>
          </form>
        </p-card>
      </div>
    </div>
  `,
  styles: [`
    .assistants-page {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      padding: 2rem;
      max-width: 1600px;
      margin: 0 auto;
    }

    .form-field {
      margin-bottom: 1.5rem;

      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--text-color);
      }

      input, textarea {
        width: 100%;
      }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 2rem;
    }

    :host ::ng-deep {
      .p-card {
        background: var(--surface-card);
      }

      .p-inputtext {
        width: 100%;
      }

      .p-button {
        margin-left: 0.5rem;
      }
    }
  `]
})
export class AssistantsComponent implements OnInit {
  assistants: OAAssistant[] = [];
  assistantForm: FormGroup;
  editingAssistant: OAAssistant | null = null;
  loading = false;

  availableModels = [
    { label: 'GPT-4 Turbo', value: 'gpt-4-1106-preview' },
    { label: 'GPT-4', value: 'gpt-4' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
  ];

  availableFunctions = [
    { name: 'sendOutlines', description: 'Send outlines to the system' },
    { name: 'sendScript', description: 'Send a script to the system' },
    { name: 'sendToPictory', description: 'Send content to Pictory' }
  ];

  constructor(
    private fb: FormBuilder,
    private openAiApiService: OpenAiApiService
  ) {
    this.assistantForm = this.fb.group({
      name: ['', Validators.required],
      instructions: [''],
      model: ['gpt-4-1106-preview', Validators.required],
      tools: [[]],
      temperature: [0.7],
      response_format: [{ type: 'text' }]
    });
  }

  async ngOnInit() {
    await this.loadAssistants();
  }

  private async loadAssistants() {
    try {
      const response = await this.openAiApiService.listAssistants();
      this.assistants = response.data;
    } catch (error) {
      console.error('Failed to load assistants:', error);
    }
  }

  async onSubmit() {
    if (this.assistantForm.invalid) return;

    this.loading = true;
    try {
      const formData = this.assistantForm.value;
      
      // Convert tools to OpenAI format
      const tools = formData.tools.map((tool: any) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description
        }
      }));

      const assistantData = {
        name: formData.name,
        instructions: formData.instructions,
        model: formData.model,
        tools,
        temperature: formData.temperature,
        response_format: formData.response_format
      };

      if (this.editingAssistant) {
        await this.openAiApiService.updateAssistant(this.editingAssistant.id, assistantData);
      } else {
        await this.openAiApiService.createAssistant(assistantData);
      }

      await this.loadAssistants();
      this.assistantForm.reset({
        model: 'gpt-4-1106-preview',
        temperature: 0.7,
        tools: [],
        response_format: { type: 'text' }
      });
      this.editingAssistant = null;
    } catch (error) {
      console.error('Failed to save assistant:', error);
    } finally {
      this.loading = false;
    }
  }

  editAssistant(assistant: OAAssistant) {
    this.editingAssistant = assistant;
    
    // Convert OpenAI tools format back to form format
    const tools = assistant.tools
      ?.filter(tool => tool.type === 'function')
      .map(tool => ({
        name: tool.function.name,
        description: tool.function.description
      }));

    this.assistantForm.patchValue({
      name: assistant.name,
      instructions: assistant.instructions,
      model: assistant.model,
      tools,
      temperature: assistant.temperature || 0.7,
      response_format: assistant.response_format || { type: 'text' }
    });
  }

  async deleteAssistant(assistant: OAAssistant) {
    try {
      await this.openAiApiService.deleteAssistant(assistant.id);
      await this.loadAssistants();
    } catch (error) {
      console.error('Failed to delete assistant:', error);
    }
  }

  cancelEdit() {
    this.editingAssistant = null;
    this.assistantForm.reset({
      model: 'gpt-4-1106-preview',
      temperature: 0.7,
      tools: [],
      response_format: { type: 'text' }
    });
  }
}
