const { dialog, app, shell } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');

const REPO_OWNER = 'deduzzo';
const REPO_NAME = 'asp-anagrafica-front';
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minuti

let mainWindow = null;

function initUpdater(win) {
    mainWindow = win;

    console.log('Updater: controllo aggiornamenti...');
    checkForUpdates();

    setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
}

function checkForUpdates() {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

    const req = https.get(url, { headers: { 'User-Agent': 'ASP-Anagrafica-Updater' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                if (res.statusCode !== 200) {
                    console.log('Updater: errore API GitHub, status', res.statusCode);
                    return;
                }
                const release = JSON.parse(data);
                const remoteVersion = release.tag_name.replace(/^v/, '');
                const currentVersion = app.getVersion();

                console.log(`Updater: corrente=${currentVersion}, remota=${remoteVersion}`);

                if (isNewer(remoteVersion, currentVersion)) {
                    promptUpdate(remoteVersion, release);
                } else {
                    console.log('Updater: nessun aggiornamento disponibile');
                }
            } catch (err) {
                console.error('Updater: errore parsing risposta:', err.message);
            }
        });
    });

    req.on('error', (err) => {
        console.log('Updater: errore connessione:', err.message);
    });
}

function isNewer(remote, current) {
    const r = remote.split('.').map(Number);
    const c = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((r[i] || 0) > (c[i] || 0)) return true;
        if ((r[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
}

async function promptUpdate(version, release) {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Trova il DMG tra gli asset
    const dmgAsset = release.assets.find(a => a.name.endsWith('.dmg'));
    if (!dmgAsset) {
        console.log('Updater: DMG non trovato nella release');
        return;
    }

    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Aggiornamento disponibile',
        message: `Nuova versione disponibile: v${version}`,
        detail: `Versione corrente: v${app.getVersion()}\n\nVuoi scaricare l'aggiornamento?`,
        buttons: ['Scarica aggiornamento', 'Dopo'],
        defaultId: 0,
        cancelId: 1
    });

    if (response === 0) {
        downloadAndInstall(version, dmgAsset);
    }
}

function downloadAndInstall(version, asset) {
    const downloadDir = app.getPath('downloads');
    const destPath = path.join(downloadDir, asset.name);

    // Mostra progresso nel dock
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(0.01);
    }

    console.log(`Updater: download ${asset.browser_download_url} -> ${destPath}`);

    // Segui redirect (GitHub usa redirect per i download)
    downloadFile(asset.browser_download_url, destPath, (err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setProgressBar(-1);
        }

        if (err) {
            console.error('Updater: errore download:', err.message);
            dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Errore download',
                message: 'Impossibile scaricare l\'aggiornamento',
                detail: err.message,
                buttons: ['OK']
            });
            return;
        }

        console.log('Updater: download completato:', destPath);

        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Aggiornamento scaricato',
            message: `Aggiornamento v${version} scaricato`,
            detail: `Il file DMG è stato scaricato nella cartella Download.\n\nApri il DMG e trascina la nuova versione nella cartella Applicazioni per completare l'aggiornamento.`,
            buttons: ['Apri DMG e chiudi app', 'Apri cartella Download'],
            defaultId: 0,
            cancelId: 1
        }).then(({ response }) => {
            if (response === 0) {
                // Apri il DMG e chiudi l'app
                shell.openPath(destPath).then(() => {
                    setTimeout(() => app.quit(), 1000);
                });
            } else {
                // Apri la cartella Download
                shell.showItemInFolder(destPath);
            }
        });
    });
}

function downloadFile(url, destPath, callback, redirects) {
    if (redirects === undefined) redirects = 5;
    if (redirects <= 0) {
        callback(new Error('Troppi redirect'));
        return;
    }

    const file = fs.createWriteStream(destPath);
    const proto = url.startsWith('https') ? https : require('http');

    proto.get(url, { headers: { 'User-Agent': 'ASP-Anagrafica-Updater' } }, (res) => {
        // Segui redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            file.close();
            fs.unlinkSync(destPath);
            downloadFile(res.headers.location, destPath, callback, redirects - 1);
            return;
        }

        if (res.statusCode !== 200) {
            file.close();
            fs.unlinkSync(destPath);
            callback(new Error(`HTTP ${res.statusCode}`));
            return;
        }

        const totalSize = parseInt(res.headers['content-length'], 10) || 0;
        let downloaded = 0;

        res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalSize > 0 && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setProgressBar(downloaded / totalSize);
            }
        });

        res.pipe(file);

        file.on('finish', () => {
            file.close(() => callback(null));
        });

        file.on('error', (err) => {
            fs.unlink(destPath, () => {});
            callback(err);
        });
    }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        callback(err);
    });
}

module.exports = { initUpdater };
