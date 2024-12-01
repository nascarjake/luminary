export interface FunctionImplementation {
  name: string;  // Should match the OpenAI function name
  command: string;
  script: string;
  workingDir?: string;
  timeout?: number;
  isOutput?: boolean;
  environmentVariables?: any;
}

export interface AssistantFunctionImplementations {
  assistantId: string;
  functions: FunctionImplementation[];
}

export interface OpenAIAssistantConfig {
  id?: string;
  name: string;
  description?: string;
  model: string;
  instructions?: string;
  tools?: any[];
  file_ids?: string[];
  metadata?: { [key: string]: string };
  temperature?: number;
  top_p?: number;
  response_format?: { type: string };
}

export interface AssistantConfig {
  functions: AssistantFunctionImplementations;
  inputs: string[];
  outputs: string[];
  arraySchemas?: any;
  instructionParts?: {
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
  };
  openai: OpenAIAssistantConfig;
}
