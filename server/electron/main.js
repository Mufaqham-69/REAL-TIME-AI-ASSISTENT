
const { app, BrowserWindow, globalShortcut, ipcMain, session } = require('electron');
const path = require('path');

let win = null;
let isProtected = true;

function createWindow() {
    win = new BrowserWindow({
        width: 780,
        height: 560,
        minWidth: 480,
        minHeight: 340,
        frame: false,             // Frameless floating overlay
        transparent: true,        // Transparent glass aesthetic
        alwaysOnTop: true,        // Float above Zoom / Teams / Meet
        skipTaskbar: false,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    });

    // Make window float on top even in fullscreen presentations
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true });

    // Enable Anti-Screen Share Protection:
    // Windows SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) prevents
    // Zoom, MS Teams, Google Meet, Discord, and OBS from capturing this window!
    win.setContentProtection(isProtected);

    const clientPort = process.env.CLIENT_PORT || 5173;
    const loadApp = () => {
        win.loadURL(`http://localhost:${clientPort}`).catch((err) => {
            console.warn(`[Electron] Waiting for client on http://localhost:${clientPort}...`, err.message);
            setTimeout(loadApp, 1500);
        });
    };

    loadApp();
    win.setIgnoreMouseEvents(false);

    // IPC Handlers
    ipcMain.on('toggle-protection', (event, state) => {
        if (win && !win.isDestroyed()) {
            isProtected = typeof state === 'boolean' ? state : !isProtected;
            win.setContentProtection(isProtected);
            console.log(`[Electron] Screen Share Protection set to: ${isProtected}`);
            win.webContents.send('protection-status', isProtected);
        }
    });

    ipcMain.on('hide-window', () => {
        if (win && !win.isDestroyed()) win.hide();
    });

    ipcMain.on('minimize-window', () => {
        if (win && !win.isDestroyed()) win.minimize();
    });

    // Global Hotkeys:
    // Ctrl+Shift+H: Show / Hide overlay instantly
    globalShortcut.register('CommandOrControl+Shift+H', () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    });

    // Ctrl+Shift+G: Toggle Ghost Protection
    globalShortcut.register('CommandOrControl+Shift+G', () => {
        if (!win || win.isDestroyed()) return;
        isProtected = !isProtected;
        win.setContentProtection(isProtected);
        console.log(`[Electron] Ghost Mode hotkey toggled: ${isProtected}`);
        win.webContents.send('protection-status', isProtected);
    });
}

app.whenReady().then(() => {
    // Automatically grant microphone media permissions without browser prompt
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            console.log('[Electron] Microphone permission automatically granted');
            callback(true);
        } else {
            callback(false);
        }
    });

    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'media') return true;
        return false;
    });

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