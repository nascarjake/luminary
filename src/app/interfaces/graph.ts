import { ObjectSchema } from './object-system';

export interface IGraphNodeIO {
  name: string;
  type: string;
  schemaId: string;
}

export interface IAssistantNode {
  id: string;
  assistantId: string;
  name: string;
  inputs: IGraphNodeIO[];
  outputs: IGraphNodeIO[];
  position: {
    x: number;
    y: number;
  };
}

export interface IGraphState {
  nodes: IAssistantNode[];
  connections: {
    fromNode: string;
    fromOutput: string;
    toNode: string;
    toInput: string;
  }[];
}

export interface IGraphSaveData extends IGraphState {
  version: string;
  lastModified: string;
}
