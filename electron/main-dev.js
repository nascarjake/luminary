const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const url = require('url');
const { spawn } = require('child_process');

console.log('Starting Electron app (DEV)');
console.log('Current directory:', __dirname);

// Register local-resource protocol
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-resource', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
]);

// IPC Handlers
ipcMain.handle('fs:exists', async (_, path) => {
  console.log('Checking exists:', path);
  return fs.existsSync(path);
});

ipcMain.handle('fs:readTextFile', async (_, path) => {
  console.log('Reading file:', path);
  return fs.readFileSync(path, 'utf8');
});

console.log('Registering fs:writeTextFile handler');
ipcMain.handle('fs:writeTextFile', async (_, path, contents) => {
  console.log('Writing file:', path);
  fs.writeFileSync(path, contents);
});

ipcMain.handle('fs:removeTextFile', async (_, path) => {
  console.log('Removing file:', path);
  fs.unlinkSync(path);
});

ipcMain.handle('fs:createDir', async (_, path, options) => {
  console.log('Creating directory:', path);
  fs.mkdirSync(path, { recursive: options?.recursive });
});

ipcMain.handle('path:appConfigDir', async () => {
  const dir = path.join(os.homedir(), '.gpt-assistant-ui');
  console.log('Getting config dir:', dir);
  return dir;
});

ipcMain.handle('path:join', async (_, ...paths) => {
  const result = path.join(...paths);
  console.log('Joining paths:', paths, 'Result:', result);
  return result;
});

ipcMain.handle('graph:save', async (_, baseDir, profileId, graphData) => {
  try {
    console.log('graph:save called with:', {
      baseDir,
      profileId,
      graphDataType: typeof graphData
    });

    const graphDir = path.join(baseDir, 'graphs');
    console.log('Creating graph directory at:', graphDir);
    
    if (!fs.existsSync(graphDir)) {
      fs.mkdirSync(graphDir, { recursive: true });
    }
    
    const graphPath = path.join(graphDir, `graph-${profileId}.json`);
    console.log('Saving graph to:', graphPath, graphData);
    
    fs.writeFileSync(graphPath, JSON.stringify(graphData, null, 2));
    console.log('Graph saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving graph:', error);
    throw error;
  }
});

ipcMain.handle('graph:load', async (_, baseDir, profileId) => {
  try {
    const graphPath = path.join(baseDir, 'graphs', `graph-${profileId}.json`);
    if (!fs.existsSync(graphPath)) {
      return null;
    }
    const data = await fs.promises.readFile(graphPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading graph:', error);
    throw error;
  }
});

// Function implementations directory handling
ipcMain.handle('functions:ensureDir', async (_, baseDir) => {
  console.log('Ensuring functions directory exists');
  const functionsDir = path.join(baseDir, 'functions');
  if (!fs.existsSync(functionsDir)) {
    fs.mkdirSync(functionsDir, { recursive: true });
  }
  return functionsDir;
});

ipcMain.handle('functions:save', async (_, baseDir, assistantId, implementations) => {
  console.log('Saving function implementations for assistant:', assistantId);
  const functionsDir = path.join(baseDir, 'functions');
  const filePath = path.join(functionsDir, `functions-${assistantId}.json`);
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(implementations, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving function implementations:', error);
    throw error;
  }
});

ipcMain.handle('functions:load', async (_, baseDir, assistantId) => {
  console.log('Loading function implementations for assistant:', assistantId);
  const functionsDir = path.join(baseDir, 'functions');
  const filePath = path.join(functionsDir, `functions-${assistantId}.json`);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log('No implementations file found for assistant:', assistantId);
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading function implementations:', error);
    throw error;
  }
});

// Assistant configuration handling
ipcMain.handle('assistant:save', async (_, baseDir, profileId, assistantId, config) => {
  console.log('Saving assistant configuration:', { profileId, assistantId });
  const filePath = path.join(baseDir, `assistant-${profileId}-${assistantId}.json`);
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving assistant configuration:', error);
    throw error;
  }
});

ipcMain.handle('assistant:load', async (_, baseDir, profileId, assistantId) => {
  console.log('Loading assistant configuration:', { profileId, assistantId });
  const filePath = path.join(baseDir, `assistant-${profileId}-${assistantId}.json`);
  
  try {
    if (!fs.existsSync(filePath)) {
      // Try to load from old location for backward compatibility
      const oldFunctionsDir = path.join(baseDir, 'functions');
      const oldFilePath = path.join(oldFunctionsDir, `functions-${assistantId}.json`);
      
      if (fs.existsSync(oldFilePath)) {
        console.log('Found old function file, migrating to new format...');
        const oldContent = fs.readFileSync(oldFilePath, 'utf8');
        const functions = JSON.parse(oldContent);
        // Migrate to new format
        const newConfig = {
          functions,
          inputs: [],
          outputs: []
        };
        // Save in new format
        fs.writeFileSync(filePath, JSON.stringify(newConfig, null, 2));
        return newConfig;
      }
      
      console.log('No configuration found for assistant:', { profileId, assistantId });
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading assistant configuration:', error);
    throw error;
  }
});

console.log('Registering download:file handler');
ipcMain.handle('download:file', async (_, fileUrl, filePath) => {
  console.log('Main Process: Downloading file:', fileUrl, 'to:', filePath);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    console.log('Main Process: Created write stream');
    
    https.get(fileUrl, (response) => {
      console.log('Main Process: Got response from server, status:', response.statusCode);
      response.pipe(file);
      
      file.on('finish', () => {
        console.log('Main Process: Download completed');
        file.close();
        resolve(true);
      });

      file.on('error', (err) => {
        console.error('Main Process: File write error:', err);
        fs.unlink(filePath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      console.error('Main Process: HTTPS request error:', err);
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
});
console.log('Registered download:file handler');

// Terminal execution
ipcMain.handle('terminal:executeCommand', async (event, options) => {
  return new Promise((resolve, reject) => {
    const { command, args, cwd, onOutput, stdin } = options;
    const child = spawn(command, args, { cwd });
    let output = '';

    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    child.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      if (onOutput) {
        event.sender.send('terminal:output', str);
      }
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      output += str;
      if (onOutput) {
        event.sender.send('terminal:output', str);
      }
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
});

function createWindow() {
  console.log('Creating window');
  
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload script path:', preloadPath);
  console.log('Preload script exists:', fs.existsSync(preloadPath));

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Luminary',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });

  // Open DevTools
  win.webContents.openDevTools();

  // Load the Angular app from the dev server
  win.loadURL('http://localhost:4200');

  // Log when window is ready
  win.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
  });

  // Handle window close
  win.on('close', async (e) => {
    e.preventDefault();
    // Check if we're on the graph page and if there are unsaved changes
    const hasUnsavedChanges = await win.webContents.executeJavaScript(`
      const graphEditor = document.querySelector('app-graph-editor');
      graphEditor ? graphEditor.hasUnsavedChanges() : false;
    `);
    
    if (hasUnsavedChanges) {
      const response = await win.webContents.executeJavaScript('window.confirm("You have unsaved changes. Are you sure you want to exit?")');
      if (response) {
        win.destroy();
      }
    } else {
      win.destroy();
    }
  });
}

app.whenReady().then(() => {
  console.log('Electron app is ready (DEV)');

  // Register local-resource protocol handler
  protocol.registerFileProtocol('local-resource', (request, callback) => {
    try {
      const filePath = request.url.replace('local-resource://', '');
      const decodedPath = decodeURIComponent(filePath);
      
      // Handle Windows paths that start with drive letter
      const finalPath = process.platform === 'win32' && decodedPath.match(/^[a-zA-Z]/)
        ? decodedPath.replace(/^([a-zA-Z])/, '$1:') // Add colon after drive letter
        : decodedPath;

      console.log('Local resource request:', {
        original: request.url,
        decoded: decodedPath,
        final: finalPath,
        exists: fs.existsSync(finalPath)
      });

      return callback(finalPath);
    } catch (error) {
      console.error('Error handling local-resource protocol:', error);
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
