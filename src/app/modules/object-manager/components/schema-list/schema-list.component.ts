import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ObjectSchema } from '../../../../interfaces/object-system';
import { ObjectSchemaService } from '../../../../services/object-schema.service';
import { SchemaEditorComponent } from '../schema-editor/schema-editor.component';

@Component({
  selector: 'app-schema-list',
  templateUrl: './schema-list.component.html',
  styleUrls: ['./schema-list.component.scss'],
  host: {
    style: 'flex: 1; height: 100%; min-width: 0; display: flex; padding-right: 300px;'
  }
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
        try {
          await this.schemaService.createSchema(result);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Schema created successfully'
          });
          await this.loadSchemas();
        } catch (error) {
          console.error('Failed to create schema:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create schema'
          });
        }
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
        try {
          await this.schemaService.updateSchema(schema.id, result);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Schema updated successfully'
          });
          await this.loadSchemas();
        } catch (error) {
          console.error('Failed to update schema:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update schema'
          });
        }
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
