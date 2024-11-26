import { Component, OnInit, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../../shared/primeng.module';
import { OAAssistant, AssistantInstructions } from '../../../../lib/entities/OAAssistant';
import { ObjectSchemaService } from '../../../services/object-schema.service';
import { OpenAiApiService } from '../../../services/open-ai-api.service';
import { ObjectSchema, ObjectField } from '../../../interfaces/object-system';
import { FunctionDefinition } from '../../../components/function-editor/function-editor.component';
import { FunctionImplementationsService } from '../../../services/function-implementations.service';
import { ConfigService } from '../../../services/config.service';
import { FunctionListComponent } from '../../../components/function-list/function-list.component';
import { FunctionImplementation } from '../../../interfaces/function-implementations';

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

  private readonly DEFAULT_OUTPUT_TOOL = {
    type: 'function',
    function: {
      name: 'sendOutput',
      description: 'Send the output to the next stage',
      strict: false,
      parameters: {
        type: 'object',
        properties: {
          result: {
            type: 'string',
            description: 'The output result as a JSON string'
          }
        },
        additionalProperties: false,
        required: ['result']
      }
    }
  };

  private readonly DEFAULT_OUTPUT_DEFINITION: FunctionDefinition = {
    name: 'sendOutput',
    description: 'Send the output to the next stage',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          description: 'The output result as a JSON string'
        }
      },
      additionalProperties: false,
      required: ['result']
    },
    implementation: {
      command: '',
      script: '',
      workingDir: '',
      timeout: 30000,
      isOutput: true
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
      metadata: [{}],
      instructions: [''],
      input_schemas: [[]],
      output_schemas: [[]],
      defaultOutputFormat: ['']
    });
  }

  ngOnInit() {
    this.loadModels();
    this.loadSchemas();
    this.loadFunctions();

    // Subscribe to form value changes
    this.form.valueChanges.subscribe(value => {
      // Check if instructions are empty and system instructions exist
      this.generateInstructions();
      if (this.areInstructionsEmpty() && value.instructions) {
        this.distributeSystemInstructions(value.instructions);
        
      }
    });
  }

  async ngOnChanges(changes: SimpleChanges) {
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
          output_schemas: [],
          defaultOutputFormat: ''
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
        try {
          // Load assistant data into form
          this.form.patchValue({
            name: this.assistant.name,
            description: this.assistant.description || '',
            model: this.assistant.model,
            response_format_type: this.assistant.response_format?.type || 'text',
            temperature: this.assistant.temperature || 0.7,
            top_p: this.assistant.top_p || 1,
            defaultOutputFormat: ''
          });

          // Load instruction parts and functions from local storage
          const activeProfile = await this.configService.getActiveProfile();
          if (activeProfile && this.assistant.id) {
            const config = await this.functionImplementationsService.loadFunctionImplementations(
              activeProfile.id,
              this.assistant.id
            );
            
            if (config.instructionParts) {
              this.instructionParts = config.instructionParts;
              this.form.patchValue({
                input_schemas: this.instructionParts.coreInstructions.inputSchemas,
                output_schemas: this.instructionParts.coreInstructions.outputSchemas,
                defaultOutputFormat: this.instructionParts.coreInstructions.defaultOutputFormat
              });
            }

            // If no instruction parts are set but we have OpenAI instructions, distribute them
            const hasNoInstructions = !this.instructionParts.userInstructions.businessLogic &&
              !this.instructionParts.userInstructions.processingSteps &&
              !this.instructionParts.userInstructions.customFunctions;

            if (hasNoInstructions && this.assistant.instructions) {
              this.distributeSystemInstructions(this.assistant.instructions);
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
            await this.loadFunctionImplementations(functionDefs);
          }
        } catch (error) {
          console.error('Failed to load assistant data:', error);
        }
      }
    }
  }

  async loadFunctionImplementations(functionDefs: Array<{
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
      
      // Update instruction parts with schema IDs
      this.instructionParts.coreInstructions.inputSchemas = config.inputs || [];
      this.instructionParts.coreInstructions.outputSchemas = config.outputs || [];

      // Update form controls with schema IDs
      this.form.patchValue({
        input_schemas: config.inputs || [],
        output_schemas: config.outputs || []
      });
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

    try {
      const assistantTools = this.assistant.tools || [];

      // Filter out the default output function from display
      this.functions = assistantTools
        .filter(t => t.function.name !== this.DEFAULT_OUTPUT_TOOL.function.name)
        .map(t => ({
          name: t.function.name,
          description: t.function.description || '',
          parameters: {
            type: 'object',
            properties: t.function.parameters?.properties || {},
            required: t.function.parameters?.required || []
          }
        } as FunctionDefinition));

    } catch (error) {
      console.error('Failed to load functions:', error);
      this.functions = [];
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;

    this.loading = true;
    try {
      // Ensure default output function if needed
      this.ensureDefaultOutputFunction();

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
          strict: func.strict,
          description: func.description,
          parameters: func.parameters
        }
        }))
      };

      // Only send the combined instructions to OpenAI
      assistantData.instructions = this.combineInstructions();

      // Include the ID if we're editing an existing assistant
      if (this.assistant?.id) {
        assistantData.id = this.assistant.id;
      }

      // Save function implementations and instruction parts locally
      if (this.assistant?.id) {
        const activeProfile = await this.configService.getActiveProfile();
        if (activeProfile) {
          await this.functionImplementationsService.saveFunctionImplementations(
            activeProfile.id,
            this.assistant.id,
            this.assistant.name,
            this.functions,
            this.instructionParts.coreInstructions.inputSchemas,
            this.instructionParts.coreInstructions.outputSchemas,
            this.instructionParts
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
        this.assistant.name,
        this.functions,
        this.instructionParts.coreInstructions.inputSchemas,
        this.instructionParts.coreInstructions.outputSchemas,
        this.instructionParts
      );
    } catch (error) {
      console.error('Failed to save function implementations:', error);
    }
  }

  onInputSchemasChange() {
    // Get selected schema IDs from form
    const selectedSchemaIds = this.form.get('input_schemas')?.value || [];
    
    // Update instructionParts with the IDs
    this.instructionParts.coreInstructions.inputSchemas = selectedSchemaIds;
    
    // Regenerate instructions
    this.generateInstructions();
  }

  onOutputSchemasChange() {
    // Get selected schema IDs from form
    const selectedSchemaIds = this.form.get('output_schemas')?.value || [];
    
    // Update instructionParts with the IDs
    this.instructionParts.coreInstructions.outputSchemas = selectedSchemaIds;
    
    // Regenerate instructions
    this.generateInstructions();
  }

  private generateFieldSchema(field: ObjectField): any {
    const fieldSchema: any = {
      type: field.type
    };

    // Only add description if it's not empty
    if (field.description?.trim()) {
      fieldSchema.description = field.description;
    }

    if (field.validation) {
      // Only add non-null, non-empty validation rules
      Object.entries(field.validation).forEach(([key, value]) => {
        if (value !== undefined && 
            value !== null && 
            value !== '' && 
            key !== 'items' && 
            key !== 'properties' &&
            !(Array.isArray(value) && value.length === 0)) {
          fieldSchema[key] = value;
        }
      });
    }

    // Only add required if it's true
    if (field.required) {
      fieldSchema.required = true;
    }

    return fieldSchema;
  }

  private generateSchemaWithComments(schemaId: string): string {
    const schema = this.availableSchemas.find(s => s.id === schemaId);
    if (!schema) return '';

    const result: any = {
      type: 'object',
      properties: {}
    };

    // Only add fields that have at least type defined
    for (const field of schema.fields) {
      const fieldSchema = this.generateFieldSchema(field);
      if (Object.keys(fieldSchema).length > 1) { // Must have more than just type
        result.properties[field.name] = fieldSchema;
      }
    }

    // Only add required array if there are required fields
    const requiredFields = schema.fields
      .filter(f => f.required)
      .map(f => f.name);
    
    if (requiredFields.length > 0) {
      result.required = requiredFields;
    }

    return JSON.stringify(result, null, 2);
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

  getProcessingStepsIntro() {
    return 'Your task is divided into several steps to ensure complete and thorough outlining. Follow these steps before finalizing the output and ensure that accurate, verified information is collected.';
  }

  combineInstructions(): string {
    const parts = [];

    // Add user instructions
    if (this.instructionParts.userInstructions.businessLogic) {
      parts.push(`${this.instructionParts.userInstructions.businessLogic}`);
    }

    if (this.instructionParts.userInstructions.processingSteps) {
      parts.push(`${this.getProcessingStepsIntro()}\n\nProcessing Steps:\n${this.instructionParts.userInstructions.processingSteps}`);
    }

    if (this.instructionParts.userInstructions.customFunctions) {
      parts.push(`Custom Functions:\n${this.instructionParts.userInstructions.customFunctions}`);
    }

    // Add default output format if specified
    if (this.instructionParts.coreInstructions.defaultOutputFormat) {
      parts.push(`Default Output Format:\n${this.instructionParts.coreInstructions.defaultOutputFormat}`);
    }

    // Add array handling if specified
    if (this.instructionParts.coreInstructions.arrayHandling) {
      parts.push(`Array Handling:\n${this.instructionParts.coreInstructions.arrayHandling}`);
    }

    // Add core instructions
    if (this.instructionParts.coreInstructions.inputSchemas.length > 0) {
      const selectedSchemas = this.availableSchemas.filter(
        schema => this.instructionParts.coreInstructions.inputSchemas.includes(schema.id)
      );
      const schemasWithComments = selectedSchemas.map(schema => this.generateSchemaWithComments(schema.id));
      parts.push(`Input Schemas:\n${schemasWithComments.join('\n\n')}`);
    }

    if (this.instructionParts.coreInstructions.outputSchemas.length > 0) {
      const selectedSchemas = this.availableSchemas.filter(
        schema => this.instructionParts.coreInstructions.outputSchemas.includes(schema.id)
      );
      const schemasWithComments = selectedSchemas.map(schema => this.generateSchemaWithComments(schema.id));
      parts.push(`Output Schemas:\n${schemasWithComments.join('\n\n')}`);
    }


    return parts.join('\n\n');
  }

  private areInstructionsEmpty(): boolean {
    const { coreInstructions, userInstructions } = this.instructionParts;
    return !userInstructions.businessLogic.trim() &&
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
    // Always generate array handling instructions
   this.instructionParts.coreInstructions.arrayHandling = this.generateArrayHandling();

    // Only generate default output format if needed
    this.instructionParts.coreInstructions.defaultOutputFormat = this.generateDefaultOutputFormat();

    // Update custom functions instructions if needed
    this.updateCustomFunctionInstructions();
  }

  private generateDefaultOutputFormat(): string {
    const hasOutputSchemas = this.instructionParts.coreInstructions.outputSchemas.length > 0;
    const hasOutputFunctions = this.functions.some(f => f.name != this.DEFAULT_OUTPUT_DEFINITION.name && f.implementation?.isOutput);

    // Don't generate instructions if:
    // 1. No outputs are selected, or
    // 2. A function exists that has a terminal command
    if (hasOutputFunctions) {
      return '';
    }

    let instructions = [];


    instructions.push(
      "When you complete your task, send the output using the sendOutput() function.",
      "Please format your response as a JSON object with a 'result' field containing your output.",
      "If the output is JSON, you can include it directly in the 'result' field.",
      "Example: { \"result\": \"your output here\" }"
    );
    

    if (hasOutputSchemas) {
      instructions.push(
        "Your output must conform to one of the provided output schemas.",
        "Ensure all required fields are present and properly formatted."
      );
    }

    return instructions.join("\n");
  }

  private generateArrayHandling(): string {
    const hasOutputSchemas = this.instructionParts.coreInstructions.outputSchemas.length > 0;
    
    let instructions = [
      "When processing arrays or lists of data:",
      "(This does not always apply, only when instructed to output multiple items)",
      "1. Arrays must be formatted in pure json",
      "2. Arrays must be complete",
      "3. If you receive an array of inputs, process each item individually and return an array of results.",
      "4. Maintain the order of items in the output array to match the input array.",
      "5. If an item fails processing, include an error message in its place.",
    ];

    if (hasOutputSchemas) {
      instructions.push(
        "6. Each item in the output array must conform to the specified output schema.",
        "7. For array fields within the schema, maintain nested array structures as specified."
      );
    }

    return instructions.join("\n");
  }

  private hasOutputFunction(): boolean {
    if (!this.assistant?.tools) return false;
    return this.functions.some(f => f.implementation?.isOutput);
  }

  private ensureDefaultOutputFunction() {
    if (!this.hasOutputFunction()) {
      // Add default output tool to assistant
      if (!this.assistant) {
        this.assistant = {} as OAAssistant;
      }
      if (!this.assistant.tools) {
        this.assistant.tools = [];
      }

      // Check if default output function already exists
      const existingDefault = this.assistant.tools.find(t => t.function.name === this.DEFAULT_OUTPUT_TOOL.function.name);
      if (!existingDefault) {
        this.assistant.tools.push(this.DEFAULT_OUTPUT_TOOL);
        
        // Add to functions list but don't display
        this.functions.push(this.DEFAULT_OUTPUT_DEFINITION);
      }
    }
  }

  hideDialog() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
    
    // Don't reset the form here as it will be handled by ngOnChanges
    // when the dialog is reopened
  }

  get visibleFunctions(): FunctionDefinition[] {
    return this.functions.filter(f => f.name !== this.DEFAULT_OUTPUT_DEFINITION.name);
  }

  set visibleFunctions(value: FunctionDefinition[]) {
    this.functions = [...value, this.DEFAULT_OUTPUT_DEFINITION];
  }
}
