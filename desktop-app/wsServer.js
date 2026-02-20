const { WebSocketServer } = require('ws');

let wss = null;
const clients = new Set();
let notifyRenderer = null;

function createWsServer(mainWindow) {
    notifyRenderer = (channel, data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, data);
        }
    };

    wss = new WebSocketServer({ port: 12345, host: '127.0.0.1' });

    wss.on('connection', (ws) => {
        clients.add(ws);
        console.log(`WS: Nuovo client connesso. Totale: ${clients.size}`);
        notifyRenderer('ws:client-count', clients.size);

        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                console.log('WS: Messaggio ricevuto:', msg);
                notifyRenderer('ws:incoming-command', msg);
            } catch (e) {
                console.error('WS: Messaggio non valido:', e.message);
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
            console.log(`WS: Client disconnesso. Totale: ${clients.size}`);
            notifyRenderer('ws:client-count', clients.size);
        });

        ws.on('error', (error) => {
            console.error('WS: Errore client:', error.message);
            clients.delete(ws);
            notifyRenderer('ws:client-count', clients.size);
        });
    });

    wss.on('error', (error) => {
        console.error('WS: Errore server:', error.message);
        notifyRenderer('ws:server-status', { active: false, error: error.message });
    });

    wss.on('listening', () => {
        console.log('WS: Server attivo su 127.0.0.1:12345');
        notifyRenderer('ws:server-status', { active: true });
    });

    return wss;
}

function broadcastCommand(command, data = {}) {
    if (clients.size === 0) return { sent: 0, errors: 0 };

    const message = JSON.stringify({ command, data });
    let sent = 0;
    let errors = 0;

    clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            try {
                client.send(message);
                sent++;
            } catch (err) {
                errors++;
                console.error('WS: Errore invio:', err.message);
            }
        } else {
            errors++;
        }
    });

    return { sent, errors };
}

function getClientCount() {
    return clients.size;
}

function shutdown() {
    return new Promise((resolve) => {
        if (!wss) { resolve(); return; }
        clients.forEach((client) => {
            try { client.close(); } catch (e) { /* ignore */ }
        });
        clients.clear();
        wss.close(() => {
            console.log('WS: Server chiuso');
            resolve();
        });
    });
}

module.exports = { createWsServer, broadcastCommand, getClientCount, shutdown };
