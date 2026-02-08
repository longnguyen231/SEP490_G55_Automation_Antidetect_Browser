/**
 * Main Entry Point - Electron Main Process
 * SEP490 G55 - Automation Antidetect Browser
 * 
 * File này là điểm khởi đầu của ứng dụng Electron.
 * Nó khởi tạo BrowserWindow và thiết lập các IPC handlers.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');



// Import config
const { APP_CONFIG } = require('./config/app.config');

// Biến lưu trữ cửa sổ chính
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: APP_CONFIG.WINDOW.WIDTH,
        height: APP_CONFIG.WINDOW.HEIGHT,
        minWidth: APP_CONFIG.WINDOW.MIN_WIDTH,
        minHeight: APP_CONFIG.WINDOW.MIN_HEIGHT,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload/preload.js'),
        },
        title: APP_CONFIG.APP_NAME,
    });

    // Load URL dựa vào môi trường
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Thoát ứng dụng khi tất cả cửa sổ đóng (trừ macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Dọn dẹp khi thoát
app.on('before-quit', async () => {
    await BrowserService.stopAllProfiles();
});

module.exports = { mainWindow };
