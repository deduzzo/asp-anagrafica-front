const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const https = require('https');
const http = require('http');
const { createWsServer, broadcastCommand, getClientCount, shutdown: shutdownWs } = require('./wsServer');
const { initUpdater } = require('./updater');

const EXPRESS_PORT = 13080;
const UPSTREAM = 'https://ws1.asp.messina.it';

let mainWindow = null;
let expressServer = null;

// Determina la cartella public
function getPublicPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'public');
    }
    return path.join(__dirname, '..', 'public');
}

// Avvia Express con proxy API
function startExpress() {
    return new Promise((resolve) => {
        const expressApp = express();

        // Proxy /api/v1/* -> upstream
        expressApp.all('/api/v1/*', (req, res) => {
            const targetUrl = UPSTREAM + req.originalUrl;
            const urlObj = new URL(targetUrl);

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: req.method,
                headers: { ...req.headers, host: urlObj.hostname }
            };

            // Rimuovi headers problematici per il proxy
            delete options.headers['content-length'];

            const proxyReq = https.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                console.error('Proxy error:', err.message);
                res.status(502).json({ ok: false, err: { msg: 'Errore connessione al server ASP' } });
            });

            // Forward body per POST/PUT
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                req.pipe(proxyReq);
            } else {
                proxyReq.end();
            }
        });

        // Serve file statici
        expressApp.use(express.static(getPublicPath()));

        expressServer = expressApp.listen(EXPRESS_PORT, '127.0.0.1', () => {
            console.log(`Express attivo su http://127.0.0.1:${EXPRESS_PORT}`);
            resolve();
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: `ASP Anagrafica v${app.getVersion()}`,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadURL(`http://127.0.0.1:${EXPRESS_PORT}/`);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

// IPC Handlers
function registerIpcHandlers() {
    ipcMain.handle('ws:send-command', (_event, command, data) => {
        const result = broadcastCommand(command, data);
        return result;
    });

    ipcMain.handle('ws:get-client-count', () => {
        return getClientCount();
    });

    ipcMain.handle('app:get-version', () => {
        return app.getVersion();
    });
}

app.whenReady().then(async () => {
    registerIpcHandlers();
    await startExpress();
    const win = createWindow();
    createWsServer(win);
    initUpdater(win);
});

app.on('window-all-closed', async () => {
    await shutdownWs();
    if (expressServer) {
        expressServer.close();
    }
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        const win = createWindow();
        createWsServer(win);
    }
});
