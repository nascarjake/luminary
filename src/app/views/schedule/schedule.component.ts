import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { CalendarModule } from 'primeng/calendar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import { RRule, Frequency } from 'rrule';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { ObjectInstanceService } from '../../services/object-instance.service';
import { ObjectSchemaService } from '../../services/object-schema.service';
import { FunctionImplementationsService } from '../../services/function-implementations.service';
import { ConfigService } from '../../services/config.service';
import { OAAssistant } from '../../../lib/entities/OAAssistant';
import { ObjectInstance, ObjectSchema } from '../../interfaces/object-system';
import { EventService } from '../../services/event.service';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    CheckboxModule,
    CalendarModule,
    FullCalendarModule,
    RadioButtonModule,
    InputTextareaModule,
    TableModule
  ],
  template: `
    <div class="schedule-container">
      <div class="header">
        <h1>Schedule</h1>
        <p-button label="Add Event" icon="pi pi-plus" (onClick)="showEventDialog()"></p-button>
      </div>

      <div class="calendar-container">
        <full-calendar [options]="calendarOptions"></full-calendar>
      </div>

      <p-dialog header="Add Event" 
                [(visible)]="showDialog" 
                [modal]="true" 
                [style]="{width: '500px'}"
                [closable]="true">
        <div class="event-form">
          <div class="form-field">
            <label for="title">Title</label>
            <input id="title" type="text" pInputText [(ngModel)]="newEvent.title" />
          </div>

          <div class="form-field">
            <label for="assistant">Assistant</label>
            <p-dropdown id="assistant"
                       [options]="assistants"
                       [(ngModel)]="newEvent.assistant"
                       optionLabel="name"
                       placeholder="Select an Assistant"
                       (onChange)="onAssistantChange($event)">
            </p-dropdown>
          </div>

          <div class="form-field">
            <label>Event Type</label>
            <div class="type-selection">
              <p-radioButton name="type" 
                            value="message" 
                            [(ngModel)]="newEvent.type" 
                            label="Message">
              </p-radioButton>
              <p-radioButton name="type" 
                            value="object" 
                            [(ngModel)]="newEvent.type" 
                            label="Object">
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
            <!--<p-button icon="pi pi-expand" (onClick)="showFullscreenEditor()"></p-button>-->
          </div>

          <div class="form-field" *ngIf="newEvent.type === 'object'">
            <label>Object</label>
            <div class="object-selection">
              <input type="text" 
                     pInputText 
                     [value]="selectedObjectDisplay" 
                     readonly 
                     (click)="showObjectDialog()" />
              <p-button icon="pi pi-search" 
                       (onClick)="showObjectDialog()">
              </p-button>
            </div>
          </div>

          <div class="form-field">
            <label for="startDate">Event Time</label>
            <p-calendar id="startDate" 
                       [(ngModel)]="newEvent.start" 
                       [showTime]="true"
                       appendTo="body"
                       [showButtonBar]="true"
                       [hourFormat]="'12'"></p-calendar>
          </div>

          <div class="form-field">
            <label for="recurring">Recurring Event</label>
            <p-checkbox [(ngModel)]="newEvent.isRecurring" 
                       [binary]="true" 
                       label="Repeat">
            </p-checkbox>
          </div>

          <div class="form-field" *ngIf="newEvent.isRecurring">
            <label for="pattern">Pattern</label>
            <p-dropdown id="pattern"
                       [options]="recurrenceOptions"
                       [(ngModel)]="newEvent.recurrencePattern"
                       optionLabel="label"
                       optionValue="value">
            </p-dropdown>
          </div>

          <div class="form-field" *ngIf="newEvent.isRecurring">
            <label for="until">Until</label>
            <p-calendar id="until"
                       [(ngModel)]="newEvent.until"
                       [showTime]="true"
                       appendTo="body"
                       [showButtonBar]="true"
                       [hourFormat]="'12'">
            </p-calendar>
          </div>
        </div>

        <ng-template pTemplate="footer">
          <div class="validation-errors" *ngIf="validationErrors.length > 0">
            <p *ngFor="let error of validationErrors" class="error-message">
              {{error}}
            </p>
          </div>
          <div class="dialog-footer">
            <p-button label="Cancel" 
                      icon="pi pi-times" 
                      (onClick)="hideEventDialog()" 
                      styleClass="p-button-text">
            </p-button>
            <p-button label="Save" 
                      icon="pi pi-check" 
                      (onClick)="saveEvent()">
            </p-button>
          </div>
        </ng-template>
      </p-dialog>

      <p-dialog header="Select Object" 
                [(visible)]="showObjectSelectDialog" 
                [modal]="true" 
                [style]="{width: '800px'}"
                [maximizable]="true">
        <p-table [value]="filteredObjects" 
                 [scrollable]="true" 
                 scrollHeight="400px"
                 selectionMode="single"
                 [(selection)]="selectedObject"
                 [globalFilterFields]="['id', 'name', 'type']">
          <ng-template pTemplate="caption">
            <div class="flex justify-content-end">
              <span class="p-input-icon-left">
                <i class="pi pi-search"></i>
                <input pInputText type="text" 
                       (input)="onObjectSearch($event)" 
                       placeholder="Search objects..." />
              </span>
            </div>
          </ng-template>
          <ng-template pTemplate="header">
            <tr>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-object>
            <tr [pSelectableRow]="object">
              <td>{{object.data.name || object.data.title || object.data.key || object.data.message || object.id }}</td>
              <td>{{object.schemaName}}</td>
            </tr>
          </ng-template>
        </p-table>

        <ng-template pTemplate="footer">
          <p-button label="Cancel" icon="pi pi-times" (onClick)="hideObjectDialog()" styleClass="p-button-text"></p-button>
          <p-button label="Select" icon="pi pi-check" (onClick)="selectObject()"></p-button>
        </ng-template>
      </p-dialog>

      <p-dialog header="Fullscreen Editor" 
                [(visible)]="showFullscreenDialog" 
                [modal]="true" 
                [style]="{width: '800px'}"
                [maximizable]="true">
        <textarea pInputTextarea [(ngModel)]="fullscreenContent" [autoResize]="true"></textarea>
        <ng-template pTemplate="footer">
          <p-button label="Cancel" icon="pi pi-times" (onClick)="hideFullscreenEditor()" styleClass="p-button-text"></p-button>
          <p-button label="Save" icon="pi pi-check" (onClick)="hideFullscreenEditor()"></p-button>
        </ng-template>
      </p-dialog>
    </div>
  `,
  styles: [`
    .schedule-container {
      padding: 1rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .calendar-container {
      height: calc(100vh - 150px);
    }

    .event-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
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
    }

    :host ::ng-deep .p-dialog-maximized textarea {
      min-height: 300px;
    }
  `]
})
export class ScheduleComponent implements OnInit, OnDestroy {
  showDialog = false;
  showObjectSelectDialog = false;
  showFullscreenDialog = false;
  fullscreenContent = '';
  events: any[] = [];
  assistants: OAAssistant[] = [];
  objects: ObjectInstance[] = [];
  filteredObjects: any[] = [];
  selectedObject: ObjectInstance | null = null;
  objectFilter: string = '';
  validationErrors: string[] = [];
  selectedAssistantInputs: string[] = [];
  editingEventId: string | null = null;
  subscriptions: any[] = [];

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: 3,
    events: [], // Initialize with empty array
    select: this.handleDateSelect.bind(this),
    eventClick: this.handleEventClick.bind(this),
    datesSet: (dateInfo) => {
      console.log('Calendar view changed/updated. Events:', this.calendarOptions.events);
      if (this.events.length !== this.calendarOptions.events) {
        console.log('Event count mismatch - updating calendar');
        this.calendarOptions = {
          ...this.calendarOptions,
          events: [...this.events] // Create new array reference
        };
      }
    }
  };

  newEvent = {
    title: '',
    start: null,
    isRecurring: false,
    recurrencePattern: 'weekly', // Default to weekly
    until: null,
    type: 'message',
    message: '',
    assistant: null,
    object: null
  };

  recurrenceOptions = [
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' }
  ];

  constructor(
    private openAiService: OpenAiApiService,
    private objectInstanceService: ObjectInstanceService,
    private objectSchemaService: ObjectSchemaService,
    private functionImplementationsService: FunctionImplementationsService,
    private configService: ConfigService,
    private eventService: EventService
  ) {}

  async ngOnInit() {
    await this.loadAssistants();
    await this.eventService.loadEvents();
    this.subscriptions.push(
      this.eventService.events$.subscribe(events => {
        console.log('Events subscription update:', events.length, 'events');
        this.events = events;
        // Create new calendar options object with new events array
        this.calendarOptions = {
          ...this.calendarOptions,
          events: [...events]
        };
        console.log('Calendar events after update:', this.calendarOptions.events);
      })
    );
  }

  async loadAssistants() {
    const response = await this.openAiService.listAssistants();
    this.assistants = response.data;
  }

  async loadObjects() {
    // Load schemas first
    const schemas = await this.objectSchemaService.listSchemas();
    const schemaMap = new Map(schemas.map(s => [s.id, s]));
    
    // Subscribe to instances and attach schema names
    this.objectInstanceService.instances.subscribe(instances => {
      this.objects = instances.map(instance => ({
        ...instance,
        schemaName: schemaMap.get(instance.schemaId)?.name || 'Unknown Schema',
        displayName: instance.data?.name || instance.data?.title || instance.data?.key || instance.data?.message || instance.id
      }))
      // Sort by schema name first, then by display name
      .sort((a, b) => {
        const schemaCompare = a.schemaName.localeCompare(b.schemaName);
        if (schemaCompare !== 0) return schemaCompare;
        
        const aName = a.data?.name || a.data?.title || a.data?.key || a.data?.message || a.id;
        const bName = b.data?.name || b.data?.title || b.data?.key || b.data?.message || b.id;
        return aName.localeCompare(bName);
      });
      
      this.filteredObjects = [...this.objects];
    });
  }

  get selectedObjectDisplay(): string {
    if (!this.newEvent.object) return '';
    return this.newEvent.object.data?.name || 
           this.newEvent.object.data?.title || 
           this.newEvent.object.data?.key || 
           this.newEvent.object.data?.message || 
           this.newEvent.object.id;
  }

  handleDateSelect(selectInfo: any) {
    this.editingEventId = null; // Clear any previous editing state
    this.resetNewEvent(); // Reset the form
    this.newEvent.start = selectInfo.start;
    this.showEventDialog();
  }

  parseRruleUntilDate(dateStr: string): Date {
    // Convert "YYYYMMDDTHHMMSSZ" to "YYYY-MM-DDTHH:MM:SSZ"
    const formatted = dateStr.replace(
      /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,
      '$1-$2-$3T$4:$5:$6Z'
    );
    return new Date(formatted);
  }

  handleEventClick(clickInfo: any) {
    const event = clickInfo.event;
    console.log('Clicked event:', event);
    console.log('Event def:', event._def);
    console.log('Event def extended props:', event._def.extendedProps);
    
    // When saving, we store rrule directly in extendedProps, so let's look there
    const rrule = event._def.extendedProps?.rrule;
    console.log('Event rrule:', rrule);
    
    this.editingEventId = event.id;
    
    // Parse recurring event settings if present
    let recurrenceSettings = {
      isRecurring: false,
      pattern: null,
      until: null
    };
    
    if (rrule) {
      console.log('Has rrule, parsing...');
      recurrenceSettings.isRecurring = true;
      recurrenceSettings.pattern = rrule.includes('FREQ=WEEKLY') ? 'weekly' : 'monthly';
      
      const untilMatch = rrule.match(/UNTIL=(\d{8}T\d{6}Z)/);
      if (untilMatch) {
        recurrenceSettings.until = this.parseRruleUntilDate(untilMatch[1]);
        console.log('Parsed until date:', recurrenceSettings.until);
      }
      console.log('Parsed recurrence settings:', recurrenceSettings);
    }
    
    // Populate form with event data
    this.newEvent = {
      title: event.title,
      start: new Date(event.start),
      isRecurring: recurrenceSettings.isRecurring,
      recurrencePattern: recurrenceSettings.pattern,
      until: recurrenceSettings.until,
      type: event._def.extendedProps.type,
      message: event._def.extendedProps.message || '',
      assistant: this.assistants.find(a => a.id === event._def.extendedProps.assistantId) || null,
      object: event._def.extendedProps.objectId ? this.objects.find(o => o.id === event._def.extendedProps.objectId) : null
    };

    console.log('Populated newEvent:', this.newEvent);

    // If it's an object type event, update the selected object
    if (this.newEvent.type === 'object' && this.newEvent.object) {
      this.selectedObject = this.newEvent.object;
    }

    this.showEventDialog();
  }

  showEventDialog() {
    this.showDialog = true;
  }

  hideEventDialog() {
    this.showDialog = false;
    this.editingEventId = null;
    this.resetNewEvent();
  }

  showObjectDialog() {
    this.showObjectSelectDialog = true;
  }

  hideObjectDialog() {
    this.showObjectSelectDialog = false;
    this.selectedObject = null;
  }

  selectObject() {
    this.newEvent.object = this.selectedObject;
    this.hideObjectDialog();
  }

  onObjectSearch(event: any) {
    const query = event.target.value.toLowerCase();
    const searchTerms = query.split(/\s+/).filter(term => term.length > 0);

    this.filteredObjects = this.objects.filter((obj: any) => {
      if (searchTerms.length === 0) return true;

      const nameFields = [
        obj.data?.name,
        obj.data?.title,
        obj.data?.key,
        obj.data?.message,
        obj.id
      ].filter(Boolean).map(field => field.toString().toLowerCase());

      const schemaName = obj.schemaName.toLowerCase();
      
      return searchTerms.every(term => {
        // Check if the term matches the schema name
        const matchesSchema = schemaName.includes(term);
        
        // Check if the term matches any of the name fields
        const matchesName = nameFields.some(field => field.includes(term));
        
        // For each term, it must either match the schema OR any name field
        return matchesSchema || matchesName;
      });
    });
  }

  async onAssistantChange(event: any) {
    this.newEvent.assistant = event.value;
    const profile = this.configService.getActiveProfile();
    const project = this.configService.getActiveProject();
    
    if (profile && project && this.newEvent.assistant) {
      const config = await this.functionImplementationsService.loadFunctionImplementations(
        profile.id,
        project.id,
        this.newEvent.assistant.id
      );
      this.selectedAssistantInputs = config.inputs || [];
      this.filterObjectsByAssistantInputs();
    } else {
      this.selectedAssistantInputs = [];
      this.filteredObjects = [...this.objects];
    }
  }

  filterObjectsByAssistantInputs() {
    if (!this.selectedAssistantInputs.length) {
      this.filteredObjects = [...this.objects];
      return;
    }
    
    this.filteredObjects = this.objects.filter(obj => 
      this.selectedAssistantInputs.includes(obj.schemaId)
    );
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
      this.validationErrors.push('Start date is required');
    }
    
    if (this.newEvent.type === 'message' && !this.newEvent.message) {
      this.validationErrors.push('Message is required');
    }
    
    if (this.newEvent.type === 'object' && !this.newEvent.object) {
      this.validationErrors.push('Object selection is required');
    }
    
    return this.validationErrors.length === 0;
  }

  async saveEvent() {
    if (!this.validateForm()) {
      return;
    }

    let eventData: any = {
      id: this.editingEventId || crypto.randomUUID(), 
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
      eventData.extendedProps.objectId = this.newEvent.object.id;
    }

    if (this.newEvent.isRecurring && this.newEvent.recurrencePattern) {
      console.log('Saving recurring event with pattern:', this.newEvent.recurrencePattern);
      const rruleOptions: any = {
        freq: this.newEvent.recurrencePattern === 'weekly' ? Frequency.WEEKLY : Frequency.MONTHLY,
        dtstart: new Date(this.newEvent.start)
      };

      if (this.newEvent.until) {
        rruleOptions.until = new Date(this.newEvent.until);
      }

      const rruleString = new RRule(rruleOptions).toString();
      eventData.rrule = rruleString;
      // Also store in extendedProps to make it easier to access later
      eventData.extendedProps.rrule = rruleString;
      console.log('Generated rrule:', rruleString);
    }

    console.log('Saving event data:', eventData);

    if (this.editingEventId) {
      await this.eventService.updateEvent(eventData);
    } else {
      await this.eventService.addEvent(eventData);
    }

    // Reset editing state
    this.editingEventId = null;
    this.selectedObject = null;
    this.resetNewEvent();
    this.hideEventDialog();
  }

  resetNewEvent() {
    this.newEvent = {
      title: '',
      start: null,
      isRecurring: false,
      recurrencePattern: 'weekly', // Default to weekly
      until: null,
      type: 'message',
      message: '',
      assistant: null,
      object: null
    };
  }

  showFullscreenEditor() {
    this.fullscreenContent = this.newEvent.message;
    this.showFullscreenDialog = true;
  }

  hideFullscreenEditor() {
    this.newEvent.message = this.fullscreenContent;
    this.showFullscreenDialog = false;
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
