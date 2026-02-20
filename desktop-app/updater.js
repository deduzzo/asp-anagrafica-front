const { dialog, app } = require('electron');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

function initUpdater(win) {
    mainWindow = win;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', async (info) => {
        console.log('Update disponibile:', info.version);

        const { response } = await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Aggiornamento disponibile',
            message: `Nuova versione disponibile: v${info.version}`,
            detail: `Versione corrente: v${app.getVersion()}\nVuoi scaricare l'aggiornamento?`,
            buttons: ['Scarica', 'Dopo'],
            defaultId: 0,
            cancelId: 1
        });

        if (response === 0) {
            autoUpdater.downloadUpdate();
        }
    });

    autoUpdater.on('download-progress', (progress) => {
        const pct = Math.round(progress.percent);
        console.log(`Download: ${pct}%`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setProgressBar(pct / 100);
        }
    });

    autoUpdater.on('update-downloaded', async (info) => {
        console.log('Update scaricato:', info.version);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setProgressBar(-1); // rimuovi barra progresso
        }

        const { response } = await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Aggiornamento pronto',
            message: `Aggiornamento v${info.version} scaricato`,
            detail: 'L\'applicazione si riavvierà per completare l\'aggiornamento.',
            buttons: ['Installa e riavvia', 'Dopo'],
            defaultId: 0,
            cancelId: 1
        });

        if (response === 0) {
            autoUpdater.quitAndInstall(false, true);
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('Nessun aggiornamento disponibile. Versione corrente:', info.version);
    });

    autoUpdater.on('error', (err) => {
        console.error('Errore auto-updater:', err.message);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setProgressBar(-1);
        }
        dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Errore aggiornamento',
            message: 'Impossibile scaricare l\'aggiornamento',
            detail: err.message,
            buttons: ['OK']
        });
    });

    console.log('Auto-updater: controllo aggiornamenti...');
    autoUpdater.checkForUpdates().catch((err) => {
        console.log('Check update fallito (normale in dev):', err.message);
    });

    setInterval(() => {
        autoUpdater.checkForUpdates().catch(() => {});
    }, 30 * 60 * 1000);
}

module.exports = { initUpdater };
