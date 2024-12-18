declare module 'electron-api' {
  interface ElectronFS {
    readTextFile: (path: string) => Promise<string>;
    writeTextFile: (path: string, content: string) => Promise<void>;
    removeTextFile: (path: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
    mkdir: (path: string, options?: { recursive: boolean }) => Promise<void>;
    createDir: (path: string, options?: { recursive: boolean }) => Promise<void>;
    readdir: (path: string) => Promise<string[]>;
    rmdir: (path: string) => Promise<void>;
    unlink: (path: string) => Promise<void>;
    stat: (path: string) => Promise<any>;
  }

  interface ElectronProfile {
    export(profileId: string): Promise<Uint8Array>;
    import(profileId: string, zipData: Uint8Array): Promise<boolean>;
  }

  interface ElectronPath {
    join: (...args: string[]) => Promise<string>;
    appConfigDir: () => Promise<string>;
    relative: (from: string, to: string) => Promise<string>;
    dirname: (path: string) => Promise<string>;
    basename: (path: string) => Promise<string>;
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
      openai: any;
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
      openai: any;
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
    list(baseDir: string, profileId: string, projectId: string): Promise<Array<{
      functions: any;
      inputs: string[];
      outputs: string[];
      name: string;
      arraySchemas: any;
      openai: any;
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
    }>>;
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

  interface ElectronWindow {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
  }

  interface ElectronShell {
    openExternal(url: string): Promise<void>;
  }

  interface ElectronIpcRenderer {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    once(channel: string, listener: (event: any, ...args: any[]) => void): void;
    send(channel: string, ...args: any[]): void;
    removeListener(channel: string, listener: (event: any, ...args: any[]) => void): void;
    removeAllListeners(channel: string): void;
  }

  interface Electron {
    path: ElectronPath;
    fs: ElectronFS;
    window: ElectronWindow;
    shell: ElectronShell;
    functions: ElectronFunctions;
    assistant: ElectronAssistant;
    download: ElectronDownload;
    terminal: ElectronTerminal;
    graph: ElectronGraph;
    dialog: ElectronDialog;
    ipcRenderer: ElectronIpcRenderer;
    profile: ElectronProfile;
    app: {
      getVersion(): Promise<string>;
    };
  }

  interface Window {
    electron: Electron;
  }

  export { Electron };
}
