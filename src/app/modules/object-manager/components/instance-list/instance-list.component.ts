import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { ObjectSchemaService } from '../../../../services/object-schema.service';
import { ObjectInstanceService } from '../../../../services/object-instance.service';
import { ObjectSchema, ObjectInstance, ObjectField } from '../../../../interfaces/object-system';
import { InstanceEditorComponent } from '../instance-editor/instance-editor.component';

@Component({
  selector: 'app-instance-list',
  templateUrl: './instance-list.component.html',
  styleUrls: ['./instance-list.component.scss'],
  host: {
    style: 'flex: 1; height: 100%; min-width: 0; display: flex; padding-right: 300px;'
  },
  providers: [DialogService]
})
export class InstanceListComponent implements OnInit, OnDestroy {
  schema?: ObjectSchema;
  instances: ObjectInstance[] = [];
  loading = true;
  private schemaId?: string;
  private subscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private schemaService: ObjectSchemaService,
    private instanceService: ObjectInstanceService,
    private dialogService: DialogService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.subscription = this.route.params.subscribe(params => {
      const schemaId = params['schemaId'];
      if (schemaId) {
        this.schemaId = schemaId;
        this.loadSchema(schemaId);
        this.loadInstances(schemaId);
      }
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  private async loadSchema(schemaId: string) {
    try {
      this.schema = await this.schemaService.getSchema(schemaId);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load schema'
      });
    }
  }

  private async loadInstances(schemaId: string) {
    this.loading = true;
    try {
      this.instances = await this.instanceService.getInstances(schemaId);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load instances'
      });
    } finally {
      this.loading = false;
    }
  }

  openInstanceEditor(mode: 'create' | 'edit', instance?: ObjectInstance) {
    if (!this.schema) return;

    const ref = this.dialogService.open(InstanceEditorComponent, {
      header: `${mode === 'create' ? 'Create' : 'Edit'} Instance`,
      width: '90vw',
      style: { maxWidth: '1400px' },
      contentStyle: { overflow: 'auto' },
      maximizable: true,
      data: {
        mode,
        schema: this.schema,
        instance
      }
    });

    ref.onClose.subscribe(async (result) => {
      if (result && this.schemaId) {
        await this.loadInstances(this.schemaId);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Instance ${mode === 'create' ? 'created' : 'updated'} successfully`
        });
      }
    });
  }

  confirmDelete(instance: ObjectInstance) {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this instance?',
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteInstance(instance)
    });
  }

  private async deleteInstance(instance: ObjectInstance) {
    if (!this.schemaId) return;

    try {
      await this.instanceService.deleteInstance(instance.id);
      await this.loadInstances(this.schemaId);
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Instance deleted successfully'
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete instance'
      });
    }
  }

  formatFieldValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.length} items]`;
      }
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      
      // If it's a content field, show a preview
      if ('content' in value) {
        const content = value.content as string;
        return content ? content.substring(0, 50) + (content.length > 50 ? '...' : '') : '';
      }
      
      return `{${keys.length} keys}`;
    }

    if (typeof value === 'string') {
      return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }

    return String(value);
  }

  formatTooltip(value: any): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  getPreviewFields(): ObjectField[] {
    if (!this.schema) return [];
    
    // Prioritize certain field names if they exist
    const priorityFields = ['title', 'name', 'id', 'type', 'status'];
    const fields = [...this.schema.fields];
    
    fields.sort((a, b) => {
      const aIndex = priorityFields.indexOf(a.name.toLowerCase());
      const bIndex = priorityFields.indexOf(b.name.toLowerCase());
      
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    // Return at most 4 fields
    return fields.slice(0, 4);
  }
}
