import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNGModule } from '../../../shared/primeng.module';
import { OpenAiApiService } from '../../../services/open-ai-api.service';
import { OAAssistant } from '../../../../lib/entities/OAAssistant';
import { FunctionImplementationsService } from '../../../services/function-implementations.service';
import { ConfigService } from '../../../services/config.service';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';

@Component({
  selector: 'app-include-assistants',
  standalone: true,
  imports: [
    CommonModule,
    PrimeNGModule
  ],
  template: `
    <div class="card">
      <p-table
        #dt
        [value]="assistants"
        [loading]="loading"
        [paginator]="true"
        [rows]="10"
        [showCurrentPageReport]="true"
        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} assistants"
        [rowsPerPageOptions]="[10,25,50]"
        [globalFilterFields]="['name','description']"
      >
        <ng-template pTemplate="caption">
          <div class="flex justify-content-between align-items-center">
            <h5 class="m-0">Available Assistants</h5>
            <span class="p-input-icon-left">
              <i class="pi pi-search"></i>
              <input pInputText type="text" (input)="onGlobalFilter($event)" placeholder="Search assistants" />
            </span>
          </div>
        </ng-template>
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="name">Name <p-sortIcon field="name"></p-sortIcon></th>
            <th pSortableColumn="description">Description <p-sortIcon field="description"></p-sortIcon></th>
            <th pSortableColumn="model">Model <p-sortIcon field="model"></p-sortIcon></th>
            <th style="width: 100px">Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-assistant>
          <tr>
            <td>{{assistant.name}}</td>
            <td>{{assistant.description}}</td>
            <td>{{assistant.model}}</td>
            <td>
              <button pButton 
                     icon="pi pi-plus" 
                     class="p-button-rounded p-button-success" 
                     (click)="includeAssistant(assistant)"
                     [loading]="includingAssistant === assistant.id"
                     pTooltip="Include in profile"></button>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [`
    :host ::ng-deep .p-datatable .p-datatable-header {
      background: transparent;
      border: none;
      padding: 1.5rem 1rem;
    }
  `],
  providers: [MessageService]
})
export class IncludeAssistantsComponent implements OnInit {
  @ViewChild('dt') table!: Table;
  assistants: OAAssistant[] = [];
  loading = false;
  includingAssistant: string | null = null;

  constructor(
    private openAiService: OpenAiApiService,
    private functionImplementationsService: FunctionImplementationsService,
    private configService: ConfigService,
    private messageService: MessageService
  ) {
    // Subscribe to project changes
    this.configService.activeProject$.subscribe(project => {
      if (project) {
        console.log('Active project changed, reloading assistants...');
        this.loadAssistants();
      }
    });
  }

  ngOnInit() {
    this.loadAssistants();
  }

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.table.filterGlobal(value, 'contains');
  }

  async loadAssistants() {
    this.loading = true;
    try {
      const response = await this.openAiService.listAssistants(false, true);
      this.assistants = response.data;
    } catch (error) {
      console.error('Error loading assistants:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load assistants'
      });
    } finally {
      this.loading = false;
    }
  }

  async includeAssistant(assistant: OAAssistant) {
    this.includingAssistant = assistant.id;
    try {
      const activeProfile = await this.configService.getActiveProfile();
      const activeProject = await this.configService.getActiveProject();
      
      if (!activeProfile || !activeProject) {
        throw new Error('No active profile or project');
      }

      // Save the assistant to the profile
      await this.functionImplementationsService.saveFunctionImplementations(
        activeProfile.id,
        activeProject.id,
        assistant.id,
        assistant.name,
        [], // empty functions array since we're just including it
        [],
        [],
        undefined,
        undefined,
        {
          id: assistant.id,
          name: assistant.name,
          description: assistant.description,
          model: assistant.model,
          instructions: assistant.instructions,
          tools: assistant.tools,
          file_ids: assistant.file_ids,
          metadata: assistant.metadata,
          temperature: assistant.temperature,
          top_p: assistant.top_p,
          response_format: assistant.response_format
        }
      );

      // Remove from the list
      this.assistants = this.assistants.filter(a => a.id !== assistant.id);

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Assistant added to profile successfully'
      });
    } catch (error) {
      console.error('Error including assistant:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to include assistant'
      });
    } finally {
      this.includingAssistant = null;
    }
  }
}