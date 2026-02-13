const express = require('express');
const session = require('express-session');
const path = require('path');
const { WebSocketServer } = require('ws');

const authRoutes = require('./src/routes/auth');
const anagraficaRoutes = require('./src/routes/anagrafica');

const app = express();
const PORT = 3000;
const WS_PORT = 12345;

// Session
app.use(session({
    secret: 'asp-anagrafica-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 ore
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', authRoutes);
app.use('/api', anagraficaRoutes);

// WebSocket server
const wsClients = new Set();
let wsActive = false;

try {
    const wss = new WebSocketServer({ port: WS_PORT });

    wss.on('connection', (ws) => {
        wsClients.add(ws);
        console.log(`WS client connesso. Totale: ${wsClients.size}`);

        ws.on('close', () => {
            wsClients.delete(ws);
            console.log(`WS client disconnesso. Totale: ${wsClients.size}`);
        });

        ws.on('error', (err) => {
            console.error('WS error:', err.message);
            wsClients.delete(ws);
        });
    });

    wss.on('listening', () => {
        wsActive = true;
        console.log(`WebSocket server attivo sulla porta ${WS_PORT}`);
    });

    wss.on('error', (err) => {
        console.error(`WebSocket server errore (porta ${WS_PORT}): ${err.message}`);
        wsActive = false;
    });
} catch (err) {
    console.error(`Impossibile avviare WebSocket server: ${err.message}`);
}

// WS status endpoint
app.get('/api/ws/status', (req, res) => {
    res.json({ clients: wsClients.size, active: wsActive });
});

// WS command endpoint
app.post('/api/ws/command', express.json(), (req, res) => {
    const { command, data } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'Comando mancante' });
    }

    const message = JSON.stringify({ command, data: data || {} });
    let sent = 0;
    let errors = 0;

    wsClients.forEach((client) => {
        if (client.readyState === 1) {
            try {
                client.send(message);
                sent++;
            } catch {
                errors++;
            }
        } else {
            errors++;
        }
    });

    res.json({ sent, errors, total: wsClients.size });
});

// Redirect root to login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server HTTP attivo su http://localhost:${PORT}`);
});
