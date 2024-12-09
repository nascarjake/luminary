export interface FunctionNode {
  id: string;  // Unique identifier for the function node
  name: string;
  description?: string;
  command: string;
  script: string;
  workingDir?: string;
  timeout?: number;
  environmentVariables?: Record<string, string>;
  inputs: string[];  // Array of schema IDs
  outputs: string[]; // Array of schema IDs
  metadata?: {
    icon?: string;
    color?: string;
    category?: string;
    tags?: string[];
  };
  parameters?: {
    type: string;
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
}

export interface FunctionNodesConfig {
  profileId: string;
  functions: FunctionNode[];
  version: string;
  lastModified: string;
}
