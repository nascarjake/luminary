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

@Component({
  selector: 'app-output-list',
  standalone: true,
  imports: [CommonModule, TableModule, DialogModule, ButtonModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '90vw' }"
      [draggable]="false"
      [resizable]="false"
      header="Generated Outputs"
    >
      <p-table [value]="outputs$ | async" [tableStyle]="{ 'min-width': '50rem' }">
        <ng-template pTemplate="header">
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-output>
          <tr>
            <td>{{ getOutputTitle(output.instance) }}</td>
            <td>{{ output.schema?.name || 'Unknown Type' }}</td>
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
  `]
})
export class OutputListComponent implements OnInit, OnDestroy {
  visible = false;
  outputs$ = new BehaviorSubject<OutputDisplay[]>([]);
  private subscription?: Subscription;

  constructor(
    private schemaService: ObjectSchemaService,
    private instanceService: ObjectInstanceService
  ) {}

  ngOnInit() {
    // Subscribe to all instances and filter for final outputs
    this.subscription = this.instanceService.instances.pipe(
      map(instances => instances
        .filter(instance => instance.isFinalOutput)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      ),
      // For each instance, load its schema
      switchMap(instances => {
        if (instances.length === 0) {
          return from([[]]);
        }
        
        const outputPromises = instances.map(async instance => {
          const schema = await this.schemaService.getSchema(instance.schemaId);
          return { instance, schema };
        });
        
        return from(Promise.all(outputPromises));
      })
    ).subscribe(outputs => {
      this.outputs$.next(outputs);
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
