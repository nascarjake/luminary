const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const url = require('url');

console.log('Starting Electron app');
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

function createWindow() {
  console.log('Creating window');
  
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload script path:', preloadPath);
  console.log('Preload script exists:', fs.existsSync(preloadPath));

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });

  // Open DevTools
  win.webContents.openDevTools();

  const appPath = path.join(__dirname, '../dist/browser');
  console.log('App directory:', appPath);
  console.log('App directory exists:', fs.existsSync(appPath));
  
  // Load the built Angular app
  win.loadFile(path.join(appPath, 'index.html'), {
    search: `?baseUrl=${encodeURIComponent(url.pathToFileURL(appPath).href)}`
  });

  // Log when window is ready
  win.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
  });
}

app.whenReady().then(() => {
  console.log('Electron app is ready');

  // Register protocol handler for serving local files
  protocol.registerFileProtocol('file', (request, callback) => {
    const pathname = decodeURI(request.url.replace('file:///', ''));
    callback(pathname);
  });

  // Register local-resource protocol handler for downloads
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

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});