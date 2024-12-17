import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { CalendarModule } from 'primeng/calendar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { RRule, Frequency } from 'rrule';
import { OAAssistant } from '../../../lib/entities/OAAssistant';
import { ObjectInstance } from '../../interfaces/object-system';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-schedule-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    CheckboxModule,
    CalendarModule,
    RadioButtonModule,
    InputTextareaModule,
    TableModule
  ],
  template: `
    <div class="event-form">
      <div class="validation-errors" *ngIf="validationErrors.length > 0">
        <p class="error-message" *ngFor="let error of validationErrors">{{ error }}</p>
      </div>

      <div class="form-field">
        <label for="title">Title</label>
        <input id="title" type="text" pInputText [(ngModel)]="newEvent.title" />
      </div>

      <div class="form-field">
        <label for="assistant">Assistant</label>
        <p-dropdown id="assistant"
                   [options]="filteredAssistants"
                   [(ngModel)]="newEvent.assistant"
                   optionLabel="name"
                   (onChange)="onAssistantChange($event)">
        </p-dropdown>
      </div>

      <div class="form-field">
        <label>Type</label>
        <div class="type-selection">
          <p-radioButton name="type" 
                        value="message" 
                        [(ngModel)]="newEvent.type" 
                        label="Send Message">
          </p-radioButton>
          <p-radioButton name="type" 
                        value="object" 
                        [(ngModel)]="newEvent.type" 
                        label="Send Object">
          </p-radioButton>
        </div>
      </div>

      <div class="form-field" *ngIf="newEvent.type === 'message'">
        <label for="message">Message</label>
        <textarea id="message" 
                 pInputTextarea 
                 [(ngModel)]="newEvent.message"
                 [autoResize]="true">
        </textarea>
      </div>

      <div class="form-field" *ngIf="newEvent.type === 'object'">
        <label>Object</label>
        <div class="object-selection">
          <span>{{ selectedObjectDisplay() }}</span>
        </div>
      </div>

      <div class="form-field">
        <label for="start">Start Time</label>
        <p-calendar id="start"
                   [(ngModel)]="newEvent.start"
                   [showTime]="true"
                   [hourFormat]="'12'"
                   appendTo="body"
                   [showButtonBar]="true">
        </p-calendar>
      </div>

      <div class="form-field">
        <div class="recurring-checkbox">
          <p-checkbox [(ngModel)]="newEvent.isRecurring" 
                     [binary]="true"
                     label="Recurring Event">
          </p-checkbox>
        </div>
      </div>

      <div class="form-field" *ngIf="newEvent.isRecurring">
        <label>Recurrence Pattern</label>
        <p-dropdown [options]="recurrenceOptions"
                   [(ngModel)]="newEvent.recurrencePattern"
                   optionLabel="label"
                   optionValue="value">
        </p-dropdown>
      </div>

      <div class="form-field" *ngIf="newEvent.isRecurring">
        <label for="until">Repeat Until</label>
        <p-calendar id="until"
                   [(ngModel)]="newEvent.until"
                   [showTime]="true"
                   [hourFormat]="'12'"
                   [showButtonBar]="true">
        </p-calendar>
      </div>
    </div>

    <div class="dialog-footer">
      <p-button label="Cancel" 
                icon="pi pi-times" 
                (onClick)="hideDialog()">
      </p-button>
      <p-button label="Save" 
                icon="pi pi-check" 
                (onClick)="onSave()">
      </p-button>
    </div>
  `,
  styles: [`
    .event-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-field textarea {
      min-height: 100px;
      resize: vertical;
    }

    .type-selection {
      display: flex;
      gap: 1rem;
    }

    .object-selection {
      display: flex;
      gap: 0.5rem;
    }

    .validation-errors {
      margin-bottom: 1rem;
    }

    .error-message {
      color: var(--red-500);
      margin: 0;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid var(--surface-border);
      margin-top: 1rem;
    }
  `]
})
export class ScheduleDialogComponent implements OnInit {
  validationErrors: string[] = [];
  recurrenceOptions = [
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' }
  ];

  newEvent = {
    title: '',
    start: null,
    isRecurring: false,
    recurrencePattern: 'weekly', // Default to weekly
    until: null,
    type: 'object',
    message: '',
    assistant: null,
    object: null
  };

  assistants: OAAssistant[] = [];
  filteredAssistants: OAAssistant[] = [];
  selectedObject: ObjectInstance | null = null;

  constructor(
    public config: DynamicDialogConfig,
    public ref: DynamicDialogRef,
    private openAiService: OpenAiApiService,
    private configService: ConfigService
  ) {}

  async ngOnInit() {
    if (this.config.data) {
      if (this.config.data.selectedObject) {
        this.selectedObject = this.config.data.selectedObject;
        this.newEvent.object = this.selectedObject;
      }
      if (this.config.data.defaultEventType) {
        this.newEvent.type = this.config.data.defaultEventType;
      }
    }
    await this.loadAssistants();
  }

  async loadAssistants() {
    const response = await this.openAiService.listAssistants();
    this.assistants = response.data;
    this.filterAssistantsByObject();
  }

  filterAssistantsByObject() {
    if (this.selectedObject && this.assistants.length > 0) {
      const objectSchemaId = this.selectedObject.schemaId;
      
      // First get base directory
      (window as any).electron.path.appConfigDir().then(async baseDir => {
        const activeProfile = await this.configService.getActiveProfile();
        const activeProject = await this.configService.getActiveProject();
        
        if (!activeProfile || !activeProject) {
          console.error('No active profile or project found');
          this.filteredAssistants = [];
          return;
        }

        // Filter assistants and load their full details
        Promise.all(this.assistants.map(async assistant => {
          try {
            // Load full assistant details including inputs
            const fullAssistant = await (window as any).electron.assistant.load(
              baseDir,
              activeProfile.id,
              activeProject.id,
              assistant.id
            );
            
            // Check if this assistant has an input matching our object schema
            return fullAssistant && fullAssistant.inputs && 
                   fullAssistant.inputs.includes(objectSchemaId) ? assistant : null;
          } catch (err) {
            console.error(`Error loading assistant ${assistant.id}:`, err);
            return null;
          }
        })).then(filteredResults => {
          // Remove null results and update filtered assistants
          this.filteredAssistants = filteredResults.filter(a => a !== null);
          
          // If there's only one assistant, select it automatically
          if (this.filteredAssistants.length === 1) {
            this.newEvent.assistant = this.filteredAssistants[0];
          }
        });
      });
    } else {
      this.filteredAssistants = this.assistants;
    }
  }

  selectedObjectDisplay(): string {
    return this.selectedObject ? this.selectedObject.data.name || this.selectedObject.data.title || this.selectedObject.data.key || this.selectedObject.data.message || this.selectedObject.data.id || 'Selected Object' : 'No object selected';
  }

  onAssistantChange(event: any) {
    // Handle assistant change if needed
  }

  hideDialog() {
    this.ref.close();
  }

  validateForm(): boolean {
    this.validationErrors = [];

    if (!this.newEvent.title) {
      this.validationErrors.push('Title is required');
    }

    if (!this.newEvent.assistant) {
      this.validationErrors.push('Assistant is required');
    }

    if (!this.newEvent.start) {
      this.validationErrors.push('Start time is required');
    }

    if (this.newEvent.type === 'message' && !this.newEvent.message) {
      this.validationErrors.push('Message is required');
    }

    if (this.newEvent.type === 'object' && !this.newEvent.object) {
      this.validationErrors.push('Object is required');
    }

    if (this.newEvent.isRecurring) {
      if (!this.newEvent.recurrencePattern) {
        this.validationErrors.push('Recurrence pattern is required');
      }
      if (!this.newEvent.until) {
        this.validationErrors.push('Repeat until date is required');
      }
    }

    return this.validationErrors.length === 0;
  }

  onSave() {
    if (!this.validateForm()) {
      return;
    }

    let eventData: any = {
      id: crypto.randomUUID(),
      title: this.newEvent.title,
      start: this.newEvent.start,
      extendedProps: {
        type: this.newEvent.type,
        assistantId: this.newEvent.assistant.id,
      }
    };

    if (this.newEvent.type === 'message') {
      eventData.extendedProps.message = this.newEvent.message;
    } else {
      eventData.extendedProps.objectId = this.selectedObject?.id;
    }

    if (this.newEvent.isRecurring && this.newEvent.recurrencePattern) {
      const rruleOptions: any = {
        freq: this.newEvent.recurrencePattern === 'weekly' ? Frequency.WEEKLY : Frequency.MONTHLY,
        dtstart: new Date(this.newEvent.start)
      };

      if (this.newEvent.until) {
        rruleOptions.until = new Date(this.newEvent.until);
      }

      const rruleString = new RRule(rruleOptions).toString();
      eventData.rrule = rruleString;
      eventData.extendedProps.rrule = rruleString;
    }

    this.ref.close(eventData);
  }
}
