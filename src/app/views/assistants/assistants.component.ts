import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNGModule } from '../../shared/primeng.module';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { OAAssistant } from '../../../lib/entities/OAAssistant';
import { AssistantFormComponent } from './assistant-form/assistant-form.component';
import { FunctionImplementationsService } from '../../services/function-implementations.service';
import { ConfigService } from '../../services/config.service';
import { ConfirmationService, MessageService } from 'primeng/api';

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
  ) {}

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
      message: `Are you sure you want to delete the assistant "${assistant.name}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteAssistant(assistant)
    });
  }

  async deleteAssistant(assistant: OAAssistant) {
    try {
      await this.openAiService.deleteAssistant(assistant.id);
      await this.loadAssistants();
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Assistant deleted successfully'
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
      if (!activeProfile) {
        throw new Error('No active profile');
      }

      // Get the original assistant's local data
      const originalLocalData = await this.functionImplementationsService.loadFunctionImplementations(activeProfile.id, assistant.id);
      if (originalLocalData) {
        // Save the cloned implementation details with the new assistant ID
        await this.functionImplementationsService.saveFunctionImplementations(
          activeProfile.id,
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
      if (activeProfile && !formData.id) {
        if(!formData.instructionParts.userInstructions.processingSteps){
          formData.instructionParts.userInstructions.processingSteps = ' ';
        }
        await this.functionImplementationsService.saveFunctionImplementations(
          activeProfile.id,
          savedAssistant.id,
          formData.name,
          formData.functions,
          formData.inputSchemas,
          formData.outputSchemas,
          formData.instructionParts,
          formData.arraySchemas
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
