import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { OAAssistant } from '../../../lib/entities/OAAssistant';
import { AssistantFormComponent } from './assistant-form/assistant-form.component';

@Component({
  selector: 'app-assistants',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    TableModule,
    TooltipModule,
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
    try {
      if (formData.id) {
        await this.openAiService.updateAssistant(formData.id, formData);
      } else {
        await this.openAiService.createAssistant(formData);
      }
      this.showDialog = false;
      this.loadAssistants();
    } catch (error) {
      console.error('Error saving assistant:', error);
    }
  }
}
