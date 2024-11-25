import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNGModule } from '../../shared/primeng.module';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { OAAssistant } from '../../../lib/entities/OAAssistant';
import { AssistantFormComponent } from './assistant-form/assistant-form.component';

@Component({
  selector: 'app-assistants',
  standalone: true,
  imports: [
    CommonModule,
    PrimeNGModule,
    AssistantFormComponent
  ],
  templateUrl: './assistants.component.html',
  styleUrls: ['./assistants.component.scss']
})
export class AssistantsComponent implements OnInit {
  assistants: OAAssistant[] = [];
  showDialog = false;
  selectedAssistant: OAAssistant | null = null;
  loading = false;

  constructor(private openAiService: OpenAiApiService) {}

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
    } finally {
      this.loading = false;
    }
  }

  createAssistant() {
    this.selectedAssistant = null;
    this.showDialog = true;
  }

  editAssistant(assistant: OAAssistant) {
    this.selectedAssistant = assistant;
    this.showDialog = true;
  }

  async deleteAssistant(assistant: OAAssistant) {
    try {
      await this.openAiService.deleteAssistant(assistant.id);
      this.assistants = this.assistants.filter(a => a.id !== assistant.id);
    } catch (error) {
      console.error('Error deleting assistant:', error);
    }
  }

  async onSave(formData: any) {
    console.log('Received form data in assistants component:', formData);
    console.log('Tools array before transformation:', formData.tools);
    
    const transformedTools = formData.tools;
    
    console.log('Final transformed tools array:', transformedTools);
    
    this.loading = true;
    try {
      if (formData.id) {
        const payload = {
          name: formData.name,
          instructions: formData.instructions,
          model: formData.model,
          tools: transformedTools,
          temperature: formData.temperature
        };
        console.log('Update assistant payload:', payload);
        
        const updatedAssistant = await this.openAiService.updateAssistant(formData.id, payload);
        // Update the assistant in the local array
        const index = this.assistants.findIndex(a => a.id === formData.id);
        if (index !== -1) {
          this.assistants[index] = updatedAssistant;
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
        
        const newAssistant = await this.openAiService.createAssistant(payload);
        this.assistants.push(newAssistant);
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
