import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { OpenAiApiService } from './open-ai-api.service';
import { Profile } from '../../lib/entities/AppConfig';

@Injectable({
  providedIn: 'root'
})
export class ProfileExportService {
  constructor(
    private configService: ConfigService,
    private openAiService: OpenAiApiService
  ) {}

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
        
        // Create assistants in OpenAI
        await this.createAssistantsInOpenAI(profile);
      }
    } catch (error) {
      console.error('Error importing profile:', error);
      throw new Error(`Failed to import profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create imported assistants in OpenAI
   * @param profile The profile containing the assistants to create
   */
  private async createAssistantsInOpenAI(profile: any): Promise<void> {
    try {
      // Get the assistants configuration from the profile
      const assistants = await window.electron.functions.load(profile.configDir, profile.id);
      
      if (!assistants) {
        console.log('No assistants found in imported profile');
        return;
      }

      // Create each assistant in OpenAI if it doesn't already exist
      for (const assistant of assistants) {
        try {
          // Check if assistant already exists
          await this.openAiService.getAssistant(assistant.openai?.id);
          console.log(`Assistant ${assistant.openai?.id} already exists in OpenAI`);
        } catch (error) {
          // Assistant doesn't exist, create it
          console.log(`Creating assistant ${assistant.openai?.id} in OpenAI`);
          
          if (!assistant.openai) {
            console.error('Missing OpenAI configuration for assistant');
            continue;
          }

          // Extract all OpenAI fields
          const {
            name,
            description,
            model,
            instructions,
            tools,
            file_ids,
            metadata,
            response_format,
            temperature,
            top_p
          } = assistant.openai;

          // Create the assistant with all OpenAI fields
          await this.openAiService.createAssistant({
            name,
            description,
            model,
            instructions,
            tools,
            file_ids: file_ids || [],
            metadata,
            response_format,
            temperature,
            top_p
          });
        }
      }
    } catch (error) {
      console.error('Error creating assistants in OpenAI:', error);
      throw new Error(`Failed to create assistants in OpenAI: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
