const express = require('express');
const https = require('https');

const PORT = parseInt(process.env.PORT || '3000');
const BASE_PATH = process.env.BASE_PATH || '/apps/asp-anagrafica-front';
const REPO_OWNER = 'deduzzo';
const REPO_NAME = 'asp-anagrafica-front';

let cachedVersion = null;

function fetchLatestVersion() {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
    https.get(url, { headers: { 'User-Agent': 'ASP-Anagrafica-Web' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                if (res.statusCode === 200) {
                    const release = JSON.parse(data);
                    cachedVersion = release.tag_name.replace(/^v/, '');
                    console.log('Versione GitHub:', cachedVersion);
                }
            } catch (e) {}
        });
    }).on('error', () => {});
}

// Fetch all'avvio e ogni 10 minuti
fetchLatestVersion();
setInterval(fetchLatestVersion, 10 * 60 * 1000);

const app = express();

app.get('/version', (req, res) => res.json({ version: cachedVersion || '0.0.0' }));

app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Server attivo su http://0.0.0.0:${PORT}`);
    console.log(`BASE_PATH: ${BASE_PATH}`);
});
