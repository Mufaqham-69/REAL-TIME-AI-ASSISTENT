
const { app, BrowserWindow, globalShortcut } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 400,
        frame: false,             // No window chrome
        transparent: true,        // See-through background
        alwaysOnTop: true,        // Float above other windows
        skipTaskbar: true,        // Hidden from taskbar
        webPreferences: {
            nodeIntegration: true
        }
    });

    win.loadURL('http://localhost:3000');
    win.setIgnoreMouseEvents(false);

    // Hotkey to toggle visibility
    globalShortcut.register('CommandOrControl+Shift+H', () => {
        if (win.isVisible()) win.hide();
        else win.show();
    });
}

app.whenReady().then(createWindow);