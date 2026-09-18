const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    setProtection: (state) => ipcRenderer.send('toggle-protection', state),
    onProtectionChanged: (callback) => {
        const handler = (_, status) => callback(status);
        ipcRenderer.on('protection-status', handler);
        return () => ipcRenderer.removeListener('protection-status', handler);
    },
    hideWindow: () => ipcRenderer.send('hide-window'),
    minimizeWindow: () => ipcRenderer.send('minimize-window')
});
