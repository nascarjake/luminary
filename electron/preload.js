const { contextBridge, ipcRenderer } = require('electron');

console.log('=== PRELOAD SCRIPT STARTING ===');

contextBridge.exposeInMainWorld('electron', {
  fs: {
    async exists(path) {
      return ipcRenderer.invoke('fs:exists', path);
    },
    async readTextFile(path) {
      return ipcRenderer.invoke('fs:readTextFile', path);
    },
    async writeTextFile(path, contents) {
      return ipcRenderer.invoke('fs:writeTextFile', path, contents);
    },
    async createDir(path, options) {
      return ipcRenderer.invoke('fs:createDir', path, options);
    }
  },
  path: {
    async appConfigDir() {
      return ipcRenderer.invoke('path:appConfigDir');
    },
    async join(...paths) {
      return ipcRenderer.invoke('path:join', ...paths);
    }
  },
  download: {
    async downloadFile(url, filePath) {
      console.log('Preload: Initiating download from', url, 'to', filePath);
      return ipcRenderer.invoke('download:file', url, filePath);
    }
  }
});

console.log('=== PRELOAD SCRIPT FINISHED ===');
console.log('window.electron should now be available:', typeof window !== 'undefined' ? !!window.electron : 'window not defined yet');
