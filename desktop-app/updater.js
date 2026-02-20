const { dialog, app, BrowserWindow } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const REPO_OWNER = 'deduzzo';
const REPO_NAME = 'asp-anagrafica-front';
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

let mainWindow = null;
let progressWindow = null;

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
                }
            } catch (err) {
                console.error('Updater: errore:', err.message);
            }
        });
    }).on('error', () => {});
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
    if (!zipAsset) return;

    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Aggiornamento disponibile',
        message: `Nuova versione disponibile: v${version}`,
        detail: `Versione corrente: v${app.getVersion()}\n\nL'aggiornamento verrà scaricato e installato automaticamente.\nL'applicazione si riavvierà al termine.`,
        buttons: ['Aggiorna ora', 'Dopo'],
        defaultId: 0,
        cancelId: 1
    });

    if (response === 0) {
        performUpdate(version, zipAsset);
    }
}

function showProgressWindow(version) {
    const parentBounds = mainWindow.getBounds();
    const width = 380;
    const height = 160;

    progressWindow = new BrowserWindow({
        width,
        height,
        x: Math.round(parentBounds.x + (parentBounds.width - width) / 2),
        y: Math.round(parentBounds.y + (parentBounds.height - height) / 2),
        parent: mainWindow,
        modal: true,
        closable: false,
        minimizable: false,
        maximizable: false,
        resizable: false,
        movable: false,
        fullscreenable: false,
        frame: true,
        title: `Aggiornamento v${version}`,
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    progressWindow.setMenuBarVisibility(false);

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px 28px;background:#f5f5f5;color:#333;display:flex;flex-direction:column;justify-content:center;height:calc(100vh - 48px);user-select:none}
h3{margin:0 0 12px;font-size:14px;font-weight:600}
p{margin:0 0 14px;font-size:12px;color:#666}
.bar{width:100%;height:5px;background:#ddd;border-radius:3px;overflow:hidden}
.fill{height:100%;background:#1a56db;border-radius:3px;transition:width .3s;width:5%}
.indeterminate .fill{width:30%;animation:slide 1.5s infinite ease-in-out}
@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
</style></head><body>
<h3 id="t">Aggiornamento in corso...</h3>
<p id="s">Preparazione...</p>
<div class="bar" id="bar"><div class="fill" id="fill"></div></div>
</body></html>`;

    progressWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    progressWindow.once('ready-to-show', () => progressWindow.show());
}

function updateProgress(text, percent) {
    if (!progressWindow || progressWindow.isDestroyed()) return;
    progressWindow.webContents.executeJavaScript(`
        document.getElementById('s').textContent = ${JSON.stringify(text)};
        const fill = document.getElementById('fill');
        const bar = document.getElementById('bar');
        ${percent >= 0
            ? `fill.style.width='${percent}%'; bar.classList.remove('indeterminate');`
            : `bar.classList.add('indeterminate');`}
    `).catch(() => {});
}

async function performUpdate(version, asset) {
    // Mostra finestra modale di progresso
    showProgressWindow(version);

    const tmpDir = path.join(app.getPath('temp'), 'asp-anagrafica-update');
    const zipPath = path.join(tmpDir, asset.name);

    try {
        fs.mkdirSync(tmpDir, { recursive: true });

        // Download
        updateProgress('Download in corso...', 0);
        await downloadFile(asset.browser_download_url, zipPath, (pct) => {
            updateProgress(`Download in corso... ${pct}%`, pct);
        });

        // Estrazione
        updateProgress('Estrazione in corso...', -1);
        const extractDir = path.join(tmpDir, 'extracted');
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
        fs.mkdirSync(extractDir, { recursive: true });
        execSync(`ditto -xk "${zipPath}" "${extractDir}"`);

        const items = fs.readdirSync(extractDir);
        const appName = items.find(i => i.endsWith('.app'));
        if (!appName) throw new Error('App non trovata nello ZIP');
        const newAppPath = path.join(extractDir, appName);

        // Path app corrente
        const currentAppPath = process.execPath.replace(/\/Contents\/MacOS\/.*$/, '');
        console.log('Updater: corrente:', currentAppPath);

        // Script di sostituzione e riavvio
        updateProgress('Installazione in corso...', -1);

        const scriptPath = path.join(tmpDir, 'update.sh');
        const script = `#!/bin/bash
while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done
sleep 0.5
rm -rf "${currentAppPath}"
mv "${newAppPath}" "${currentAppPath}"
open "${currentAppPath}"
rm -rf "${tmpDir}"
`;
        fs.writeFileSync(scriptPath, script, { mode: 0o755 });

        updateProgress('Riavvio in corso...', -1);

        spawn('bash', [scriptPath], { detached: true, stdio: 'ignore' }).unref();

        setTimeout(() => app.quit(), 500);

    } catch (err) {
        console.error('Updater: errore:', err.message);
        if (progressWindow && !progressWindow.isDestroyed()) progressWindow.close();
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

function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        _dl(url, destPath, resolve, reject, onProgress, 5);
    });
}

function _dl(url, destPath, resolve, reject, onProgress, redirects) {
    if (redirects <= 0) { reject(new Error('Troppi redirect')); return; }
    const file = fs.createWriteStream(destPath);
    const proto = url.startsWith('https') ? https : require('http');

    proto.get(url, { headers: { 'User-Agent': 'ASP-Anagrafica-Updater' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            file.close();
            try { fs.unlinkSync(destPath); } catch (e) {}
            _dl(res.headers.location, destPath, resolve, reject, onProgress, redirects - 1);
            return;
        }
        if (res.statusCode !== 200) {
            file.close(); try { fs.unlinkSync(destPath); } catch (e) {}
            reject(new Error(`HTTP ${res.statusCode}`)); return;
        }

        const total = parseInt(res.headers['content-length'], 10) || 0;
        let downloaded = 0;

        res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (total > 0) {
                const pct = Math.round(downloaded / total * 100);
                onProgress(pct);
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(downloaded / total);
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
