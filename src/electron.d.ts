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

  interface ElectronDownload {
    downloadFile(url: string, filePath: string): Promise<boolean>;
  }

  interface ElectronTerminal {
    executeCommand(options: {
      command: string;
      args: string[];
      cwd: string;
      onOutput?: (data: string) => void;
    }): Promise<string>;
  }

  interface Electron {
    fs: ElectronFS;
    path: ElectronPath;
    functions: ElectronFunctions;
    download: ElectronDownload;
    terminal: ElectronTerminal;
  }

  global {
    interface Window {
      electron: Electron;
    }
  }
}
