const path = require('path');

module.exports = {
  entry: './electron/preload.js',
  target: 'electron-preload',
  output: {
    path: path.join(__dirname, '../dist/electron'),
    filename: 'preload.js'
  },
  node: {
    __dirname: false,
    __filename: false
  },
  externals: {
    electron: 'electron',
    fs: 'fs',
    path: 'path',
    os: 'os'
  }
};
