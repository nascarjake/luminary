interface ElectronFS {
  exists(path: string): Promise<boolean>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, contents: string): Promise<void>;
  createDir(path: string, options?: { recursive?: boolean }): Promise<void>;
}

interface ElectronPath {
  appConfigDir(): Promise<string>;
  join(...paths: string[]): Promise<string>;
}

interface Electron {
  fs: ElectronFS;
  path: ElectronPath;
}

declare interface Window {
  electron: Electron;
}
