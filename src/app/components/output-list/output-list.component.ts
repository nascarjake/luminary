import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Subscription, map, BehaviorSubject, switchMap, from, combineLatest } from 'rxjs';
import { ObjectSchemaService } from '../../services/object-schema.service';
import { ObjectInstanceService } from '../../services/object-instance.service';
import { ObjectInstance, ObjectSchema } from '../../interfaces/object-system';

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
              <td>
                <p-button
                  icon="pi pi-download"
                  (onClick)="downloadOutput(output.instance)"
                  [rounded]="true"
                  [text]="true"
                  [disabled]="!canDownload(output.instance)"
                ></p-button>
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
        
        // Create groups for each schema
        const groups: OutputGroup[] = [];
        
        for (const schema of finalOutputSchemas) {
          // Get instances for this schema
          const schemaInstances = instances
            .filter(instance => instance.schemaId === schema.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          if (schemaInstances.length > 0) {
            groups.push({
              schemaName: schema.name,
              outputs: schemaInstances.map(instance => ({
                instance,
                schema
              }))
            });
          }
        }
        
        return groups;
      })
    ).subscribe(groups => {
      this.outputGroups$.next(groups);
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  show() {
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }

  getOutputTitle(output: ObjectInstance): string {
    if (typeof output.data === 'object') {
      return output.data.title || output.data.name || 'Untitled Output';
    }
    return 'Untitled Output';
  }

  canDownload(output: ObjectInstance): boolean {
    if (typeof output.data !== 'object') return false;
    return !!(output.data.content || output.data.file || output.data.url);
  }

  async downloadOutput(output: ObjectInstance) {
    if (!this.canDownload(output)) return;

    try {
      const data = output.data;
      const source = data.url || data.file || data.content;
      const title = this.getOutputTitle(output);
      
      await window.electron.download.downloadFile(source, title);
    } catch (error) {
      console.error('Error downloading output:', error);
    }
  }
}
