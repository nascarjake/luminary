import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { OpenAiApiService } from './open-ai-api.service';
import { Profile } from '../../lib/entities/AppConfig';

@Injectable({
  providedIn: 'root'
})
export class ProfileExportService {
  baseDir?: string;

  constructor(
    private configService: ConfigService,
    private openAiService: OpenAiApiService
  ) {
    this.ensureBaseDir();
  }

  private async ensureBaseDir(): Promise<string> {
    if (!this.baseDir) {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      // Get the app config directory
      this.baseDir = await window.electron.path.appConfigDir();
    }
    return this.baseDir;
  }

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
  private async createAssistantsInOpenAI(profile: Profile): Promise<void> {
    try {
      // Get the active project ID
      const activeProjectId = profile.activeProjectId;
      if (!activeProjectId) {
        console.error('No active project found in profile');
        return;
      }

      // Get all assistants for the project
      const assistants = await window.electron.assistant.list(
        this.baseDir, 
        profile.id,
        activeProjectId
      );
      
      if (!assistants || assistants.length === 0) {
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
            metadata,
            response_format,
            temperature,
            top_p
          } = assistant.openai;

          // Create the assistant with all OpenAI fields
          const createdAssistant = await this.openAiService.createAssistant({
            name,
            description,
            model,
            instructions,
            tools,
            metadata,
            response_format,
            temperature,
            top_p
          });

          // Get the old and new file paths
          const oldAssistantId = assistant.openai.id;
          const newAssistantId = createdAssistant.id;
          const oldFilename = `assistant-${profile.id}-${oldAssistantId}.json`;
          const newFilename = `assistant-${profile.id}-${newAssistantId}.json`;
          
          const oldPath = await window.electron.path.join(this.baseDir, oldFilename);
          const newPath = await window.electron.path.join(this.baseDir, newFilename);

          // Update the assistant's OpenAI ID
          assistant.openai.id = newAssistantId;

          // Save the updated assistant configuration
          await window.electron.fs.writeTextFile(newPath, JSON.stringify(assistant, null, 2));

          // Delete the old file
          if (oldPath !== newPath) {
            try {
              await window.electron.fs.removeTextFile(oldPath);
            } catch (error) {
              console.error('Error removing old assistant file:', error);
            }
          }

          console.log(`Assistant created with ID ${newAssistantId}`);
        }
      }
    } catch (error) {
      console.error('Error creating assistants in OpenAI:', error);
      throw error;
    }
  }
}
