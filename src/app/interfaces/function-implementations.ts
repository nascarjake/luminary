export interface FunctionImplementation {
  name: string;  // Should match the OpenAI function name
  command: string;
  script: string;
  workingDir?: string;
  timeout?: number;
}

export interface AssistantFunctionImplementations {
  assistantId: string;
  functions: FunctionImplementation[];
}
