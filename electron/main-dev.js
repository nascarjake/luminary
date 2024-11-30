const { app, BrowserWindow, ipcMain, protocol, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const url = require('url');
const { spawn } = require('child_process');
const archiver = require('archiver');
const AdmZip = require('adm-zip');

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
  const dir = path.join(os.homedir(), '.luminary');
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

// Profile export/import handling
ipcMain.handle('profile:export', async (_, profileId) => {
  console.log('Exporting profile:', profileId);
  const configDir = await getConfigDir();
  
  // Create a temporary directory for the export
  const tempDir = path.join(configDir, 'temp-export');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  try {
    // Read config file to get profile data
    const configPath = path.join(configDir, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const profile = config.profiles.find(p => p.id === profileId);
    
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Create sanitized profile data
    const exportProfile = {
      ...profile,
      openai: { apiKey: '' },  // Remove API key
      threads: [],  // Remove threads
      overlays: []  // Remove overlays
    };

    // Write profile data
    fs.writeFileSync(
      path.join(tempDir, 'profile.json'),
      JSON.stringify({ version: '1.0.0', profile: exportProfile }, null, 2)
    );

    // Copy schemas file if exists
    const schemasPath = path.join(configDir, `schemas-${profileId}.json`);
    if (fs.existsSync(schemasPath)) {
      fs.copyFileSync(schemasPath, path.join(tempDir, 'schemas.json'));
    }

    // Copy graph file if exists
    const graphPath = path.join(configDir, 'graphs', `graph-${profileId}.json`);
    if (fs.existsSync(graphPath)) {
      fs.copyFileSync(graphPath, path.join(tempDir, 'graph.json'));
    }

    // Copy assistant files
    const assistantFiles = fs.readdirSync(configDir)
      .filter(f => f.startsWith(`assistant-${profileId}-`) && f.endsWith('.json'));
    
    const assistants = assistantFiles.map(file => {
      const content = fs.readFileSync(path.join(configDir, file), 'utf8');
      return {
        id: file.match(/assistant-.*-(asst_[^.]+)/)?.[1],
        config: JSON.parse(content)
      };
    });

    fs.writeFileSync(
      path.join(tempDir, 'assistants.json'),
      JSON.stringify(assistants, null, 2)
    );

    // Create zip file
    const zipPath = path.join(configDir, `profile-${profileId}-export.zip`);
    await createZipArchive(tempDir, zipPath);

    // Read zip file as buffer
    const zipBuffer = fs.readFileSync(zipPath);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true });
    fs.unlinkSync(zipPath);

    return zipBuffer;
  } catch (error) {
    console.error('Error exporting profile:', error);
    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    throw error;
  }
});

ipcMain.handle('profile:import', async (_, profileId, zipBuffer) => {
  console.log('Importing profile:', profileId);
  const configDir = await getConfigDir();
  
  // Create a temporary directory for the import
  const tempDir = path.join(configDir, 'temp-import');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  try {
    // Write zip buffer to temporary file
    const zipPath = path.join(tempDir, 'import.zip');
    fs.writeFileSync(zipPath, Buffer.from(zipBuffer));

    // Extract zip file
    await extractZipArchive(zipPath, tempDir);

    // Read and validate profile data
    const profilePath = path.join(tempDir, 'profile.json');
    if (!fs.existsSync(profilePath)) {
      throw new Error('Invalid export file: missing profile.json');
    }

    const exportData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    
    // Import schemas if exists
    const schemasPath = path.join(tempDir, 'schemas.json');
    if (fs.existsSync(schemasPath)) {
      fs.copyFileSync(
        schemasPath,
        path.join(configDir, `schemas-${profileId}.json`)
      );
    }

    // Import graph if exists
    const graphPath = path.join(tempDir, 'graph.json');
    if (fs.existsSync(graphPath)) {
      const graphsDir = path.join(configDir, 'graphs');
      if (!fs.existsSync(graphsDir)) {
        fs.mkdirSync(graphsDir);
      }
      fs.copyFileSync(
        graphPath,
        path.join(graphsDir, `graph-${profileId}.json`)
      );
    }

    // Import assistants
    const assistantsPath = path.join(tempDir, 'assistants.json');
    if (fs.existsSync(assistantsPath)) {
      const assistants = JSON.parse(fs.readFileSync(assistantsPath, 'utf8'));
      
      for (const assistant of assistants) {
        if (!assistant.id || !assistant.config) continue;
        
        fs.writeFileSync(
          path.join(configDir, `assistant-${profileId}-${assistant.id}.json`),
          JSON.stringify(assistant.config, null, 2)
        );
      }
    }

    // Update config file
    const configPath = path.join(configDir, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const profile = config.profiles.find(p => p.id === profileId);
    
    if (profile) {
      // Merge imported profile data, preserving sensitive data
      Object.assign(profile, {
        ...exportData.profile,
        openai: profile.openai,  // Preserve API key
        threads: profile.threads,  // Preserve threads
        overlays: profile.overlays  // Preserve overlays
      });
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    // Cleanup
    fs.rmSync(tempDir, { recursive: true });
    return true;
  } catch (error) {
    console.error('Error importing profile:', error);
    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    throw error;
  }
});

// Helper functions for zip operations
async function createZipArchive(sourceDir, targetPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', err => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function extractZipArchive(zipPath, targetDir) {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, true);
}

// Helper function to get config directory
async function getConfigDir() {
  const dir = path.join(os.homedir(), '.luminary');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

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
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Open DevTools
  mainWindow.webContents.openDevTools();

  // Load the Angular app from the dev server
  mainWindow.loadURL('http://localhost:4200');

  // Log when window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
  });

  // Handle window close
  mainWindow.on('close', async (e) => {
    try {
      const hasUnsavedChanges = await mainWindow.webContents.executeJavaScript(`
        window.graphEditor ? window.graphEditor.hasUnsavedChanges() : false
      `);

      if (hasUnsavedChanges) {
        e.preventDefault();
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Save', "Don't Save", 'Cancel'],
          title: 'Unsaved Changes',
          message: 'Do you want to save your changes before closing?'
        });

        if (response === 0) {  // Save
          await mainWindow.webContents.executeJavaScript('document.querySelector("app-graph-editor").querySelector(".save-button").click()');
          mainWindow.destroy();
        } else if (response === 1) {  // Don't Save
          mainWindow.destroy();
        }
        // If response === 2 (Cancel), do nothing and keep the window open
      }
    } catch (error) {
      console.error('Error checking for unsaved changes:', error);
      // If there's an error, allow the window to close
      mainWindow.destroy();
    }
  });
}

// Window control handlers
ipcMain.handle('window:minimize', () => {
  BrowserWindow.getFocusedWindow()?.minimize();
});

ipcMain.handle('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  BrowserWindow.getFocusedWindow()?.close();
});

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
