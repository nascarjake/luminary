import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { GeneratedObjectsService, Video } from '../../services/generated-objects.service';
import { Subscription } from 'rxjs';

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
      header="Generated Videos"
    >
      <p-table [value]="videos" [tableStyle]="{ 'min-width': '50rem' }">
        <ng-template pTemplate="header">
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-video>
          <tr>
            <td>{{ video.name }}</td>
            <td>Completed</td>
            <td>{{ video.createdAt | date:'medium' }}</td>
            <td>
              <p-button
                icon="pi pi-download"
                (onClick)="downloadVideo(video)"
                [rounded]="true"
                [text]="true"
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
  videos: Video[] = [];
  private subscription?: Subscription;

  constructor(private generatedObjects: GeneratedObjectsService) {}

  ngOnInit() {
    this.subscription = this.generatedObjects.videos.subscribe(videos => {
      // Sort videos by createdAt in descending order (latest first)
      this.videos = [...videos].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
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

  async downloadVideo(video: Video) {
    if (video.url) {
      try {
        await window.electron.download.downloadFile(video.url, video.name);
      } catch (error) {
        console.error('Error downloading video:', error);
      }
    }
  }
}
