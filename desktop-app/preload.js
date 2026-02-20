const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

    // WebSocket commands
    sendWsCommand: (command, data) => ipcRenderer.invoke('ws:send-command', command, data),
    getWsClientCount: () => ipcRenderer.invoke('ws:get-client-count'),

    // WebSocket events
    onWsClientCount: (callback) => {
        ipcRenderer.on('ws:client-count', (_event, count) => callback(count));
    },
    onWsServerStatus: (callback) => {
        ipcRenderer.on('ws:server-status', (_event, status) => callback(status));
    },
    onWsIncomingCommand: (callback) => {
        ipcRenderer.on('ws:incoming-command', (_event, msg) => callback(msg));
    },

    // Auto-update events
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update:available', (_event, info) => callback(info));
    },
    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update:downloaded', (_event, info) => callback(info));
    },
    installUpdate: () => ipcRenderer.invoke('update:install'),

    // App info
    getAppVersion: () => ipcRenderer.invoke('app:get-version')
});
