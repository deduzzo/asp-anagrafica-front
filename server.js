const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const authRoutes = require('./src/routes/auth');
const anagraficaRoutes = require('./src/routes/anagrafica');

const app = express();
const PORT = process.env.PORT || 3000;

// Session
app.use(session({
    secret: 'asp-anagrafica-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api', authRoutes);
app.use('/api', anagraficaRoutes);

// WS clients
const wsClients = new Set();

function setupWsConnection(ws) {
    wsClients.add(ws);
    console.log(`WS client connesso. Totale: ${wsClients.size}`);

    // Relay: ogni messaggio ricevuto viene inoltrato a tutti gli altri client
    ws.on('message', (data) => {
        const msg = data.toString();
        wsClients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
                try { client.send(msg); } catch {}
            }
        });
    });

    ws.on('close', () => {
        wsClients.delete(ws);
        console.log(`WS client disconnesso. Totale: ${wsClients.size}`);
    });

    ws.on('error', (err) => {
        console.error('WS error:', err.message);
        wsClients.delete(ws);
    });
}

// WS status (polling dal browser)
app.get('/api/ws/status', (req, res) => {
    res.json({ clients: wsClients.size, active: true });
});

// WS command via HTTP POST (il browser invia, il server rilancia ai client WS)
app.post('/api/ws/command', (req, res) => {
    const { command, data } = req.body;
    if (!command) return res.status(400).json({ error: 'Comando mancante' });

    const message = JSON.stringify({ command, data: data || {} });
    let sent = 0, errors = 0;

    wsClients.forEach((client) => {
        if (client.readyState === 1) {
            try { client.send(message); sent++; } catch { errors++; }
        } else { errors++; }
    });

    res.json({ sent, errors, total: wsClients.size });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// HTTP server + WebSocket sullo stesso server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on('connection', setupWsConnection);

server.listen(PORT, () => {
    console.log(`Server attivo su http://localhost:${PORT}`);
    console.log(`WebSocket attivo sullo stesso server`);
});
