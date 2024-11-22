import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { OAAssistant } from '../../../lib/entities/OAAssistant';

@Component({
  selector: 'app-assistant-library',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="assistant-library">
      <h3>Assistant Library</h3>
      <div class="assistant-list">
        <div 
          *ngFor="let assistant of assistants" 
          class="assistant-item"
          draggable="true"
          (dragstart)="onDragStart($event, assistant)"
        >
          <i class="pi pi-user"></i>
          <span>{{ assistant.name }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .assistant-library {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    h3 {
      margin: 0;
      padding: 0;
      font-size: 1.2rem;
      color: var(--text-color);
    }

    .assistant-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .assistant-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem;
      background-color: var(--surface-section);
      border-radius: 6px;
      cursor: move;
      user-select: none;
      transition: background-color 0.2s;

      &:hover {
        background-color: var(--surface-hover);
      }

      i {
        color: var(--primary-color);
      }
    }
  `]
})
export class AssistantLibraryComponent implements OnInit {
  assistants: OAAssistant[] = [];

  constructor(private openAiService: OpenAiApiService) {}

  ngOnInit() {
    this.loadAssistants();
  }

  private async loadAssistants() {
    try {
      const response = await this.openAiService.listAssistants();
      this.assistants = response.data;
    } catch (error) {
      console.error('Failed to load assistants:', error);
    }
  }

  onDragStart(event: DragEvent, assistant: OAAssistant) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify({
        type: 'assistant',
        id: assistant.id,
        name: assistant.name
      }));
    }
  }
}
