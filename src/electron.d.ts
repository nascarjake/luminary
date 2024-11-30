declare module 'electron-api' {
  interface ElectronFS {
    exists(path: string): Promise<boolean>;
    readTextFile(path: string): Promise<string>;
    writeTextFile(path: string, contents: string): Promise<void>;
    removeTextFile(path: string): Promise<void>;
    createDir(path: string, options?: { recursive?: boolean }): Promise<void>;
    readdir(path: string): Promise<string[]>;
  }

  interface ElectronProfile {
    export(profileId: string): Promise<Uint8Array>;
    import(profileId: string, zipData: Uint8Array): Promise<boolean>;
  }

  interface ElectronPath {
    appConfigDir(): Promise<string>;
    join(...paths: string[]): Promise<string>;
    relative(from: string, to: string): Promise<string>;
  }

  interface ElectronFunctions {
    ensureDir(baseDir: string): Promise<string>;
    save(baseDir: string, assistantId: string, implementations: any): Promise<boolean>;
    load(baseDir: string, assistantId: string): Promise<any>;
  }

  interface ElectronAssistant {
    save(baseDir: string, profileId: string, projectId: string, assistantId: string, config: {
      functions: any;
      inputs: string[];
      outputs: string[];
      name: string;
      arraySchemas: any;
      instructionParts?: {
        coreInstructions: {
          inputSchemas: string[];
          outputSchemas: string[];
          defaultOutputFormat: string;
          arrayHandling: string;
        };
        userInstructions: {
          businessLogic: string;
          processingSteps: string;
          customFunctions: string;
        };
      };
    }): Promise<boolean>;
    load(baseDir: string, profileId: string, projectId: string, assistantId: string): Promise<{
      functions: any;
      inputs: string[];
      outputs: string[];
      name: string;
      arraySchemas: any;
      instructionParts?: {
        coreInstructions: {
          inputSchemas: string[];
          outputSchemas: string[];
          defaultOutputFormat: string;
          arrayHandling: string;
        };
        userInstructions: {
          businessLogic: string;
          processingSteps: string;
          customFunctions: string;
        };
      };
    } | null>;
  }

  interface ElectronDownload {
    downloadFile(url: string, filePath: string): Promise<boolean>;
  }

  interface ElectronTerminal {
    executeCommand(options: {
      command: string;
      args: string[];
      cwd: string;
      stdin?: string;
      env?: Record<string, string>;
    }): Promise<string>;
  }

  interface ElectronGraph {
    save(baseDir: string, profileId: string, projectId: string, graphData: any): Promise<boolean>;
    load(baseDir: string, profileId: string, projectId: string): Promise<any>;
  }

  interface ElectronDialog {
    showOpenDialog(options: {
      title?: string;
      defaultPath?: string;
      buttonLabel?: string;
      filters?: { name: string; extensions: string[] }[];
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
    }): Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;
  }

  interface IpcRenderer {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    removeListener(channel: string, listener: (event: any, ...args: any[]) => void): void;
  }

  interface Electron {
    fs: ElectronFS;
    path: ElectronPath;
    functions: ElectronFunctions;
    assistant: ElectronAssistant;
    download: ElectronDownload;
    terminal: ElectronTerminal;
    graph: ElectronGraph;
    dialog: ElectronDialog;
    ipcRenderer: IpcRenderer;
    profile: ElectronProfile;
    app: {
      getVersion(): Promise<string>;
    };
  }

  global {
    interface Window {
      electron: Electron;
    }
  }
}
