import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ObjectSchema } from '../../../../interfaces/object-system';
import { ObjectSchemaService } from '../../../../services/object-schema.service';
import { SchemaEditorComponent } from '../schema-editor/schema-editor.component';

@Component({
  selector: 'app-schema-list',
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">Schemas</h2>
        <p-button 
          label="New Schema" 
          icon="pi pi-plus"
          (onClick)="createSchema()">
        </p-button>
      </div>

      <p-table 
        [value]="schemas" 
        [loading]="loading"
        [paginator]="true" 
        [rows]="10"
        [rowHover]="true"
        styleClass="p-datatable-sm">
        
        <ng-template pTemplate="header">
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Last Modified</th>
            <th>Actions</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-schema>
          <tr>
            <td>{{ schema.name }}</td>
            <td>{{ schema.description }}</td>
            <td>{{ schema.updatedAt | date:'medium' }}</td>
            <td>
              <div class="flex gap-2">
                <p-button
                  icon="pi pi-list"
                  (onClick)="viewInstances(schema)"
                  [rounded]="true"
                  [text]="true"
                  severity="secondary"
                  pTooltip="View Instances">
                </p-button>
                <p-button
                  icon="pi pi-pencil"
                  (onClick)="editSchema(schema)"
                  [rounded]="true"
                  [text]="true"
                  pTooltip="Edit">
                </p-button>
                <p-button
                  icon="pi pi-trash"
                  (onClick)="confirmDelete(schema)"
                  [rounded]="true"
                  [text]="true"
                  severity="danger"
                  pTooltip="Delete">
                </p-button>
              </div>
            </td>
          </tr>
        </ng-template>
      </p-table>

      <p-confirmDialog></p-confirmDialog>
    </div>
  `
})
export class SchemaListComponent implements OnInit {
  schemas: ObjectSchema[] = [];
  loading = true;
  private dialogRef?: DynamicDialogRef;

  constructor(
    private schemaService: ObjectSchemaService,
    private router: Router,
    private dialogService: DialogService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  async ngOnInit() {
    await this.loadSchemas();
  }

  private async loadSchemas() {
    try {
      this.loading = true;
      this.schemas = await this.schemaService.listSchemas();
    } catch (error) {
      console.error('Failed to load schemas:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load schemas'
      });
    } finally {
      this.loading = false;
    }
  }

  createSchema() {
    this.dialogRef = this.dialogService.open(SchemaEditorComponent, {
      header: 'Create Schema',
      width: '70%',
      contentStyle: { overflow: 'auto' },
      baseZIndex: 10000,
      maximizable: true
    });

    this.dialogRef.onClose.subscribe(async (result) => {
      if (result) {
        await this.loadSchemas();
      }
    });
  }

  editSchema(schema: ObjectSchema) {
    this.dialogRef = this.dialogService.open(SchemaEditorComponent, {
      header: 'Edit Schema',
      width: '70%',
      contentStyle: { overflow: 'auto' },
      baseZIndex: 10000,
      maximizable: true,
      data: { schema }
    });

    this.dialogRef.onClose.subscribe(async (result) => {
      if (result) {
        await this.loadSchemas();
      }
    });
  }

  confirmDelete(schema: ObjectSchema) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the schema "${schema.name}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteSchema(schema)
    });
  }

  private async deleteSchema(schema: ObjectSchema) {
    try {
      await this.schemaService.deleteSchema(schema.id);
      await this.loadSchemas();
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Schema deleted successfully'
      });
    } catch (error) {
      console.error('Failed to delete schema:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete schema'
      });
    }
  }

  viewInstances(schema: ObjectSchema) {
    this.router.navigate(['/objects/instances', schema.id]);
  }
}
