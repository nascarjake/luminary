import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';
import { Project } from '../../../lib/entities/AppConfig';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TableModule,
    FormsModule,
    ConfirmDialogModule,
    ToastModule
  ],
  providers: [
    ConfirmationService,
    MessageService
  ],
  template: `
    <div class="project-list">
      <div class="header">
        <h2>Projects</h2>
        <button pButton 
                label="New Project" 
                icon="pi pi-plus" 
                (click)="showNewProjectDialog()">
        </button>
      </div>

      <p-table [value]="projects" 
               [tableStyle]="{ 'min-width': '50rem' }"
               [scrollable]="true"
               [style]="{ width: '100%' }">
        <ng-template pTemplate="header">
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Created</th>
            <th>Last Modified</th>
            <th>Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-project>
          <tr [class.active-project]="project.id === activeProjectId">
            <td>{{project.name}}</td>
            <td>{{project.description}}</td>
            <td>{{project.created | date}}</td>
            <td>{{project.lastModified | date}}</td>
            <td>
              <div class="flex gap-2">
                <button pButton 
                        [label]="project.id === activeProjectId ? 'Active' : 'Switch'"
                        [disabled]="project.id === activeProjectId"
                        (click)="switchProject(project)">
                </button>
                <button pButton 
                        icon="pi pi-trash"
                        style="margin-left: 10px"
                        class="p-button-danger"
                        [disabled]="project.id === activeProjectId"
                        (click)="deleteProject(project)">
                </button>
              </div>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="showDialog" 
              [header]="'New Project'" 
              [modal]="true"
              [style]="{ width: '450px' }">
      <div class="project-form">
        <div class="field">
          <label for="name">Project Name</label>
          <input id="name" 
                 style="width: 100%"
                 type="text" 
                 pInputText 
                 [(ngModel)]="newProject.name" 
                 class="w-full">
        </div>
        <div class="field">
          <label for="description">Description (Optional)</label>
          <input id="description" 
                 style="width: 100%"  
                 type="text" 
                 pInputText 
                 [(ngModel)]="newProject.description" 
                 class="w-full">
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton 
                label="Cancel" 
                icon="pi pi-times" 
                (click)="hideDialog()" 
                class="p-button-text">
        </button>
        <button pButton 
                label="Create" 
                icon="pi pi-check" 
                (click)="createProject()" 
                [disabled]="!newProject.name">
        </button>
      </ng-template>
    </p-dialog>
    <p-confirmDialog></p-confirmDialog>
    <p-toast></p-toast>
  `,
  styles: [`
    .project-list {
      padding: 2rem;
      
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        
        h2 {
          margin: 0;
        }
      }
      
      .active-project {
        background-color: #2a2929;
      }
    }

    .project-form {
      .field {
        margin-bottom: 1.5rem;
        
        label {
          display: block;
          margin-bottom: 0.5rem;
        }
      }
    }
  `]
})
export class ProjectListComponent implements OnInit {
  projects: Project[] = [];
  activeProjectId?: string;
  showDialog = false;
  newProject: Partial<Project> = {};
  activeProfile: any;

  constructor(
    private configService: ConfigService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    const profile = this.configService.getActiveProfile();
    if (profile) {
      this.projects = this.configService.getProjects(profile.id);
      this.activeProjectId = profile.activeProjectId;
      this.activeProfile = profile;
    }
  }

  showNewProjectDialog() {
    this.newProject = {};
    this.showDialog = true;
  }

  hideDialog() {
    this.showDialog = false;
  }

  createProject() {
    const profile = this.configService.getActiveProfile();
    if (profile && this.newProject.name) {
      this.configService.createProject(
        profile.id,
        this.newProject.name,
        this.newProject.description
      );
      this.loadProjects();
      this.hideDialog();
    }
  }

  switchProject(project: Project) {
    this.configService.setActiveProject(project.id);
    this.activeProjectId = project.id;
  }

  public deleteProject(project: Project): void {
    if (!this.activeProfile?.id) return;

    this.confirmationService.confirm({
      message: `Are you sure you want to delete the project "${project.name}"?`,
      header: 'Delete Project',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.configService.deleteProject(this.activeProfile.id, project.id);
        this.projects = this.configService.getProjects(this.activeProfile.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Project Deleted',
          detail: 'The project has been successfully removed.'
        });
      }
    });
  }
}
