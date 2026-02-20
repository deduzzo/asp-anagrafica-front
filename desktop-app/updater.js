const { autoUpdater } = require('electron-updater');

let mainWindow = null;

function initUpdater(win) {
    mainWindow = win;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
        console.log('Update disponibile:', info.version);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:available', {
                version: info.version,
                releaseDate: info.releaseDate
            });
        }
    });

    autoUpdater.on('download-progress', (progress) => {
        console.log(`Download: ${Math.round(progress.percent)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update scaricato:', info.version);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:downloaded', {
                version: info.version
            });
        }
    });

    autoUpdater.on('error', (err) => {
        console.error('Errore auto-updater:', err.message);
    });

    // Controlla subito
    autoUpdater.checkForUpdates().catch((err) => {
        console.log('Check update fallito (normale in dev):', err.message);
    });

    // Controlla ogni 30 minuti
    setInterval(() => {
        autoUpdater.checkForUpdates().catch(() => {});
    }, 30 * 60 * 1000);
}

function installUpdate() {
    autoUpdater.quitAndInstall(false, true);
}

module.exports = { initUpdater, installUpdate };
