const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PORT || '3000');
const BASE_PATH = process.env.BASE_PATH || '/apps/asp-anagrafica-front/';

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);

/* ======================== WebSocket ======================== */
const wss = new WebSocketServer({ server });
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

server.listen(PORT, () => {
    console.log(`Server attivo su http://0.0.0.0:${PORT}`);
    console.log(`BASE_PATH: ${BASE_PATH}`);
});
