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
ipcMain.handle('download:file', async (event, fileUrl, filePath) => {
  console.log('🔽 Download request received:', { fileUrl, filePath });
  try {
    if (!fileUrl || !filePath) {
      console.error('❌ Missing required parameters:', { fileUrl, filePath });
      throw new TypeError('The "url" and "path" arguments must be provided');
    }
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
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
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

    // Copy assistant files and their function scripts
    const assistantFiles = fs.readdirSync(configDir)
      .filter(f => f.startsWith(`assistant-${profileId}-`) && f.endsWith('.json'));
    
    const assistants = [];
    for (const file of assistantFiles) {
      const content = fs.readFileSync(path.join(configDir, file), 'utf8');
      const assistant = {
        id: file.match(/assistant-.*-(asst_[^.]+)/)?.[1],
        config: JSON.parse(content)
      };
      console.log('Exporting Assistant file:', file);
      console.log('Exporting Assistant:', assistant);
      if (assistant.id && assistant.config) {
        // Copy function scripts for this assistant
        await copyFunctionScripts(configDir, tempDir, assistant.config);
        // Update paths to be relative
        assistant.config = updateFunctionPaths(assistant.config, '');
        assistants.push(assistant);
      }
    }

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

    // Import assistants and their function scripts
    const assistantsPath = path.join(tempDir, 'assistants.json');
    if (fs.existsSync(assistantsPath)) {
      const assistants = JSON.parse(fs.readFileSync(assistantsPath, 'utf8'));
      
      for (const assistant of assistants) {
        if (!assistant.id || !assistant.config) continue;
        
        // Copy function scripts for this assistant
        await copyFunctionScripts(tempDir, configDir, assistant.config);
        // Update paths to point to new location
        assistant.config = updateFunctionPaths(assistant.config, configDir);
        
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

// Helper functions for function script handling
async function copyFunctionScripts(sourceDir, targetDir, assistantConfig) {
  if (!assistantConfig?.functions?.functions) {
    console.log('No functions found in assistant config');
    return;
  }

  for (const func of assistantConfig.functions.functions) {
    if (func.script) {
      console.log('Copying function script for function:', func.script);
      const scriptPath = path.resolve(sourceDir, func.script);
      const scriptDir = path.dirname(scriptPath);
      const scriptDirName = path.basename(scriptDir);
      
      // Create the target directory
      const targetScriptDir = path.join(targetDir, scriptDirName);
      if (!fs.existsSync(targetScriptDir)) {
        fs.mkdirSync(targetScriptDir, { recursive: true });
      }

      // Copy the entire script directory
      fs.cpSync(scriptDir, targetScriptDir, { recursive: true });
    } else {
      console.log('No script file found for function:', func);
    }
  }
}

function updateFunctionPaths(assistantConfig, newBasePath) {
  if (!assistantConfig?.functions?.functions) return assistantConfig;

  const updatedConfig = { ...assistantConfig };
  updatedConfig.functions.functions = assistantConfig.functions.functions.map(func => {
    if (func.script) {
      console.log('Updating script path for function:', func.script);
      const scriptName = path.basename(func.script);
      const scriptDir = path.dirname(func.script);
      const scriptDirName = path.basename(scriptDir);
      func.script = path.join(newBasePath, scriptDirName, scriptName);
      console.log('New script path:', func.script);
    }
    return func;
  });

  return updatedConfig;
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
    let finalOutputStarted = false;
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
    const flag = '$%*%$Output:';

    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    child.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      if(!str.includes(flag) && !finalOutputStarted) {
        event.sender.send('terminal:output', str);
      }else {
        finalOutputStarted = true;
      }
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      output += str;
      if(!str.includes(flag) && !finalOutputStarted) {
        event.sender.send('terminal:output', str);
      }else {
        finalOutputStarted = true;
      }
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          // Try to parse the last line of output as JSON
          const lastLine = output.substring(output.lastIndexOf(flag) + flag.length).trim();
          if(typeof lastLine == 'object') resolve(lastLine);

          try {
            const jsonResult = JSON.parse(lastLine);
            console.log('JSON result:', jsonResult);
            resolve(jsonResult);
          } catch {
            console.log('Non-JSON output:', lastLine);
            // If not JSON, return the last line as is
            resolve(lastLine || true);
          }
        } catch (error) {
          console.error('Error parsing terminal output:', error);
          // If we can't get the output, just resolve with true for success
          resolve(true);
        }
      } else {
        reject(new Error(`Process exited with code ${code}`));
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

  // Handle local resource requests
  protocol.registerFileProtocol('local-resource', (request, callback) => {
    const filePath = request.url.replace('local-resource://', '');
    callback({ path: filePath });
  });

  // Handle new windows for local resources
  app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('local-resource://')) {
        const filePath = url.replace('local-resource://', '');
        const fileName = filePath.split('/').pop() || 'Media Preview';
        
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            title: fileName,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true
            }
          }
        };
      }
      return { action: 'deny' };
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
