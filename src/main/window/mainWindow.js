const path = require('path');
const fs = require('fs');
const http = require('http');
const { BrowserWindow, screen } = require('electron');

let uiServerStarted = false;
function startUiServer(prodDir) {
  if (uiServerStarted) return;
  uiServerStarted = true;
  
  const server = http.createServer((req, res) => {
    let urlPath = new URL(req.url, 'http://localhost').pathname;
    if (urlPath === '/' || !urlPath) urlPath = '/index.html';
    
    // Fallback for React Router
    if (!path.extname(urlPath)) {
      urlPath = '/index.html';
    }
    
    const absolutePath = path.join(prodDir, urlPath);
    
    fs.readFile(absolutePath, (err, content) => {
      if (err) {
        // Fallback to index.html for unknown routes
        fs.readFile(path.join(prodDir, 'index.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(500);
            return res.end('Error loading UI');
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content2);
        });
        return;
      }
      
      const ext = path.extname(absolutePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff2': 'font/woff2'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
  
  server.listen(5174, '127.0.0.1').on('error', () => {
    console.log('UI server already running');
  });
}

function createWindow() {
  const isPackaged = require('electron').app.isPackaged;
  const devIcon = path.join(__dirname, '../../public/1.png');
  const prodIcon = path.join(process.resourcesPath || '', 'icon.png');
  const iconPath = isPackaged ? prodIcon : devIcon;

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const minW = Math.round(sw / 2);
  const minH = Math.round(sh / 2);

  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    minWidth: minW,
    minHeight: minH,
    webPreferences: {
      // __dirname is src/main/window; preload is at src/preload/index.js
      preload: path.join(__dirname, '../../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    icon: iconPath,
  });

  try { mainWindow.removeMenu(); } catch {}

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, serve the ASAR files via native HTTP so Firebase accepts the domain
    const prodDir = path.join(__dirname, '../../../dist/renderer');
    startUiServer(prodDir);
    mainWindow.loadURL('http://localhost:5174');
  }
  return mainWindow;
}

module.exports = { createWindow };
