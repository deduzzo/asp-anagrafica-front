const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { WebSocketServer } = require('ws');

const WEB_PORT = parseInt(process.env.WEB_PORT || '3000');
const WS_PORT = parseInt(process.env.WS_PORT || '12345');

// Percorsi certificati SSL (personalizzabili via env)
const SSL_CERT = process.env.SSL_CERT || '/etc/letsencrypt/live/ws1.asp.messina.it/fullchain.pem';
const SSL_KEY = process.env.SSL_KEY || '/etc/letsencrypt/live/ws1.asp.messina.it/privkey.pem';

let sslOpts = null;
try {
    if (fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) {
        sslOpts = { cert: fs.readFileSync(SSL_CERT), key: fs.readFileSync(SSL_KEY) };
    }
} catch (err) {
    console.error('Errore caricamento SSL:', err.message);
}

/* ======================== Static file server ======================== */
const STATIC_DIR = path.join(__dirname, 'public');
const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function handleRequest(req, res) {
    let url = req.url.split('?')[0];
    if (url === '/' || url === '') url = '/index.html';

    const filePath = path.join(STATIC_DIR, url);

    // Sicurezza: impedisce path traversal
    if (!filePath.startsWith(STATIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

const webServer = sslOpts
    ? https.createServer(sslOpts, handleRequest)
    : http.createServer(handleRequest);

webServer.listen(WEB_PORT, () => {
    const proto = sslOpts ? 'https' : 'http';
    console.log(`Web server attivo: ${proto}://0.0.0.0:${WEB_PORT}`);
});

/* ======================== WebSocket server ======================== */
const wsServer = sslOpts
    ? https.createServer(sslOpts)
    : http.createServer();

const wss = new WebSocketServer({ server: wsServer });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`Client WS connesso. Totale: ${clients.size}`);

    ws.on('message', (data) => {
        const msg = data.toString();
        clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
                try { client.send(msg); } catch {}
            }
        });
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`Client WS disconnesso. Totale: ${clients.size}`);
    });

    ws.on('error', (err) => {
        console.error('WS error:', err.message);
        clients.delete(ws);
    });
});

wsServer.listen(WS_PORT, () => {
    const proto = sslOpts ? 'wss' : 'ws';
    console.log(`WebSocket server attivo: ${proto}://0.0.0.0:${WS_PORT}`);
});
