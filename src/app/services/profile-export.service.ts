import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { Profile } from '../../lib/entities/AppConfig';

@Injectable({
  providedIn: 'root'
})
export class ProfileExportService {
  constructor(private configService: ConfigService) {}

  /**
   * Export a profile's configuration to a zip file
   * Excludes: API keys, threads, overlays, and instances
   */
  async exportProfile(profileId: string): Promise<Blob> {
    try {
      const zipData = await window.electron.profile.export(profileId);
      return new Blob([zipData], { type: 'application/zip' });
    } catch (error) {
      console.error('Error exporting profile:', error);
      throw new Error(`Failed to export profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Import a profile configuration from a zip file
   * @param profileId The ID of the profile to import into
   * @param zipFile The zip file containing the profile configuration
   */
  async importProfile(profileId: string, zipFile: File): Promise<void> {
    try {
      const arrayBuffer = await zipFile.arrayBuffer();
      const zipData = new Uint8Array(arrayBuffer);
      
      await window.electron.profile.import(profileId, zipData);
      
      // Refresh the profile in ConfigService
      const profile = this.configService.getProfile(profileId);
      if (profile) {
        this.configService.updateProfile(profile);
      }
    } catch (error) {
      console.error('Error importing profile:', error);
      throw new Error(`Failed to import profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
