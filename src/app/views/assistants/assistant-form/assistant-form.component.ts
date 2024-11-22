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
import { MultiSelectModule } from 'primeng/multiselect';
import { OAAssistant } from '../../../../lib/entities/OAAssistant';
import { OpenAiApiService } from '../../../services/open-ai-api.service';
import { FunctionListComponent } from '../../../components/function-list/function-list.component';
import { FunctionDefinition } from '../../../components/function-editor/function-editor.component';
import { FunctionImplementationsService } from '../../../services/function-implementations.service';
import { ObjectSchemaService } from '../../../services/object-schema.service';
import { ObjectSchema } from '../../../interfaces/object-system';

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
    MultiSelectModule,
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
  availableSchemas: ObjectSchema[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private openAiService: OpenAiApiService,
    private functionImplementationsService: FunctionImplementationsService,
    private objectSchemaService: ObjectSchemaService
  ) {
    this.assistantForm = this.formBuilder.group({
      name: ['', Validators.required],
      instructions: [''],
      model: ['', Validators.required],
      temperature: [0.7],
      functions: [[]],
      input_schemas: [[]],
      output_schemas: [[]]
    });
  }

  ngOnInit() {
    this.loadModels();
    this.loadFunctions();
    this.loadSchemas();
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
        input_schemas: this.assistant.metadata?.input_schemas || [],
        output_schemas: this.assistant.metadata?.output_schemas || []
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

  private async loadModels() {
    try {
      const modelList = await this.openAiService.listModels();
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

  private async loadSchemas() {
    try {
      this.availableSchemas = await this.objectSchemaService.listSchemas();
    } catch (error) {
      console.error('Failed to load schemas:', error);
    }
  }

  private async loadFunctions() {
    if (!this.assistant) return;
  }

  onSubmit() {
    if (this.assistantForm.valid) {
      const formValue = this.assistantForm.value;
      const assistantData: Partial<OAAssistant> = {
        name: formValue.name,
        instructions: formValue.instructions,
        model: formValue.model,
        temperature: formValue.temperature,
        tools: this.functions.map(func => ({
          type: 'function',
          function: {
            name: func.name,
            description: func.description,
            parameters: {
              type: func.parameters.type,
              properties: func.parameters.properties,
              required: func.parameters.required
            }
          }
        })),
        metadata: {
          input_schemas: formValue.input_schemas,
          output_schemas: formValue.output_schemas
        }
      };

      this.save.emit(assistantData);
    }
  }

  onFunctionsChange(functions: FunctionDefinition[]) {
    this.functions = functions;
  }

  showInstructionsDialog() {
    this.fullScreenInstructions = this.assistantForm.get('instructions')?.value || '';
    this.showFullScreenInstructions = true;
  }

  applyFullScreenInstructions() {
    this.assistantForm.patchValue({
      instructions: this.fullScreenInstructions
    });
    this.showFullScreenInstructions = false;
  }

  hideDialog() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
  }
}
