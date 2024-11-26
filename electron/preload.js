const { contextBridge, ipcRenderer } = require('electron');

console.log('=== PRELOAD SCRIPT STARTING ===');

contextBridge.exposeInMainWorld('electron', {
  app: {
    getVersion() {
      return ipcRenderer.invoke('app:getVersion');
    }
  },
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
    async removeTextFile(path) {
      return ipcRenderer.invoke('fs:removeTextFile', path);
    },
    async createDir(path, options) {
      return ipcRenderer.invoke('fs:createDir', path, options);
    }
  },
  path: {
    async join(...paths) {
      return ipcRenderer.invoke('path:join', ...paths);
    },
    async appConfigDir() {
      return ipcRenderer.invoke('path:appConfigDir');
    },
    relative: (from, to) => ipcRenderer.invoke('path:relative', from, to)
  },
  functions: {
    async ensureDir(baseDir) {
      return ipcRenderer.invoke('functions:ensureDir', baseDir);
    },
    async save(baseDir, assistantId, implementations) {
      return ipcRenderer.invoke('functions:save', baseDir, assistantId, implementations);
    },
    async load(baseDir, assistantId) {
      return ipcRenderer.invoke('functions:load', baseDir, assistantId);
    }
  },
  assistant: {
    async save(baseDir, profileId, assistantId, config) {
      return ipcRenderer.invoke('assistant:save', baseDir, profileId, assistantId, config);
    },
    async load(baseDir, profileId, assistantId) {
      return ipcRenderer.invoke('assistant:load', baseDir, profileId, assistantId);
    }
  },
  graph: {
    async save(baseDir, profileId, graphData) {
      return ipcRenderer.invoke('graph:save', baseDir, profileId, graphData);
    },
    async load(baseDir, profileId) {
      return ipcRenderer.invoke('graph:load', baseDir, profileId);
    }
  },
  download: {
    downloadFile: (url, filePath) => ipcRenderer.invoke('download:file', { url, filePath })
  },
  terminal: {
    executeCommand: async (options) => {
      // Create a map to store output callbacks
      if (!window._outputCallbacks) {
        window._outputCallbacks = new Map();
      }

      // If there's an onOutput callback, set up the listener
      if (options.onOutput) {
        const listener = (event, data) => {
          options.onOutput(data);
        };
        
        // Store the callback
        window._outputCallbacks.set(options, listener);
        
        // Add the listener
        ipcRenderer.on('terminal:output', listener);
      }

      try {
        const result = await ipcRenderer.invoke('terminal:executeCommand', options);
        
        // Clean up listener if it exists
        if (options.onOutput) {
          const listener = window._outputCallbacks.get(options);
          if (listener) {
            ipcRenderer.removeListener('terminal:output', listener);
            window._outputCallbacks.delete(options);
          }
        }
        
        return result;
      } catch (error) {
        // Clean up listener on error too
        if (options.onOutput) {
          const listener = window._outputCallbacks.get(options);
          if (listener) {
            ipcRenderer.removeListener('terminal:output', listener);
            window._outputCallbacks.delete(options);
          }
        }
        throw error;
      }
    }
  },
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options)
  },
  ipcRenderer: {
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener)
  }
});

console.log('=== PRELOAD SCRIPT FINISHED ===');
console.log('window.electron should now be available:', typeof window !== 'undefined' ? !!window.electron : 'window not defined yet');
