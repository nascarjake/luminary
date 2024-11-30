import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProfileExportService } from '../../services/profile-export.service';

@Component({
  selector: 'app-profile-export',
  standalone: true,
  imports: [CommonModule, ButtonModule, ToastModule],
  providers: [MessageService],
  template: `
    <div class="profile-export-container">
      <p-toast></p-toast>
      <div class="export-actions">
        <p-button 
          icon="pi pi-download" 
          label="Export Profile" 
          (onClick)="exportProfile()"
          [loading]="isExporting"
        ></p-button>
        <p-button 
          icon="pi pi-upload" 
          label="Import Profile" 
          (onClick)="triggerFileInput()"
          [loading]="isImporting"
        ></p-button>
        <input 
          #fileInput
          type="file" 
          accept=".zip"
          style="display: none"
          (change)="handleFileInput($event)"
        >
      </div>
    </div>
  `,
  styles: [`
    .profile-export-container {
      padding: 1rem;
    }
    .export-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
  `]
})
export class ProfileExportComponent {
  @Input() profileId!: string;
  
  isExporting = false;
  isImporting = false;

  constructor(
    private profileExportService: ProfileExportService,
    private messageService: MessageService
  ) {}

  async exportProfile() {
    this.isExporting = true;
    try {
      const blob = await this.profileExportService.exportProfile(this.profileId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profile-${this.profileId}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Profile exported successfully'
      });
    } catch (error) {
      console.error('Error exporting profile:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to export profile'
      });
    } finally {
      this.isExporting = false;
    }
  }

  triggerFileInput() {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  async handleFileInput(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isImporting = true;
    try {
      await this.profileExportService.importProfile(this.profileId, file);
      
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Profile imported successfully'
      });
    } catch (error) {
      console.error('Error importing profile:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to import profile'
      });
    } finally {
      this.isImporting = false;
      // Clear the file input
      (event.target as HTMLInputElement).value = '';
    }
  }
}
