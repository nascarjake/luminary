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
import { ConfirmationService, MessageService } from 'primeng/api';

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
        <p-button icon="pi pi-trash" (onClick)="clearAllEvents()" styleClass="p-button-rounded p-button-text p-button-danger"></p-button>
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
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 1rem;
      background-color: #1e1e1e;
      color: #e0e0e0;
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

    :host ::ng-deep {
      /* Calendar container */
      .fc {
        height: calc(100vh - 150px);
        background-color: #1e1e1e;
      }

      /* Header styling */
      .fc-toolbar {
        padding: 1rem;
        margin-bottom: 0 !important;
      }

      .fc-toolbar-title {
        color: #e0e0e0 !important;
      }

      .fc-button {
        background-color: #333 !important;
        border-color: #444 !important;
        color: #e0e0e0 !important;
        
        &:hover {
          background-color: #444 !important;
          border-color: #555 !important;
        }

        &:focus {
          box-shadow: 0 0 0 2px rgba(255,255,255,0.1) !important;
        }
      }

      .fc-button-active {
        background-color: #444 !important;
        border-color: #555 !important;
      }

      /* Calendar grid */
      .fc-theme-standard td, 
      .fc-theme-standard th,
      .fc-theme-standard .fc-scrollgrid {
        border-color: #333 !important;
      }

      .fc-day-today {
        background-color: rgba(255,255,255,0.05) !important;
      }

      .fc-daygrid-day-number,
      .fc-col-header-cell-cushion {
        color: #e0e0e0;
        text-decoration: none !important;
      }

      /* Event styling */
      .fc-daygrid-event {
        display: flex;
        align-items: center;
        background-color: #2d4a22;
        border-color: #2d4a22;
        color: #e0e0e0;
        margin-bottom: 2px;
        padding: 2px 4px;

        &:hover {
          background-color: #3a5f2c;
        }

        &.completed {
          opacity: 0.7;
        }

        &.failed {
          border-left: 3px solid var(--red-500);
        }
      }

      .fc-daygrid-day-frame {
        min-height: 100px;
      }

      .fc-daygrid-day-events {
        margin-bottom: 0;
      }

      /* More events link */
      .fc-daygrid-more-link {
        color: #4caf50;
        font-weight: bold;
      }

      /* Popover */
      .fc-popover {
        background-color: #2d2d2d;
        border-color: #333;

        .fc-popover-header {
          background-color: #333;
          color: #e0e0e0;
        }
      }

      /* Status indicators */
      .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 4px;
      }

      .status-pending {
        background-color: #ffd700;
      }

      .status-completed {
        background-color: #4caf50;
      }

      .status-failed {
        background-color: var(--red-500);
      }
    }
  `],
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
    dayMaxEvents: false,
    events: [],
    height: '100%',
    contentHeight: 'auto',
    expandRows: true,
    handleWindowResize: true,
    windowResizeDelay: 100,
    eventDidMount: (info) => {
      // Handle recurring event status
      const eventDate = info.event.start?.toISOString();
      const completedOccurrences = info.event.extendedProps?.completedOccurrences || [];
      const isCompleted = info.event.extendedProps?.rrule 
        ? completedOccurrences.includes(eventDate)
        : info.event.extendedProps?.status === 'completed';
      
      // Create status dot
      const dot = document.createElement('span');
      dot.className = `status-dot status-${isCompleted ? 'completed' : (info.event.extendedProps?.status || 'pending')}`;
      info.el.prepend(dot);

      // Add tooltip with status and completion info
      let tooltip = `Status: ${isCompleted ? 'completed' : (info.event.extendedProps?.status || 'pending')}`;
      if (info.event.extendedProps?.lastRun) {
        tooltip += `\nLast Run: ${new Date(info.event.extendedProps.lastRun).toLocaleString()}`;
      }
      if (info.event.extendedProps?.error) {
        tooltip += `\nError: ${info.event.extendedProps.error}`;
      }
      info.el.title = tooltip;

      // Style based on status
      if (isCompleted) {
        info.el.style.opacity = '0.7';
      } else if (info.event.extendedProps?.status === 'failed') {
        info.el.style.borderLeft = '3px solid var(--red-500)';
      }
    },
    select: this.handleDateSelect.bind(this),
    eventClick: this.handleEventClick.bind(this),
    datesSet: (dateInfo) => {
      console.log('Calendar view changed/updated. Events:', this.calendarOptions.events);
      if (this.events.length !== this.calendarOptions.events) {
        console.log('Event count mismatch - updating calendar');
        this.calendarOptions = {
          ...this.calendarOptions,
          events: [...this.events]
        };
      }
    }
  };

  newEvent = {
    title: '',
    start: null,
    isRecurring: false,
    recurrencePattern: 'weekly',
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
    private eventService: EventService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  async ngOnInit() {
    await this.loadAssistants();
    await this.objectInstanceService.initialize();
    await this.loadObjects();
    await this.eventService.loadEvents();
    this.subscriptions.push(
      this.eventService.events$.subscribe(events => {
        console.log('Events subscription update:', events.length, 'events');
        this.events = events;
        this.calendarOptions = {
          ...this.calendarOptions,
          events: [...events]
        };
        console.log('Calendar events after update:', this.calendarOptions.events);
      })
    );

    // Subscribe to profile and project changes to reload objects
    this.subscriptions.push(
      this.configService.activeProfile$.subscribe(() => {
        this.loadObjects();
      }),
      this.configService.activeProject$.subscribe(() => {
        this.loadObjects();
      })
    );
  }

  async loadAssistants() {
    const response = await this.openAiService.listAssistants();
    this.assistants = response.data;
  }

  async loadObjects() {
    const schemas = await this.objectSchemaService.listSchemas();
    const schemaMap = new Map(schemas.map(s => [s.id, s]));
    
    this.objectInstanceService.instances.subscribe(instances => {
      this.objects = instances.map(instance => ({
        ...instance,
        schemaName: schemaMap.get(instance.schemaId)?.name || 'Unknown Schema',
        displayName: instance.data?.name || instance.data?.title || instance.data?.key || instance.data?.message || instance.id
      }))
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
    this.editingEventId = null;
    this.resetNewEvent();
    this.newEvent.start = selectInfo.start;
    this.showEventDialog();
  }

  parseRruleUntilDate(dateStr: string): Date {
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
    
    const rrule = event._def.extendedProps?.rrule;
    console.log('Event rrule:', rrule);
    
    this.editingEventId = event.id;
    
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

    if (this.newEvent.type === 'object' && this.newEvent.object) {
      this.selectedObject = this.newEvent.object;
    }

    this.showEventDialog();
  }

  async showEventDialog() {
    // If there's an assistant selected, load its inputs
    if (this.newEvent.assistant) {
      const profile = this.configService.getActiveProfile();
      const project = this.configService.getActiveProject();
      
      if (profile && project) {
        const config = await this.functionImplementationsService.loadFunctionImplementations(
          profile.id,
          project.id,
          this.newEvent.assistant.id
        );
        this.selectedAssistantInputs = config.inputs || [];
        this.filterObjectsByAssistantInputs();
      }
    } else {
      // No assistant selected, show all objects
      this.selectedAssistantInputs = [];
      this.filteredObjects = [...this.objects];
    }
    
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
        const matchesSchema = schemaName.includes(term);
        
        const matchesName = nameFields.some(field => field.includes(term));
        
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
      eventData.extendedProps.rrule = rruleString;
      console.log('Generated rrule:', rruleString);
    }

    console.log('Saving event data:', eventData);

    if (this.editingEventId) {
      await this.eventService.updateEvent(eventData);
    } else {
      await this.eventService.addEvent(eventData);
    }

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
      recurrencePattern: 'weekly',
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

  public clearAllEvents(): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to clear all scheduled events? This action cannot be undone.',
      header: 'Clear All Events',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          await this.eventService.clearAllEvents();
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'All events have been cleared'
          });
        } catch (error) {
          console.error('Failed to clear events:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to clear events'
          });
        }
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
