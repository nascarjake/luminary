const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('Starting Electron app (DEV)');
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
