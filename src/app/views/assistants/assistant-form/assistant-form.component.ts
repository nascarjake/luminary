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
  fullScreenDialogVisible = false;
  fullScreenDialogTitle = '';
  fullScreenContent = '';
  currentInstructionField: string | null = null;

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

  activeTabIndex = 0;

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
      metadata: [{}],
      instructions: [''],
      input_schemas: [[]],
      output_schemas: [[]]
    });
  }

  ngOnInit() {
    this.loadModels();
    this.loadSchemas();
    this.loadFunctions();

    // Subscribe to form value changes
    this.form.valueChanges.subscribe(value => {
      // Check if instructions are empty and system instructions exist
      if (this.areInstructionsEmpty() && value.instructions) {
        this.distributeSystemInstructions(value.instructions);
        this.generateInstructions();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && changes['visible'].currentValue) {
      if (!this.assistant) {
        // Reset form when opening for a new assistant
        this.form.reset({
          name: '',
          model: '',
          description: '',
          response_format_type: 'text',
          temperature: 0.7,
          top_p: 1,
          metadata: {},
          input_schemas: [],
          output_schemas: []
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
      } else {
        // Load assistant data into form
        this.form.patchValue({
          name: this.assistant.name,
          description: this.assistant.description || '',
          model: this.assistant.model,
          response_format_type: this.assistant.response_format?.type || 'text',
          temperature: this.assistant.temperature || 0.7,
          top_p: this.assistant.top_p || 1,
          metadata: this.assistant.metadata || {},
          instructions: this.assistant.instructions || ''
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
        this.loadFunctionImplementations(functionDefs).then(() => {
          // Update form with schema values after loading implementations
          this.form.patchValue({
            input_schemas: this.instructionParts.coreInstructions.inputSchemas,
            output_schemas: this.instructionParts.coreInstructions.outputSchemas
          });
        });
      }
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
    this.generateInstructions();
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
    const selectedSchemas = this.form.get('input_schemas')?.value || [];
    this.instructionParts.coreInstructions.inputSchemas = selectedSchemas;
    this.generateInstructions();
    await this.saveImplementations();
  }

  async onOutputSchemasChange() {
    const selectedSchemas = this.form.get('output_schemas')?.value || [];
    this.instructionParts.coreInstructions.outputSchemas = selectedSchemas;
    this.generateInstructions();
    await this.saveImplementations();
  }

  openInstructionDialog(type: string) {
    const titles: { [key: string]: string } = {
      businessLogic: 'Business Logic',
      processingSteps: 'Processing Steps',
      customFunctions: 'Custom Functions',
      defaultOutputFormat: 'Default Output Format',
      arrayHandling: 'Array Handling'
    };

    this.fullScreenDialogTitle = titles[type] || type;
    
    // Handle both core and user instructions
    if (type === 'defaultOutputFormat' || type === 'arrayHandling') {
      this.fullScreenContent = this.instructionParts.coreInstructions[type];
      this.currentInstructionField = type;
      this.fullScreenDialogVisible = true;
      return;
    }

    this.fullScreenContent = this.instructionParts.userInstructions[type];
    this.currentInstructionField = type;
    this.fullScreenDialogVisible = true;
  }

  openDefaultOutputFormatDialog() {
    this.openInstructionDialog('defaultOutputFormat');
  }

  openArrayHandlingDialog() {
    this.openInstructionDialog('arrayHandling');
  }

  closeInstructionDialog() {
    this.fullScreenDialogVisible = false;
    this.currentInstructionField = null;
  }

  applyInstructionDialog() {
    if (!this.currentInstructionField) return;

    if (this.currentInstructionField === 'defaultOutputFormat' || this.currentInstructionField === 'arrayHandling') {
      // For system instructions, we don't apply changes since they're read-only
      this.closeInstructionDialog();
      return;
    }

    // Only apply changes for user instructions
    this.instructionParts.userInstructions[this.currentInstructionField] = this.fullScreenContent;
    this.closeInstructionDialog();
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

  private areInstructionsEmpty(): boolean {
    const { coreInstructions, userInstructions } = this.instructionParts;
    return !coreInstructions.defaultOutputFormat.trim() &&
           !coreInstructions.arrayHandling.trim() &&
           !userInstructions.businessLogic.trim() &&
           !userInstructions.processingSteps.trim() &&
           !userInstructions.customFunctions.trim();
  }

  private distributeSystemInstructions(systemInstructions: string) {
    // For now, put all system instructions in processing steps
    this.instructionParts.userInstructions.processingSteps = systemInstructions;
    this.instructionParts.userInstructions.businessLogic = '';
    this.instructionParts.userInstructions.customFunctions = '';

    /* Original distribution logic kept for future use
    const paragraphs = systemInstructions.split('\n\n').filter(p => p.trim());
    
    // Keywords for each category
    const businessKeywords = ['business', 'rule', 'policy', 'requirement', 'constraint', 'validate', 'check'];
    const processingKeywords = ['process', 'step', 'procedure', 'workflow', 'handle', 'transform', 'format'];
    const functionKeywords = ['function', 'tool', 'command', 'operation', 'action', 'execute'];
    
    // Reset instruction parts
    this.instructionParts.userInstructions.businessLogic = '';
    this.instructionParts.userInstructions.processingSteps = '';
    this.instructionParts.userInstructions.customFunctions = '';
    
    // Distribute each paragraph to the most relevant section
    paragraphs.forEach(paragraph => {
      const businessScore = this.countKeywordMatches(paragraph.toLowerCase(), businessKeywords);
      const processingScore = this.countKeywordMatches(paragraph.toLowerCase(), processingKeywords);
      const functionScore = this.countKeywordMatches(paragraph.toLowerCase(), functionKeywords);
      
      // Find the highest scoring category
      const maxScore = Math.max(businessScore, processingScore, functionScore);
      
      // Add paragraph to the appropriate section
      if (maxScore === 0 || maxScore === processingScore) {
        this.instructionParts.userInstructions.processingSteps += 
          (this.instructionParts.userInstructions.processingSteps ? '\n\n' : '') + paragraph;
      } else if (maxScore === businessScore) {
        this.instructionParts.userInstructions.businessLogic += 
          (this.instructionParts.userInstructions.businessLogic ? '\n\n' : '') + paragraph;
      } else {
        this.instructionParts.userInstructions.customFunctions += 
          (this.instructionParts.userInstructions.customFunctions ? '\n\n' : '') + paragraph;
      }
    });
    */
  }

  private updateCustomFunctionInstructions() {
    const hasTerminalCommand = this.functions.some(f => f.implementation?.command);
    const hasCustomFunctions = !!this.instructionParts.userInstructions.customFunctions.trim();

    if (hasTerminalCommand && !hasCustomFunctions) {
      const functionNames = this.functions
        .filter(f => f.implementation?.command)
        .map(f => f.name)
        .join(', ');

      this.instructionParts.userInstructions.customFunctions = 
        `When you have completed processing the input, call the ${functionNames} function with your results. ` +
        `This function will handle passing your output to the next stage of processing.`;
    }
  }

  generateInstructions() {
    // Always generate array handling instructions if not present
    if (!this.instructionParts.coreInstructions.arrayHandling) {
      this.instructionParts.coreInstructions.arrayHandling = this.generateArrayHandling();
    }

    // Only generate default output format if needed
    this.instructionParts.coreInstructions.defaultOutputFormat = this.generateDefaultOutputFormat();

    // Update custom functions instructions if needed
    this.updateCustomFunctionInstructions();
  }

  private generateDefaultOutputFormat(): string {
    const hasOutputSchemas = this.instructionParts.coreInstructions.outputSchemas.length > 0;
    const hasFunctions = this.functions.length > 0;
    const hasTerminalCommand = this.functions.some(f => f.implementation?.command);

    // Don't generate instructions if:
    // 1. No outputs are selected, or
    // 2. A function exists that has a terminal command
    if (!hasOutputSchemas || hasTerminalCommand) {
      return '';
    }

    let instructions = [];

    if (hasFunctions) {
      instructions.push(
        "When you complete your task, call one of the provided functions to pass your output to the next stage.",
        "Your output will be validated against the output schema if one is provided."
      );
    } else {
      instructions.push(
        "When you complete your task, format your response as a JSON object with a 'result' field containing your output.",
        "Example: { \"result\": \"your output here\" }"
      );
    }

    if (hasOutputSchemas) {
      instructions.push(
        "Your output must conform to one of the provided output schemas.",
        "Ensure all required fields are present and properly formatted."
      );
    }

    return instructions.join("\n\n");
  }

  private generateArrayHandling(): string {
    const hasOutputSchemas = this.instructionParts.coreInstructions.outputSchemas.length > 0;
    
    let instructions = [
      "When processing arrays or lists of data:",
      "",
      "1. If you receive an array of inputs, process each item individually and return an array of results.",
      "2. Maintain the order of items in the output array to match the input array.",
      "3. If an item fails processing, include an error message in its place.",
      ""
    ];

    if (hasOutputSchemas) {
      instructions.push(
        "4. Each item in the output array must conform to the specified output schema.",
        "5. For array fields within the schema, maintain nested array structures as specified."
      );
    }

    return instructions.join("\n");
  }

  hideDialog() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
    
    // Don't reset the form here as it will be handled by ngOnChanges
    // when the dialog is reopened
  }
}
