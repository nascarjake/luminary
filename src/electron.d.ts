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

  interface ElectronDownload {
    downloadFile(url: string, filePath: string): Promise<boolean>;
  }

  interface Electron {
    fs: ElectronFS;
    path: ElectronPath;
    download: ElectronDownload;
  }

  global {
    interface Window {
      electron: Electron;
    }
  }
}
