import { Component, OnInit, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../../shared/primeng.module';
import { OAAssistant, AssistantInstructions } from '../../../../lib/entities/OAAssistant';
import { ObjectSchemaService } from '../../../services/object-schema.service';
import { OpenAiApiService } from '../../../services/open-ai-api.service';
import { ObjectSchema } from '../../../interfaces/object-system';
import { FunctionDefinition } from '../../../components/function-editor/function-editor.component';
import { FunctionImplementationsService } from '../../../services/function-implementations.service';
import { ConfigService } from '../../../services/config.service';
import { FunctionListComponent } from '../../../components/function-list/function-list.component';

@Component({
  selector: 'app-assistant-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimeNGModule,
    FunctionListComponent
  ],
  templateUrl: './assistant-form.component.html',
  styleUrls: ['./assistant-form.component.scss']
})
export class AssistantFormComponent implements OnInit {
  @Input() assistant: OAAssistant | null = null;
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<OAAssistant>();
  @Output() cancel = new EventEmitter<void>();

  availableModels: { label: string; value: string; }[] = [];
  functions: FunctionDefinition[] = [];
  availableSchemas: ObjectSchema[] = [];
  responseFormatOptions = [
    { label: 'Text', value: 'text' },
    { label: 'JSON Object', value: 'json_object' },
    { label: 'JSON Schema', value: 'json_schema' }
  ];

  form: FormGroup;
  showFullScreenInstructions = false;
  fullScreenInstructions = '';
  loading = false;

  instructionParts: AssistantInstructions = {
    coreInstructions: {
      inputSchemas: [],
      outputSchemas: [],
      defaultOutputFormat: '',
      arrayHandling: ''
    },
    userInstructions: {
      businessLogic: '',
      processingSteps: '',
      customFunctions: ''
    }
  };

  constructor(
    private formBuilder: FormBuilder,
    private openAiService: OpenAiApiService,
    private functionImplementationsService: FunctionImplementationsService,
    private objectSchemaService: ObjectSchemaService,
    private configService: ConfigService
  ) {
    this.initForm();
  }

  private initForm() {
    this.form = this.formBuilder.group({
      name: ['', Validators.required],
      model: ['', Validators.required],
      description: [''],
      response_format_type: ['text'],
      temperature: [0.7],
      top_p: [1],
      metadata: [{}]
    });
  }

  ngOnInit() {
    this.loadModels();
    this.loadSchemas();
    this.loadFunctions();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && changes['visible'].currentValue && !this.assistant) {
      // Reset form when opening for a new assistant
      this.form.reset({
        name: '',
        model: '',
        description: '',
        response_format_type: 'text',
        temperature: 0.7,
        top_p: 1,
        metadata: {}
      });
      this.functions = [];
      this.instructionParts = {
        coreInstructions: {
          inputSchemas: [],
          outputSchemas: [],
          defaultOutputFormat: '',
          arrayHandling: ''
        },
        userInstructions: {
          businessLogic: '',
          processingSteps: '',
          customFunctions: ''
        }
      };
      return;
    }

    if (changes['assistant'] && this.assistant) {
      // Load assistant data into form
      this.form.patchValue({
        name: this.assistant.name,
        description: this.assistant.description || '',
        model: this.assistant.model,
        response_format_type: this.assistant.response_format?.type || 'text',
        temperature: this.assistant.temperature || 0.7,
        top_p: this.assistant.top_p || 1,
        metadata: this.assistant.metadata || {}
      });

      // Load instruction parts
      if (this.assistant.metadata?.instructionParts) {
        this.instructionParts = this.assistant.metadata.instructionParts;
      }

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

      // Load function implementations
      this.loadFunctionImplementations(functionDefs);
    }
  }

  private async loadFunctionImplementations(functionDefs: Array<{
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  }>) {
    if (!this.assistant) return;

    const activeProfile = await this.configService.getActiveProfile();
    if (!activeProfile) {
      console.error('No active profile found');
      this.functions = functionDefs;
      return;
    }

    try {
      const config = await this.functionImplementationsService.loadFunctionImplementations(
        activeProfile.id,
        this.assistant.id
      );
      
      // Update functions
      this.functions = await this.functionImplementationsService.mergeFunctionImplementations(
        functionDefs, 
        config.functions.functions
      );
      
      // Update instruction parts with inputs and outputs
      this.instructionParts.coreInstructions.inputSchemas = config.inputs || [];
      this.instructionParts.coreInstructions.outputSchemas = config.outputs || [];
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
      // Fallback models if API call fails
      this.availableModels = [
        { label: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview' },
        { label: 'GPT-4', value: 'gpt-4' },
        { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
      ];
    }
  }

  private async loadSchemas() {
    try {
      const schemas = await this.objectSchemaService.listSchemas();
      this.availableSchemas = schemas || [];
    } catch (error) {
      console.error('Failed to load schemas:', error);
      this.availableSchemas = [];
    }
  }

  private async loadFunctions() {
    if (!this.assistant) return;
  }

  async onSubmit() {
    if (this.form.invalid) return;

    this.loading = true;
    try {
      const formValue = this.form.value;
      const assistantData: Partial<OAAssistant> = {
        name: formValue.name,
        description: formValue.description,
        model: formValue.model,
        temperature: formValue.temperature,
        top_p: formValue.top_p,
        response_format: { type: formValue.response_format_type },
        tools: this.functions.map(func => ({
          type: 'function',
          function: {
            name: func.name,
            description: func.description,
            parameters: func.parameters
          }
        })),
        metadata: {
          ...formValue.metadata,
          instructionParts: this.instructionParts
        }
      };

      // Include the ID if we're editing an existing assistant
      if (this.assistant?.id) {
        assistantData.id = this.assistant.id;
      }

      // Save function implementations
      if (this.assistant?.id) {
        const activeProfile = await this.configService.getActiveProfile();
        if (activeProfile) {
          await this.functionImplementationsService.saveFunctionImplementations(
            activeProfile.id,
            this.assistant.id,
            this.functions,
            this.instructionParts.coreInstructions.inputSchemas,
            this.instructionParts.coreInstructions.outputSchemas
          );
        }
      }

      this.save.emit(assistantData as OAAssistant);
      this.visible = false;
      this.visibleChange.emit(false);
    } catch (error) {
      console.error('Failed to save assistant:', error);
    } finally {
      this.loading = false;
    }
  }

  async onFunctionsChange(functions: FunctionDefinition[]) {
    this.functions = functions;
    await this.saveImplementations();
  }

  private async saveImplementations() {
    if (!this.assistant) return;

    const activeProfile = await this.configService.getActiveProfile();
    if (!activeProfile) {
      console.error('No active profile found');
      return;
    }

    try {
      await this.functionImplementationsService.saveFunctionImplementations(
        activeProfile.id,
        this.assistant.id,
        this.functions,
        this.instructionParts.coreInstructions.inputSchemas,
        this.instructionParts.coreInstructions.outputSchemas
      );
    } catch (error) {
      console.error('Failed to save function implementations:', error);
    }
  }

  async onInputSchemasChange() {
    await this.saveImplementations();
  }

  async onOutputSchemasChange() {
    await this.saveImplementations();
  }

  showInstructionsDialog() {
    this.fullScreenInstructions = this.combineInstructions();
    this.showFullScreenInstructions = true;
  }

  hideDialog() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
    this.form.reset();
  }

  combineInstructions(): string {
    const parts = [];

    // Add core instructions
    if (this.instructionParts.coreInstructions.inputSchemas.length > 0) {
      parts.push(`Input Schemas: ${this.instructionParts.coreInstructions.inputSchemas.join(', ')}`);
    }
    if (this.instructionParts.coreInstructions.outputSchemas.length > 0) {
      parts.push(`Output Schemas: ${this.instructionParts.coreInstructions.outputSchemas.join(', ')}`);
    }
    if (this.instructionParts.coreInstructions.defaultOutputFormat) {
      parts.push(`Default Output Format: ${this.instructionParts.coreInstructions.defaultOutputFormat}`);
    }
    if (this.instructionParts.coreInstructions.arrayHandling) {
      parts.push(`Array Handling: ${this.instructionParts.coreInstructions.arrayHandling}`);
    }

    // Add user instructions
    if (this.instructionParts.userInstructions.businessLogic) {
      parts.push(`Business Logic:\n${this.instructionParts.userInstructions.businessLogic}`);
    }
    if (this.instructionParts.userInstructions.processingSteps) {
      parts.push(`Processing Steps:\n${this.instructionParts.userInstructions.processingSteps}`);
    }
    if (this.instructionParts.userInstructions.customFunctions) {
      parts.push(`Custom Functions:\n${this.instructionParts.userInstructions.customFunctions}`);
    }

    return parts.join('\n\n');
  }
}
