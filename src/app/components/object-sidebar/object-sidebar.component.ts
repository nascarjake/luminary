import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ContextMenuModule } from 'primeng/contextmenu';
import { MenuItem } from 'primeng/api';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { PrettyJsonPipe } from '../../pipes/pretty-json.pipe';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { ObjectSchemaService, ObjectInstanceService } from '../../services/object-system.service';
import { ObjectSchema, ObjectInstance, ObjectField, MediaType } from '../../interfaces/object-system';
import { Subscription, combineLatest, startWith } from 'rxjs';
import { InstanceEditorComponent } from '../../modules/object-manager/components/instance-editor/instance-editor.component';
import { ScheduleDialogComponent } from '../schedule-dialog/schedule-dialog.component';
import { OAAssistant } from '../../../lib/entities/OAAssistant';

@Component({
  selector: 'app-object-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    TreeModule,
    PanelModule,
    ButtonModule,
    ConfirmDialogModule,
    ContextMenuModule,
    ScheduleDialogComponent,
    PrettyJsonPipe,
    TimeAgoPipe
  ],
  providers: [ConfirmationService, MessageService, DialogService],
  templateUrl: './object-sidebar.component.html',
  styleUrls: ['./object-sidebar.component.scss']
})
export class ObjectSidebarComponent implements OnInit, OnDestroy {
  treeData: TreeNode[] = [];
  selectedNode: TreeNode | null = null;
  selectedObject: ObjectInstance | null = null;
  selectedSchema: ObjectSchema | null = null;
  loading = true;
  private subscriptions: Subscription[] = [];
  contextMenuItems: MenuItem[] = [];
  @Output() deleteNode = new EventEmitter<TreeNode>();
  @Output() scheduleEvent = new EventEmitter<any>();
  @Input() assistants: OAAssistant[] = [];
  private dialogRef: DynamicDialogRef | null = null;

  constructor(
    private schemaService: ObjectSchemaService,
    private instanceService: ObjectInstanceService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private dialogService: DialogService
  ) {
    this.initContextMenu();
  }

  ngOnInit() {
    this.subscribeToObjects();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }

  private subscribeToObjects() {
    // Subscribe to both schemas and instances with initial values
    const sub = combineLatest({
      schemas: this.schemaService.schemas.pipe(startWith([])),
      instances: this.instanceService.instances.pipe(startWith([]))
    }).subscribe({
      next: ({schemas, instances}) => {
        console.log('Object tree update - Schemas:', schemas.length, 'Instances:', instances.length);
        this.updateTreeData(schemas, instances);
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load objects:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load objects.'
        });
        this.loading = false;
      }
    });
    this.subscriptions.push(sub);

    // Also subscribe to individual streams for debugging
    this.subscriptions.push(
      this.schemaService.schemas.subscribe(schemas => {
        console.log('Schemas updated:', schemas.length);
      })
    );

    this.subscriptions.push(
      this.instanceService.instances.subscribe(instances => {
        console.log('Instances updated:', instances.length);
      })
    );
  }

  private updateTreeData(schemas: ObjectSchema[], instances: ObjectInstance[]) {
    console.log('Updating tree data with:', schemas.length, 'schemas and', instances.length, 'instances');
    
    // Group instances by schema ID
    const instancesBySchema = instances.reduce((acc, instance) => {
      const schemaId = instance.schemaId;
      if (!acc[schemaId]) acc[schemaId] = [];
      acc[schemaId].push(instance);
      return acc;
    }, {} as Record<string, ObjectInstance[]>);

    // Create tree nodes for each schema
    this.treeData = schemas.map(schema => ({
      label: schema.name,
      data: { type: 'schema', schemaId: schema.id },
      expandedIcon: 'pi pi-folder-open',
      collapsedIcon: 'pi pi-folder',
      children: (instancesBySchema[schema.id] || []).map(instance => 
        this.createLeafNode(instance, schema)
      ),
      expanded: true
    }));
  }

  private createLeafNode(instance: ObjectInstance, schema: ObjectSchema): TreeNode {
    const title = instance.data.title || instance.data.name || instance.id;
    return {
      label: title,
      data: {
        type: 'instance',
        schemaId: schema.id,
        instanceId: instance.id,
        instance
      },
      icon: 'pi pi-file'
    };
  }

  // Media helper methods
  hasMediaField(schema: ObjectSchema, instance: ObjectInstance): boolean {
    // Check if any media field in the schema has corresponding data in the instance
    return schema.fields.some(field => 
      field.isMedia && instance.data[field.name] != null
    );
  }

  getMediaFields(schema: ObjectSchema): ObjectField[] {
    // Get all media fields from the schema
    return schema.fields.filter(field => field.isMedia);
  }

  getMediaType(field: ObjectField): MediaType | null {
    // Only check schema-level field definition
    if (!field.isMedia) {
      return null;
    }

    // First check if mediaType is explicitly set in validation
    if (field.validation?.mediaType) {
      return field.validation.mediaType;
    }

    // If no explicit mediaType, try to infer from field definition
    const fieldNameLower = field.name.toLowerCase();
    const pattern = field.validation?.pattern?.toLowerCase() || '';

    if (fieldNameLower.includes('video') || pattern.includes('mp4') || pattern.includes('webm') || pattern.includes('mov')) {
      return 'video';
    }
    if (fieldNameLower.includes('image') || pattern.includes('jpg') || pattern.includes('jpeg') || pattern.includes('png') || pattern.includes('gif')) {
      return 'image';
    }
    if (fieldNameLower.includes('audio') || pattern.includes('mp3') || pattern.includes('wav')) {
      return 'audio';
    }

    // Default to 'image' if no specific type can be inferred
    return 'image';
  }

  onNodeSelect(event: { node: TreeNode }) {
    const node = event.node;
    if (node.data.type === 'instance') {
      this.selectedObject = node.data.instance;
      // Get the schema for the selected instance
      this.schemaService.getSchema(this.selectedObject.schemaId).then(schema => {
        this.selectedSchema = schema;
      });
    } else {
      this.selectedObject = null;
      this.selectedSchema = null;
    }
  }

  onNodeContextMenu(event: any) {
    if (event && event.originalEvent && event.node) {
      event.originalEvent.preventDefault();
      this.selectedNode = event.node;
    }
  }

  private initContextMenu() {
    this.contextMenuItems = [
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        command: () => this.editObject()
      },
      {
        label: 'Schedule',
        icon: 'pi pi-calendar',
        command: () => this.scheduleObject()
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: () => this.confirmDeleteNode()
      }
    ];
  }

  editObject() {
    if (!this.selectedNode?.data) return;

    const ref = this.dialogService.open(InstanceEditorComponent, {
      header: 'Edit Object',
      width: '80%',
      data: {
        instance: this.selectedNode.data.instance,
        mode: 'edit'
      }
    });

    ref.onClose.subscribe(async (result) => {
      if (result) {
        // Refresh the tree
        // You'll need to implement this based on your data structure
      }
    });
  }

  async scheduleObject() {
    if (!this.selectedNode?.data) return;

    this.dialogRef = this.dialogService.open(ScheduleDialogComponent, {
      header: 'Schedule Event',
      width: '50%',
      style: {
        'max-height': '90vh'
      },
      data: {
        assistants: this.assistants,
        selectedObject: this.selectedNode.data.instance,
        defaultEventType: 'object'
      }
    });

    this.dialogRef.onClose.subscribe((result) => {
      if (result) {
        this.scheduleEvent.emit(result);
      }
    });
  }

  confirmDeleteNode() {
    if (this.selectedNode) {
      this.confirmationService.confirm({
        message: 'Are you sure you want to delete this item?',
        header: 'Delete Confirmation',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
          this.deleteNode.emit(this.selectedNode);
        }
      });
    }
  }

  getLocalResourceUrl(filePath: string): string {
    if (!filePath) return '';
    
    // Remove any existing protocol
    filePath = filePath.replace(/^(file|local-resource):\/\//, '');
    
    // On Windows, remove the colon after drive letter if present
    if (navigator.platform.startsWith('Win')) {
      filePath = filePath.replace(/^([a-zA-Z]):/, '$1');
    }
    
    return `local-resource://${filePath}`;
  }

  async copyToClipboard(content: any) {
    try {
      const textToCopy = typeof content === 'string' 
        ? content 
        : JSON.stringify(content, null, 2);
      
      await navigator.clipboard.writeText(textToCopy);
      this.messageService.add({
        severity: 'success',
        summary: 'Copied',
        detail: 'Content copied to clipboard',
        life: 3000
      });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to copy content',
        life: 3000
      });
    }
  }
}
