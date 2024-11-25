import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../../shared/primeng.module';
import { OAAssistant, AssistantInstructions } from '../../../../lib/entities/OAAssistant';
import { ObjectSchemaService } from '../../../services/object-schema.service';
import { OpenAiApiService } from '../../../services/open-ai-api.service';
import { ObjectSchema } from '../../../interfaces/object-system';
import { FunctionDefinition } from '../../../components/function-editor/function-editor.component';

@Component({
  selector: 'app-assistant-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimeNGModule
  ],
  templateUrl: './assistant-form.component.html',
  styleUrls: ['./assistant-form.component.scss']
})
export class AssistantFormComponent implements OnInit {
  @Input() assistant?: OAAssistant;
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

  instructionParts: {
    coreInstructions: {
      inputSchemas: string[];
      outputSchemas: string[];
      defaultOutputFormat: string;
      arrayHandling: string;
    };
    userInstructions: {
      businessLogic: string;
      processingSteps: string;
      customFunctions: string;
    };
  } = {
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
    private objectSchemaService: ObjectSchemaService
  ) {
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
    if (this.assistant) {
      this.form.patchValue(this.assistant);
      if (this.assistant.metadata?.instructionParts) {
        this.instructionParts = this.assistant.metadata.instructionParts;
      }
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

  onInputSchemasChange() {
    // Update form when input schemas change
    this.updateInstructions();
  }

  onOutputSchemasChange() {
    // Update form when output schemas change
    this.updateInstructions();
  }

  private updateInstructions() {
    // Combine all instruction parts into final instructions
    const instructions = this.combineInstructions();
    // You might want to update a form control or emit an event here
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

  async onSubmit() {
    if (this.form.valid) {
      this.loading = true;
      try {
        const formValue = this.form.value;
        const assistant: Partial<OAAssistant> = {
          ...formValue,
          instructions: this.combineInstructions(),
          metadata: {
            ...formValue.metadata,
            instructionParts: this.instructionParts
          }
        };
        this.save.emit(assistant as OAAssistant);
        this.hideDialog();
      } finally {
        this.loading = false;
      }
    }
  }

  hideDialog() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
    this.form.reset();
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

  showInstructionsDialog() {
    this.fullScreenInstructions = this.combineInstructions();
    this.showFullScreenInstructions = true;
  }

  applyFullScreenInstructions() {
    // Parse the full screen instructions back into parts
    // This is a placeholder - you might want to implement proper parsing
    this.showFullScreenInstructions = false;
  }
}
