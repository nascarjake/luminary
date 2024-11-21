import { Component, OnInit, EventEmitter, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { OAAssistant } from '../../../../lib/entities/OAAssistant';
import { OpenAiApiService } from '../../../services/open-ai-api.service';

@Component({
  selector: 'app-assistant-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    ButtonModule,
    CardModule,
    MultiSelectModule,
    InputNumberModule,
    DialogModule,
    TooltipModule
  ],
  templateUrl: './assistant-form.component.html',
  styleUrls: ['./assistant-form.component.scss']
})
export class AssistantFormComponent implements OnInit, OnChanges {
  @Input() visible = false;
  @Input() assistant: OAAssistant | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  assistantForm: FormGroup;
  loading = false;
  availableModels: { label: string; value: string; }[] = [];
  availableFunctions = [
    { label: 'Code Interpreter', value: 'code_interpreter' },
    { label: 'Retrieval', value: 'retrieval' },
    { label: 'Function Calling', value: 'function' }
  ];

  // Full screen instructions editor
  showFullScreenInstructions = false;
  fullScreenInstructions = '';

  constructor(
    private fb: FormBuilder,
    private openAiService: OpenAiApiService
  ) {
    this.assistantForm = this.fb.group({
      name: ['', Validators.required],
      instructions: [''],
      model: ['gpt-4', Validators.required],
      temperature: [1],
      tools: [[]]
    });
  }

  async ngOnInit() {
    this.resetForm();
    await this.loadModels();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['assistant'] && this.assistant) {
      console.log('Assistant changed:', this.assistant);
      this.assistantForm.patchValue({
        name: this.assistant.name || '',
        instructions: this.assistant.instructions || '',
        model: this.assistant.model || 'gpt-4',
        tools: Array.isArray(this.assistant.tools) ? this.assistant.tools : [],
        temperature: this.assistant.temperature || 1
      });
    }
  }

  private async loadModels() {
    try {
      const models = await this.openAiService.listModels();
      this.availableModels = models.map(model => ({
        label: model.id,
        value: model.id
      }));
      
      // Set default model if no models are available
      if (this.availableModels.length === 0) {
        this.availableModels = [
          { label: 'GPT-4', value: 'gpt-4' },
          { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
        ];
      }
    } catch (error) {
      console.error('Error loading models:', error);
      // Fallback to default models
      this.availableModels = [
        { label: 'GPT-4', value: 'gpt-4' },
        { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
      ];
    }
  }

  private resetForm() {
    this.assistantForm.reset({
      model: 'gpt-4',
      temperature: 1,
      tools: []
    });
  }

  onSubmit() {
    if (this.assistantForm.valid) {
      this.loading = true;
      const formData = this.assistantForm.value;
      console.log('Form submission - Raw form data:', formData);
      console.log('Selected tools in form:', formData.tools);
      this.save.emit({
        ...formData,
        id: this.assistant?.id
      });
    }
  }

  hideDialog() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
    this.resetForm();
  }

  showInstructionsDialog() {
    this.fullScreenInstructions = this.assistantForm.get('instructions')?.value || '';
    this.showFullScreenInstructions = true;
  }

  hideInstructionsDialog() {
    this.showFullScreenInstructions = false;
  }

  applyInstructions() {
    this.assistantForm.patchValue({
      instructions: this.fullScreenInstructions
    });
    this.hideInstructionsDialog();
  }
}
