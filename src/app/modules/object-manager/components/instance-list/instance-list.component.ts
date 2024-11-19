import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { ObjectSchemaService } from '../../../../services/object-schema.service';
import { ObjectInstanceService } from '../../../../services/object-instance.service';
import { ObjectSchema, ObjectInstance } from '../../../../interfaces/object-system';
import { InstanceEditorComponent } from '../instance-editor/instance-editor.component';

@Component({
  selector: 'app-instance-list',
  template: `
    <div class="flex flex-col gap-4 p-4">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl">{{ schema?.name || 'Loading...' }} Instances</h2>
        <p-button 
          icon="pi pi-plus" 
          label="Create Instance"
          (onClick)="openInstanceEditor('create')">
        </p-button>
      </div>

      <p-table 
        [value]="instances" 
        [loading]="loading"
        [paginator]="true" 
        [rows]="10"
        [rowHover]="true"
        styleClass="p-datatable-sm">
        
        <ng-template pTemplate="header">
          <tr>
            <th *ngFor="let field of schema?.fields || []">{{ field.name }}</th>
            <th style="width: 100px">Actions</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-instance>
          <tr>
            <td *ngFor="let field of schema?.fields || []">
              {{ formatFieldValue(instance.data[field.name], field.type) }}
            </td>
            <td>
              <div class="flex gap-2">
                <button 
                  pButton 
                  icon="pi pi-pencil" 
                  class="p-button-text p-button-sm"
                  (click)="openInstanceEditor('edit', instance)">
                </button>
                <button 
                  pButton 
                  icon="pi pi-trash" 
                  class="p-button-text p-button-danger p-button-sm"
                  (click)="deleteInstance(instance)">
                </button>
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td [attr.colspan]="(schema?.fields?.length || 0) + 1" class="text-center p-4">
              No instances found. Click "Create Instance" to add one.
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-confirmDialog></p-confirmDialog>
  `,
  providers: [DialogService, ConfirmationService]
})
export class InstanceListComponent implements OnInit, OnDestroy {
  schema?: ObjectSchema;
  instances: ObjectInstance[] = [];
  loading = true;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private schemaService: ObjectSchemaService,
    private instanceService: ObjectInstanceService,
    private dialogService: DialogService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        const schemaId = params['schemaId'];
        if (schemaId) {
          this.loadSchema(schemaId);
          this.loadInstances(schemaId);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private async loadSchema(schemaId: string) {
    try {
      this.schema = await this.schemaService.getSchema(schemaId);
    } catch (error) {
      console.error('Failed to load schema:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load schema.'
      });
    }
  }

  private async loadInstances(schemaId: string) {
    this.loading = true;
    try {
      this.instances = await this.instanceService.getInstances(schemaId);
    } catch (error) {
      console.error('Failed to load instances:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load instances.'
      });
    } finally {
      this.loading = false;
    }
  }

  formatFieldValue(value: any, type: string): string {
    if (value === undefined || value === null) return '';

    switch (type) {
      case 'date':
        return new Date(value).toLocaleString();
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'array':
      case 'object':
        return JSON.stringify(value);
      default:
        return String(value);
    }
  }

  openInstanceEditor(mode: 'create' | 'edit', instance?: ObjectInstance) {
    if (!this.schema) return;

    const ref = this.dialogService.open(InstanceEditorComponent, {
      header: `${mode === 'create' ? 'Create' : 'Edit'} Instance`,
      width: '80%',
      data: {
        mode,
        schema: this.schema,
        instance
      }
    });

    ref.onClose.subscribe(result => {
      if (result) {
        this.loadInstances(this.schema!.id);
      }
    });
  }

  deleteInstance(instance: ObjectInstance) {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this instance?',
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          await this.instanceService.deleteInstance(instance.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Instance deleted successfully.'
          });
          this.loadInstances(this.schema!.id);
        } catch (error) {
          console.error('Failed to delete instance:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete instance.'
          });
        }
      }
    });
  }
}
