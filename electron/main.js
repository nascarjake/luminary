const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const url = require('url');

console.log('Starting Electron app');
console.log('Current directory:', __dirname);

// IPC Handlers
ipcMain.handle('fs:exists', async (_, path) => {
  console.log('Checking exists:', path);
  return fs.existsSync(path);
});

ipcMain.handle('fs:readTextFile', async (_, path) => {
  console.log('Reading file:', path);
  return fs.readFileSync(path, 'utf8');
});

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

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

app.whenReady().then(() => {
  // Register protocol handler for serving local files
  protocol.registerFileProtocol('file', (request, callback) => {
    const pathname = decodeURI(request.url.replace('file:///', ''));
    callback(pathname);
  });

  console.log('Electron app is ready');
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
