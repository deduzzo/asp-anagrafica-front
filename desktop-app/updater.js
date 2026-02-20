const { autoUpdater } = require('electron-updater');

let mainWindow = null;

function send(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

function initUpdater(win) {
    mainWindow = win;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
        console.log('Update disponibile:', info.version);
        send('update:available', { version: info.version, releaseDate: info.releaseDate });
    });

    autoUpdater.on('download-progress', (progress) => {
        const pct = Math.round(progress.percent);
        console.log(`Download: ${pct}%`);
        send('update:download-progress', { percent: pct });
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update scaricato:', info.version);
        send('update:downloaded', { version: info.version });
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('Nessun aggiornamento disponibile. Versione corrente:', info.version);
    });

    autoUpdater.on('error', (err) => {
        console.error('Errore auto-updater:', err.message);
        send('update:error', { message: err.message });
    });

    console.log('Auto-updater: controllo aggiornamenti...');
    autoUpdater.checkForUpdates().catch((err) => {
        console.log('Check update fallito (normale in dev):', err.message);
    });

    setInterval(() => {
        autoUpdater.checkForUpdates().catch(() => {});
    }, 30 * 60 * 1000);
}

function downloadUpdate() {
    autoUpdater.downloadUpdate().catch((err) => {
        console.error('Errore download update:', err.message);
        send('update:error', { message: err.message });
    });
}

function installUpdate() {
    autoUpdater.quitAndInstall(false, true);
}

module.exports = { initUpdater, downloadUpdate, installUpdate };
