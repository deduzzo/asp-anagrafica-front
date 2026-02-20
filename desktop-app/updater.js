const { dialog, app } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const REPO_OWNER = 'deduzzo';
const REPO_NAME = 'asp-anagrafica-front';
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

let mainWindow = null;

function send(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

function initUpdater(win) {
    mainWindow = win;
    console.log('Updater: controllo aggiornamenti...');
    checkForUpdates();
    setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
}

function checkForUpdates() {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

    https.get(url, { headers: { 'User-Agent': 'ASP-Anagrafica-Updater' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                if (res.statusCode !== 200) return;
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
                console.error('Updater: errore:', err.message);
            }
        });
    }).on('error', (err) => {
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

    const zipAsset = release.assets.find(a => a.name.endsWith('.zip') && !a.name.endsWith('.blockmap'));
    if (!zipAsset) { console.log('Updater: ZIP non trovato'); return; }

    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Aggiornamento disponibile',
        message: `Nuova versione disponibile: v${version}`,
        detail: `Versione corrente: v${app.getVersion()}\n\nL'aggiornamento verrà scaricato e installato automaticamente.`,
        buttons: ['Aggiorna ora', 'Dopo'],
        defaultId: 0,
        cancelId: 1
    });

    if (response === 0) {
        performUpdate(version, zipAsset);
    }
}

async function performUpdate(version, asset) {
    // Blocca l'interfaccia con overlay modale
    send('update:start', { version });

    const tmpDir = path.join(app.getPath('temp'), 'asp-anagrafica-update');
    const zipPath = path.join(tmpDir, asset.name);

    try {
        // Crea directory temp
        fs.mkdirSync(tmpDir, { recursive: true });

        // 1. Download
        send('update:progress', { phase: 'download', percent: 0, text: `Download v${version}...` });
        await downloadFile(asset.browser_download_url, zipPath);

        // 2. Estrazione
        send('update:progress', { phase: 'extract', percent: 100, text: 'Estrazione in corso...' });
        const extractDir = path.join(tmpDir, 'extracted');
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
        fs.mkdirSync(extractDir, { recursive: true });
        execSync(`ditto -xk "${zipPath}" "${extractDir}"`);

        // Trova il .app estratto
        const items = fs.readdirSync(extractDir);
        const appName = items.find(i => i.endsWith('.app'));
        if (!appName) throw new Error('App non trovata nello ZIP');
        const newAppPath = path.join(extractDir, appName);

        // 3. Determina il path dell'app corrente
        // process.execPath è tipo: /path/to/ASP Anagrafica.app/Contents/MacOS/ASP Anagrafica
        const currentAppPath = process.execPath.replace(/\/Contents\/MacOS\/.*$/, '');
        console.log('Updater: app corrente:', currentAppPath);
        console.log('Updater: nuova app:', newAppPath);

        // 4. Installa: crea script che aspetta la chiusura, sostituisce, riavvia
        send('update:progress', { phase: 'install', percent: 100, text: 'Installazione in corso...' });

        const scriptPath = path.join(tmpDir, 'update.sh');
        const script = `#!/bin/bash
# Aspetta che il processo ${process.pid} termini
while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done
sleep 0.5
# Sostituisci l'app
rm -rf "${currentAppPath}"
mv "${newAppPath}" "${currentAppPath}"
# Riavvia
open "${currentAppPath}"
# Pulizia
rm -rf "${tmpDir}"
`;
        fs.writeFileSync(scriptPath, script, { mode: 0o755 });

        // 5. Avvia lo script e chiudi l'app
        send('update:progress', { phase: 'restart', percent: 100, text: 'Riavvio in corso...' });

        const child = spawn('bash', [scriptPath], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        // Chiudi l'app dopo un breve delay per mostrare il messaggio
        setTimeout(() => {
            app.quit();
        }, 500);

    } catch (err) {
        console.error('Updater: errore aggiornamento:', err.message);
        send('update:error', { message: err.message });

        // Pulizia
        try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}

        dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Errore aggiornamento',
            message: 'Impossibile installare l\'aggiornamento',
            detail: err.message,
            buttons: ['OK']
        });
    }
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        _download(url, destPath, resolve, reject, 5);
    });
}

function _download(url, destPath, resolve, reject, redirects) {
    if (redirects <= 0) { reject(new Error('Troppi redirect')); return; }

    const file = fs.createWriteStream(destPath);
    const proto = url.startsWith('https') ? https : require('http');

    proto.get(url, { headers: { 'User-Agent': 'ASP-Anagrafica-Updater' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            file.close();
            try { fs.unlinkSync(destPath); } catch (e) {}
            _download(res.headers.location, destPath, resolve, reject, redirects - 1);
            return;
        }

        if (res.statusCode !== 200) {
            file.close();
            try { fs.unlinkSync(destPath); } catch (e) {}
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
        }

        const totalSize = parseInt(res.headers['content-length'], 10) || 0;
        let downloaded = 0;

        res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalSize > 0) {
                const pct = Math.round(downloaded / totalSize * 100);
                send('update:progress', { phase: 'download', percent: pct, text: `Download... ${pct}%` });
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.setProgressBar(downloaded / totalSize);
                }
            }
        });

        res.pipe(file);
        file.on('finish', () => file.close(() => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(-1);
            resolve();
        }));
        file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
    }).on('error', (err) => { file.close(); fs.unlink(destPath, () => {}); reject(err); });
}

module.exports = { initUpdater };
