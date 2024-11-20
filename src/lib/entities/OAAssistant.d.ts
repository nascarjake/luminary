export type OAAssistant = {
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
  metadata?: Record<string, any>;
  temperature?: number;
  response_format?: { type: string };
};
