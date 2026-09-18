
const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');

let win = null;

function createWindow() {
    win = new BrowserWindow({
        width: 700,
        height: 520,
        minWidth: 480,
        minHeight: 300,
        frame: false,             // Frameless overlay
        transparent: true,        // Transparent background
        alwaysOnTop: true,        // Float above other windows
        skipTaskbar: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    const loadApp = () => {
        win.loadURL('http://localhost:3000').catch((err) => {
            console.warn('[Electron] Waiting for Vite dev server on http://localhost:3000...', err.message);
            setTimeout(loadApp, 1500);
        });
    };

    loadApp();
    win.setIgnoreMouseEvents(false);
    
    // Default screen protection
    win.setContentProtection(true);

    ipcMain.on('toggle-protection', (event, state) => {
        if (win && !win.isDestroyed()) {
            win.setContentProtection(state);
        }
    });

    // Hotkey to toggle overlay visibility
    globalShortcut.register('CommandOrControl+Shift+H', () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});