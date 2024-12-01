import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNGModule } from '../../shared/primeng.module';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { OAAssistant } from '../../../lib/entities/OAAssistant';
import { AssistantFormComponent } from './assistant-form/assistant-form.component';
import { FunctionImplementationsService } from '../../services/function-implementations.service';
import { ConfigService } from '../../services/config.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Profile, Project } from '../../../lib/entities/AppConfig';

@Component({
  selector: 'app-assistants',
  standalone: true,
  imports: [
    CommonModule,
    PrimeNGModule,
    AssistantFormComponent
  ],
  templateUrl: './assistants.component.html',
  styleUrls: ['./assistants.component.scss'],
  providers: [ConfirmationService, MessageService]
})
export class AssistantsComponent implements OnInit {
  assistants: OAAssistant[] = [];
  showDialog = false;
  selectedAssistant: OAAssistant | null = null;
  loading = false;

  constructor(
    private openAiService: OpenAiApiService,
    private functionImplementationsService: FunctionImplementationsService,
    private configService: ConfigService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    // Subscribe to project changes
    this.configService.activeProject$.subscribe(project => {
      if (project) {
        console.log('Active project changed, reloading assistants...');
        this.loadAssistants();
      }
    });
  }

  ngOnInit() {
    this.loadAssistants();
  }

  async loadAssistants() {
    this.loading = true;
    try {
      const response = await this.openAiService.listAssistants();
      this.assistants = response.data;
    } catch (error) {
      console.error('Error loading assistants:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load assistants'
      });
    } finally {
      this.loading = false;
    }
  }

  async refreshAssistants() {
    await this.loadAssistants();
  }

  createAssistant() {
    this.selectedAssistant = null;
    this.showDialog = true;
  }

  editAssistant(assistant: OAAssistant) {
    this.selectedAssistant = assistant;
    this.showDialog = true;
  }

  confirmDelete(assistant: OAAssistant) {
    this.confirmationService.confirm({
      message: 'What would you like to do with this assistant?',
      header: 'Delete Options',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.confirmRemoveFromProfile(assistant),
      reject: () => this.confirmDeleteFromOpenAI(assistant),
      acceptLabel: 'Remove from Profile',
      rejectLabel: 'Delete from OpenAI',
      acceptButtonStyleClass: 'p-button-warning',
      rejectButtonStyleClass: 'p-button-danger',
      acceptIcon: 'pi pi-user-minus',
      rejectIcon: 'pi pi-trash',
      closeOnEscape: true,
      dismissableMask: true
    });
  }

  confirmRemoveFromProfile(assistant: OAAssistant) {
    setTimeout(() => this.confirmationService.confirm({
      message: `Are you sure you want to remove "${assistant.name}" from this profile? The assistant will remain in your OpenAI account.`,
      header: 'Confirm Remove from Profile',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.removeFromProfile(assistant),
      acceptLabel: 'Yes, Remove',
      rejectLabel: 'No, Cancel',
      acceptButtonStyleClass: 'p-button-warning'
    }), 300);
  }

  confirmDeleteFromOpenAI(assistant: OAAssistant) {
    setTimeout(() => this.confirmationService.confirm({
      message: `Are you completely sure you want to delete "${assistant.name}" from your OpenAI account?`,
      header: 'First Warning',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.confirmDeleteFromOpenAISecond(assistant),
      acceptLabel: 'Yes, Continue',
      rejectLabel: 'No, Cancel',
      acceptButtonStyleClass: 'p-button-danger'
    }), 300);
  }

  confirmDeleteFromOpenAISecond(assistant: OAAssistant) {
    setTimeout(() => this.confirmationService.confirm({
      message: `This will permanently delete "${assistant.name}" from your OpenAI account. Are you absolutely sure?`,
      header: 'Second Warning',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.confirmDeleteFromOpenAIFinal(assistant),
      acceptLabel: 'Yes, Continue',
      rejectLabel: 'No, Cancel',
      acceptButtonStyleClass: 'p-button-danger'
    }), 300);
  }

  confirmDeleteFromOpenAIFinal(assistant: OAAssistant) {
    setTimeout(() => this.confirmationService.confirm({
      message: `FINAL WARNING: This action cannot be undone. "${assistant.name}" will be permanently deleted from your OpenAI account. Do you want to proceed?`,
      header: 'Final Warning',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteAssistant(assistant),
      acceptLabel: 'Yes, Delete Permanently',
      rejectLabel: 'No, Cancel',
      acceptButtonStyleClass: 'p-button-danger p-button-raised'
    }), 300);
  }

  async removeFromProfile(assistant: OAAssistant) {
    try {
      const activeProfile = await this.configService.getActiveProfile();
      const activeProject = await this.configService.getActiveProject();
      
      if (!activeProfile || !activeProject) {
        throw new Error('No active profile or project');
      }

      // Remove the assistant file
      const baseDir = await window.electron.path.appConfigDir();
      const filePath = await window.electron.path.join(baseDir, `assistant-${activeProfile.id}-${assistant.id}.json`);
      await window.electron.fs.removeTextFile(filePath);

      await this.loadAssistants();
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Assistant removed from profile successfully'
      });
    } catch (error) {
      console.error('Error removing assistant from profile:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to remove assistant from profile'
      });
    }
  }

  async deleteAssistant(assistant: OAAssistant) {
    try {
      // First delete from OpenAI
      await this.openAiService.deleteAssistant(assistant.id);
      
      // Then remove from profile
      await this.removeFromProfile(assistant);
      
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Assistant deleted successfully from OpenAI and removed from profile'
      });
    } catch (error) {
      console.error('Error deleting assistant:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete assistant'
      });
    }
  }

  async cloneAssistant(assistant: OAAssistant) {
    try {
      this.loading = true;

      // First create a new assistant via OpenAI API
      const clonePayload = {
        name: `${assistant.name} (Copy)`,
        instructions: assistant.instructions,
        model: assistant.model,
        tools: assistant.tools,
        temperature: assistant.temperature
      };
      
      // Create new assistant to get the ID
      const newAssistant = await this.openAiService.createAssistant(clonePayload);

      // Get the profile ID
      const activeProfile = this.configService.getActiveProfile();
      const activeProject = this.configService.getActiveProject();
      if (!activeProfile || !activeProject) {
        throw new Error('No active profile or project');
      }

      // Get the original assistant's local data
      const originalLocalData = await this.functionImplementationsService.loadFunctionImplementations(
        activeProfile.id,
        activeProject.id,
        assistant.id
      );
      if (originalLocalData) {
        // Save the cloned implementation details with the new assistant ID
        await this.functionImplementationsService.saveFunctionImplementations(
          activeProfile.id,
          activeProject.id,
          newAssistant.id,
          clonePayload.name,
          originalLocalData.functions.functions.map(f => ({
            name: f.name,
            description: 'Cloned function',
            parameters: {
              type: 'object',
              properties: {},
              required: [],
              additionalProperties: false
            },
            implementation: {
              command: f.command,
              script: f.script,
              workingDir: f.workingDir,
              timeout: f.timeout,
              isOutput: f.isOutput
            }
          })),
          originalLocalData.inputs,
          originalLocalData.outputs,
          originalLocalData.instructionParts,
          originalLocalData.arraySchemas
        );
      }
      
      // Add the new assistant to the list
      this.assistants.unshift(newAssistant);
    } catch (error) {
      console.error('Error cloning assistant:', error);
    } finally {
      this.loading = false;
    }
  }

  async loadLocalAssistant(activeProfile: Profile, activeProject: Project, assistantId: string) {
    try {
      const originalLocalData = await this.functionImplementationsService.loadFunctionImplementations(
        activeProfile.id,
        activeProject.id,
        assistantId
      );
      
      if (originalLocalData?.functions?.functions) {
        const functions = originalLocalData.functions.functions;
        return {
          id: assistantId,
          // Use the assistantId as name since it's not stored in the config
          name: assistantId,
          functions: functions,
          inputSchemas: originalLocalData.inputs || [],
          outputSchemas: originalLocalData.outputs || [],
          instructionParts: originalLocalData.instructionParts,
          arraySchemas: originalLocalData.arraySchemas
        };
      }
    } catch (error) {
      console.error('Error loading local assistant:', error);
    }
  }

  async onSave(formData: any) {
    console.log('Received form data in assistants component:', formData);
    console.log('Tools array before transformation:', formData.tools);
    
    const transformedTools = formData.tools;
    
    console.log('Final transformed tools array:', transformedTools);
    
    this.loading = true;
    try {
      let savedAssistant: OAAssistant;
      
      if (formData.id) {
        const payload = {
          name: formData.name,
          instructions: formData.instructions,
          model: formData.model,
          tools: transformedTools,
          temperature: formData.temperature
        };
        console.log('Update assistant payload:', payload);
        
        savedAssistant = await this.openAiService.updateAssistant(formData.id, payload);
        // Update the assistant in the local array
        const index = this.assistants.findIndex(a => a.id === formData.id);
        if (index !== -1) {
          this.assistants[index] = savedAssistant;
        }
      } else {
        const payload = {
          name: formData.name,
          instructions: formData.instructions,
          model: formData.model,
          tools: transformedTools,
          temperature: formData.temperature
        };
        console.log('Create assistant payload:', payload);
        
        savedAssistant = await this.openAiService.createAssistant(payload);
        this.assistants.unshift(savedAssistant);
      }

      // Now that we have the assistant ID, save function implementations
      const activeProfile = await this.configService.getActiveProfile();
      const activeProject = await this.configService.getActiveProject();
      if (activeProfile && activeProject && !formData.id) {
        if(!formData.instructionParts.userInstructions.processingSteps){
          formData.instructionParts.userInstructions.processingSteps = ' ';
        }
        await this.functionImplementationsService.saveFunctionImplementations(
          activeProfile.id,
          activeProject.id,
          savedAssistant.id,
          formData.name,
          formData.functions,
          formData.inputSchemas,
          formData.outputSchemas,
          formData.instructionParts,
          formData.arraySchemas,
          formData.openai
        );
      }

      this.showDialog = false;
      this.selectedAssistant = null;
    } catch (error: any) {
      console.error('Error saving assistant:', error);
      // Handle specific error cases
      if (error.status === 400) {
        // Handle validation errors
        console.error('Validation error:', error.error);
      } else if (error.status === 401) {
        // Handle authentication errors
        console.error('Authentication error. Please check your API key.');
      } else {
        // Handle other errors
        console.error('An unexpected error occurred:', error);
      }
    } finally {
      this.loading = false;
    }
  }
}
