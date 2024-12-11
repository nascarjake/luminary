import { ObjectSchema } from './object-system';
import { AssistantInstructions } from '../../lib/entities/OAAssistant';

export interface IGraphNodeIO {
  name: string;
  type: string;
  schemaId: string;
}

export interface IAssistantNode {
  id: string;
  assistantId?: string;  // Optional for function nodes
  functionId?: string;   // Optional for assistant nodes
  name: string;
  inputs: IGraphNodeIO[];
  outputs: IGraphNodeIO[];
  position: {
    x: number;
    y: number;
  };
  instructions?: AssistantInstructions;
  metadata?: {
    inputSchemas?: string[];
    outputSchemas?: string[];
    [key: string]: any;
  };
}

export interface IGraphState {
  nodes: IAssistantNode[];
  connections: {
    fromNode: string;
    fromOutput: string;
    toNode: string;
    toInput: string;
    schema?: {
      id: string;
      type: string;
    };
  }[];
}

export interface IGraphSaveData extends IGraphState {
  version: string;
  lastModified: string;
}
