import { Component, OnInit, EventEmitter, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { OAAssistant } from '../../../../lib/entities/OAAssistant';
import { OpenAiApiService } from '../../../services/open-ai-api.service';
import { FunctionListComponent } from '../../../components/function-list/function-list.component';
import { FunctionDefinition } from '../../../components/function-editor/function-editor.component';
import { FunctionImplementationsService } from '../../../services/function-implementations.service';

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
    InputNumberModule,
    DialogModule,
    TooltipModule,
    FunctionListComponent
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
  showFullScreenInstructions = false;
  fullScreenInstructions = '';
  availableModels: { label: string; value: string; }[] = [];
  functions: FunctionDefinition[] = [];

  constructor(
    private fb: FormBuilder,
    private openAiApiService: OpenAiApiService,
    private functionImplementationsService: FunctionImplementationsService
  ) {
    this.assistantForm = this.fb.group({
      name: ['', Validators.required],
      instructions: [''],
      model: ['', Validators.required],
      temperature: [0.7],
    });
  }

  ngOnInit() {
    this.loadAvailableModels();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && changes['visible'].currentValue && !this.assistant) {
      // Reset form when opening for a new assistant
      this.assistantForm.reset({
        name: '',
        instructions: '',
        model: '',
        temperature: 0.7,
      });
      this.functions = [];
      return;
    }

    if (changes['assistant'] && this.assistant) {
      this.assistantForm.patchValue({
        name: this.assistant.name,
        instructions: this.assistant.instructions || '',
        model: this.assistant.model,
        temperature: this.assistant.temperature || 0.7,
      });

      // Convert OpenAI tools format to our FunctionDefinition format
      const functionDefs = (this.assistant.tools || [])
        .filter(tool => tool.type === 'function' && tool.function)
        .map(tool => ({
          name: tool.function.name,
          description: tool.function.description || '',
          parameters: {
            type: 'object',
            properties: tool.function.parameters?.properties || {},
            required: tool.function.parameters?.required || []
          }
        }));

      // Load any saved implementations and merge them with the function definitions
      this.loadFunctionImplementations(functionDefs);
    }
  }

  private async loadFunctionImplementations(functionDefs: FunctionDefinition[]) {
    if (!this.assistant) return;

    try {
      const implementations = await this.functionImplementationsService.loadFunctionImplementations(this.assistant.id);
      this.functions = await this.functionImplementationsService.mergeFunctionImplementations(functionDefs, implementations);
    } catch (error) {
      console.error('Failed to load function implementations:', error);
      this.functions = functionDefs;
    }
  }

  async loadAvailableModels() {
    try {
      const modelList = await this.openAiApiService.listModels();
      this.availableModels = modelList.map(model => ({
        label: model.id,
        value: model.id
      }));
    } catch (error) {
      console.error('Failed to load models:', error);
      // Fallback models
      this.availableModels = [
        { label: 'GPT-4', value: 'gpt-4' },
        { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
      ];
    }
  }

  onFunctionsChange(functions: FunctionDefinition[]) {
    this.functions = functions;
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

  hideDialog() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
  }

  async onSubmit() {
    if (this.assistantForm.invalid) return;

    this.loading = true;
    try {
      const formValue = this.assistantForm.value;

      // Convert our function definitions to OpenAI format
      const tools = this.functions.map(func => ({
        type: 'function',
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters
        }
      }));

      const assistant = await this.openAiApiService.createOrUpdateAssistant({
        id: this.assistant?.id,
        name: formValue.name,
        instructions: formValue.instructions,
        model: formValue.model,
        temperature: formValue.temperature,
        tools
      });

      // Save function implementations
      if (this.assistant?.id) {
        await this.functionImplementationsService.saveFunctionImplementations(
          this.assistant.id,
          this.functions
        );
      }

      this.save.emit(assistant);
      this.visible = false;
      this.visibleChange.emit(false);
    } catch (error) {
      console.error('Failed to save assistant:', error);
    } finally {
      this.loading = false;
    }
  }
}
