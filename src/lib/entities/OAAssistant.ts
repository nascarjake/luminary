export interface OAAssistant {
  id: string;
  object: 'assistant';
  created_at: number;
  name: string;
  description?: string;
  model: string;
  instructions?: string;
  arraySchemas?: ArraySchemas;
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description?: string;
      strict?: boolean;
      additionalProperties?: boolean;
      parameters?: Record<string, any>;
    };
  }>;
  file_ids?: string[];
  metadata?: {
    instructionParts?: AssistantInstructions;
    [key: string]: any;
  };
  temperature?: number;
  top_p?: number;
  response_format?: {
    type: 'text' | 'json_object' | 'json_schema';
  };
}

export interface AssistantInstructions {
  coreInstructions: {
    inputSchemas: any[];
    outputSchemas: any[];
    defaultOutputFormat: string;
    arrayHandling: string;
  };
  userInstructions: {
    businessLogic: string;
    processingSteps: string;
    customFunctions: string;
  };
}

export interface ArraySchemas {
  inputs: string[];
  outputs: string[];
}
