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
