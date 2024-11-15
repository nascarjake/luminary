export type OAFunctionCall = {
  name: string;
  arguments: string;
};

export type OARequiredAction = {
  type: 'submit_tool_outputs';
  submit_tool_outputs: {
    tool_calls: {
      id: string;
      type: 'function';
      function: OAFunctionCall;
    }[];
  };
};

export type AvailableFunction = (...args: any[]) => Promise<any>;

export interface AvailableFunctions {
  sendOutlines: AvailableFunction;
  sendScript: AvailableFunction;
  sendToPictory: AvailableFunction;
}
