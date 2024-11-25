export interface OAAssistant {
  id: string;
  object: 'assistant';
  created_at: number;
  name: string;
  description?: string;
  model: string;
  instructions?: string;
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description?: string;
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
  // System-managed parts
  coreInstructions: {
    inputSchemas: string[];
    outputSchemas: string[];
    defaultOutputFormat: string;
    arrayHandling: string;
  };
  
  // User-managed parts
  userInstructions: {
    businessLogic: string;
    processingSteps: string;
    customFunctions: string;
  };
}
