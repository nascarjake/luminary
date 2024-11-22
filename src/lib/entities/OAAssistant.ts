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
    input_schemas?: string[];  // Array of schema IDs that this assistant accepts as input
    output_schemas?: string[]; // Array of schema IDs that this assistant produces as output
    [key: string]: any;
  };
  temperature?: number;
  response_format?: { type: string };
}
