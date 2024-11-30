const { app, BrowserWindow, ipcMain, protocol, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const url = require('url');
const { spawn } = require('child_process');

// Load package.json for version
const packageJson = require('../package.json');
app.setVersion(packageJson.version);

console.log('Starting Electron app (DEV)');
console.log('Current directory:', __dirname);

// Register local-resource protocol
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-resource', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
]);

// IPC Handlers
ipcMain.handle('app:getVersion', () => {
  const version = app.getVersion();
  console.log('Getting app version:', version);
  return version;
});

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

ipcMain.handle('fs:readdir', async (_, path) => {
  console.log('Reading directory:', path);
  return fs.readdirSync(path);
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

ipcMain.handle('path:relative', async (_, from, to) => {
  return path.relative(from, to);
});

ipcMain.handle('graph:save', async (_, baseDir, profileId, projectId, graphData) => {
  try {
    console.log('graph:save called with:', {
      baseDir,
      profileId,
      projectId,
      graphDataType: typeof graphData
    });
    const graphDir = path.join(baseDir, 'graphs');
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

ipcMain.handle('graph:load', async (_, baseDir, profileId, projectId) => {
  try {
    const graphDir = path.join(baseDir, 'graphs');
    const graphPath = path.join(graphDir, `graph-${profileId}-${projectId}.json`);
    if (!fs.existsSync(graphPath)) {
      // Try loading from old path format
      const oldGraphPath = path.join(graphDir, `graph-${profileId}.json`);
      if (fs.existsSync(oldGraphPath)) {
        console.log('Found graph in old location, will migrate on next save');
        const content = fs.readFileSync(oldGraphPath, 'utf8');
        return JSON.parse(content);
      }
      console.log('No graph found:', { profileId, projectId });
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
ipcMain.handle('assistant:save', async (_, baseDir, profileId, projectId, assistantId, config) => {
  console.log('Saving assistant configuration:', { profileId, projectId, assistantId });
  const filePath = path.join(baseDir, `assistant-${profileId}-${assistantId}.json`);
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving assistant configuration:', error);
    throw error;
  }
});

ipcMain.handle('assistant:load', async (_, baseDir, profileId, projectId, assistantId) => {
  
  const filePath = path.join(baseDir, `assistant-${profileId}-${projectId}-${assistantId}.json`);
  console.log('Loading assistant configuration:', { profileId, projectId, assistantId, filePath });
  try {
    if (!fs.existsSync(filePath)) {
      // Try loading from old path format
      const oldFilePath = path.join(baseDir, `assistant-${profileId}-${assistantId}.json`);
      if (fs.existsSync(oldFilePath)) {
        console.log('Found assistant in old location, will migrate on next save');
        const content = fs.readFileSync(oldFilePath, 'utf8');
        return JSON.parse(content);
      }
      
      // Try the functions directory as last resort
      const oldFunctionsDir = path.join(baseDir, 'functions');
      const oldFunctionsPath = path.join(oldFunctionsDir, `functions-${assistantId}.json`);
      
      if (fs.existsSync(oldFunctionsPath)) {
        console.log('Found old function file, migrating to new format...');
        const oldContent = fs.readFileSync(oldFunctionsPath, 'utf8');
        const functions = JSON.parse(oldContent);
        return {
          functions,
          inputs: [],
          outputs: []
        };
      }
      
      console.log('No configuration found for assistant:', { profileId, projectId, assistantId });
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

// Dialog handlers
ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return dialog.showOpenDialog(window, options);
});

// Terminal execution
ipcMain.handle('terminal:executeCommand', async (event, options) => {
  return new Promise((resolve, reject) => {
    const { command, args, cwd, stdin, env } = options;
    
    // Normalize paths in arguments
    const normalizedArgs = args.map(arg => {
      if (typeof arg === 'string' && (arg.includes('/') || arg.includes('\\'))) {
        return path.normalize(arg);
      }
      return arg;
    });

    // Create environment variables object by merging process.env with custom env
    const environment = { ...process.env };
    if (env) {
      Object.assign(environment, env);
    }
    
    console.log('Executing command:', command, 'with args:', normalizedArgs);
    console.log('Working directory:', cwd);
    if (env) {
      console.log('Environment variables:', env);
    }
    
    const child = spawn(command, normalizedArgs, {
      cwd,
      env: environment,
      shell: true
    });
    let output = '';

    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    child.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      event.sender.send('terminal:output', str);
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      output += str;
      event.sender.send('terminal:output', str);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}\n${output}`));
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
    try {
      const hasUnsavedChanges = await win.webContents.executeJavaScript(`
        window.graphEditor ? window.graphEditor.hasUnsavedChanges() : false
      `);

      if (hasUnsavedChanges) {
        e.preventDefault();
        const { response } = await dialog.showMessageBox(win, {
          type: 'question',
          buttons: ['Save', "Don't Save", 'Cancel'],
          title: 'Unsaved Changes',
          message: 'Do you want to save your changes before closing?'
        });

        if (response === 0) {  // Save
          await win.webContents.executeJavaScript('document.querySelector("app-graph-editor").querySelector(".save-button").click()');
          win.destroy();
        } else if (response === 1) {  // Don't Save
          win.destroy();
        }
        // If response === 2 (Cancel), do nothing and keep the window open
      }
    } catch (error) {
      console.error('Error checking for unsaved changes:', error);
      // If there's an error, allow the window to close
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
