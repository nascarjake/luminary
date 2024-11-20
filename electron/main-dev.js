const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const url = require('url');

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
  console.log('Creating window (DEV)');
  
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Open DevTools
  win.webContents.openDevTools();

  // Load from Angular dev server
  win.loadURL('http://localhost:4200');

  // Log when window is ready
  win.webContents.on('did-finish-load', () => {
    console.log('Window finished loading (DEV)');
  });
}

app.whenReady().then(() => {
  console.log('Electron app is ready (DEV)');

  // Register local-resource protocol handler
  protocol.registerFileProtocol('local-resource', (request, callback) => {
    const filePath = request.url.replace('local-resource://', '');
    try {
      return callback(decodeURIComponent(filePath));
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
