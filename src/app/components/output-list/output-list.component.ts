import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Subscription, map, BehaviorSubject, switchMap, from, combineLatest } from 'rxjs';
import { ObjectSchemaService } from '../../services/object-schema.service';
import { ObjectInstanceService } from '../../services/object-instance.service';
import { ObjectInstance, ObjectSchema, ObjectField, MediaType } from '../../interfaces/object-system';

interface OutputDisplay {
  instance: ObjectInstance;
  schema?: ObjectSchema;
}

interface OutputGroup {
  schemaName: string;
  outputs: OutputDisplay[];
}

@Component({
  selector: 'app-output-list',
  standalone: true,
  imports: [CommonModule, TableModule, DialogModule, ButtonModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [header]="'Generated Outputs'"
      [style]="{ width: '90vw', height: '90vh' }"
      [maximizable]="true"
      [draggable]="false"
      [resizable]="false"
    >
      <div *ngFor="let group of outputGroups$ | async">
        <h3>{{ group.schemaName }}</h3>
        <p-table [value]="group.outputs" [tableStyle]="{ 'min-width': '50rem' }">
          <ng-template pTemplate="header">
            <tr>
              <th>Name</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-output>
            <tr>
              <td>{{ getOutputTitle(output.instance) }}</td>
              <td>{{ output.instance.createdAt | date:'medium' }}</td>
              <td class="flex gap-2">
                <ng-container *ngIf="output.schema">
                  <ng-container *ngFor="let field of getMediaFields(output.schema)">
                    <ng-container *ngIf="output.instance.data[field.name]">
                      <!-- Image button -->
                      <p-button *ngIf="getMediaType(field) === 'image'"
                        icon="pi pi-image"
                        (onClick)="openMedia(output.instance.data[field.name])"
                        [rounded]="true"
                        [text]="true"
                        pTooltip="View Image"
                      ></p-button>
                      
                      <!-- Video button -->
                      <p-button *ngIf="getMediaType(field) === 'video'"
                        icon="pi pi-video"
                        (onClick)="openMedia(output.instance.data[field.name])"
                        [rounded]="true"
                        [text]="true"
                        pTooltip="View Video"
                      ></p-button>
                      
                      <!-- Audio button -->
                      <p-button *ngIf="getMediaType(field) === 'audio'"
                        icon="pi pi-volume-up"
                        (onClick)="openMedia(output.instance.data[field.name])"
                        [rounded]="true"
                        [text]="true"
                        pTooltip="Play Audio"
                      ></p-button>
                    </ng-container>
                  </ng-container>
                </ng-container>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </p-dialog>
  `,
  styles: [`
    .output-list {
      padding: 1rem;
    }
    :host ::ng-deep .p-dialog-content {
      overflow-y: auto;
      max-height: calc(90vh - 120px);
    }
    h3 {
      margin-top: 1.5rem;
      margin-bottom: 1rem;
      color: var(--surface-900);
    }
    h3:first-child {
      margin-top: 0;
    }
    .flex {
      display: flex;
    }
    .gap-2 {
      gap: 0.5rem;
    }
  `]
})
export class OutputListComponent implements OnInit, OnDestroy {
  visible = false;
  outputGroups$ = new BehaviorSubject<OutputGroup[]>([]);
  private subscription?: Subscription;

  constructor(
    private schemaService: ObjectSchemaService,
    private instanceService: ObjectInstanceService
  ) {}

  ngOnInit() {
    // Subscribe to both schemas and instances
    this.subscription = combineLatest([
      this.schemaService.schemas,
      this.instanceService.instances
    ]).pipe(
      map(([schemas, instances]) => {
        // Get final output schemas
        const finalOutputSchemas = schemas.filter(schema => schema.isFinalOutput);
        
        // Group instances by schema
        return finalOutputSchemas.map(schema => ({
          schemaName: schema.name,
          outputs: instances
            .filter(instance => instance.schemaId === schema.id)
            .map(instance => ({
              instance,
              schema
            }))
            .sort((a, b) => new Date(b.instance.createdAt).getTime() - new Date(a.instance.createdAt).getTime())
        }));
      })
    ).subscribe(groups => {
      this.outputGroups$.next(groups);
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  getOutputTitle(instance: ObjectInstance): string {
    return instance.data.title || instance.data.name || instance.id;
  }

  getMediaFields(schema: ObjectSchema): ObjectField[] {
    return schema.fields.filter(field => field.isMedia);
  }

  getMediaType(field: ObjectField): MediaType | undefined {
    return field.validation?.mediaType;
  }

  openMedia(path: string) {
    window.electron.fs.exists(path).then(exists => {
      if (exists) {
        const a = document.createElement('a');
        a.href = this.getLocalResourceUrl(path);
        a.target = '_blank';
        a.click();
      }
    });
  }

  private getLocalResourceUrl(filePath: string): string {
    if (!filePath) return '';
    
    // Remove any existing protocol
    filePath = filePath.replace(/^(file|local-resource):\/\//, '');
    
    // On Windows, remove the colon after drive letter if present
    if (navigator.platform.startsWith('Win')) {
      filePath = filePath.replace(/^([a-zA-Z]):/, '$1');
    }
    
    return `local-resource://${filePath}`;
  }

  show() {
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }
}
