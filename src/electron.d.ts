declare module 'electron-api' {
  interface ElectronFS {
    exists(path: string): Promise<boolean>;
    readTextFile(path: string): Promise<string>;
    writeTextFile(path: string, contents: string): Promise<void>;
    removeTextFile(path: string): Promise<void>;
    createDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  }

  interface ElectronPath {
    appConfigDir(): Promise<string>;
    join(...paths: string[]): Promise<string>;
  }

  interface ElectronFunctions {
    ensureDir(baseDir: string): Promise<string>;
    save(baseDir: string, assistantId: string, implementations: any): Promise<boolean>;
    load(baseDir: string, assistantId: string): Promise<any>;
  }

  interface ElectronAssistant {
    save(baseDir: string, profileId: string, assistantId: string, config: {
      functions: any;
      inputs: string[];
      outputs: string[];
    }): Promise<boolean>;
    load(baseDir: string, profileId: string, assistantId: string): Promise<{
      functions: any;
      inputs: string[];
      outputs: string[];
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
      onOutput?: (data: string) => void;
    }): Promise<string>;
  }

  interface ElectronGraph {
    save(baseDir: string, profileId: string, graphData: any): Promise<boolean>;
    load(baseDir: string, profileId: string): Promise<any>;
  }

  interface Electron {
    fs: ElectronFS;
    path: ElectronPath;
    functions: ElectronFunctions;
    assistant: ElectronAssistant;
    download: ElectronDownload;
    terminal: ElectronTerminal;
    graph: ElectronGraph;
  }

  global {
    interface Window {
      electron: Electron;
    }
  }
}
