// WebSocket - stessa URL del sito, il reverse proxy inoltra a Express
let wsConnection = null;
let wsReconnectInterval = null;

// Costruisce la URL WSS dalla pagina corrente: wss://ws1.asp.messina.it/apps/asp-anagrafica-front/
const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + APP_BASE;

function connectWs() {
    try {
        if (wsConnection && (wsConnection.readyState === WebSocket.OPEN || wsConnection.readyState === WebSocket.CONNECTING)) return;

        wsConnection = new WebSocket(WS_URL);

        wsConnection.onopen = () => {
            updateWsBadge(true);
        };

        wsConnection.onclose = () => {
            wsConnection = null;
            updateWsBadge(false);
        };

        wsConnection.onerror = () => {
            wsConnection = null;
            updateWsBadge(false);
        };
    } catch {
        updateWsBadge(false);
    }
}

function updateWsBadge(connected) {
    const badge = document.getElementById('wsStatus');
    if (badge) {
        badge.textContent = connected ? 'WS: connesso' : 'WS: off';
        badge.classList.toggle('ws-active', connected);
    }
}

function sendWsCommand(command, data) {
    // Tenta prima via WebSocket diretto, altrimenti via HTTP POST
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        try {
            wsConnection.send(JSON.stringify({ command, data: data || {} }));
            showAlert(`Comando "${command}" inviato`, 'success');
            return;
        } catch {}
    }
    // Fallback: HTTP POST
    sendWsCommandHttp(command, data);
}

async function sendWsCommandHttp(command, data) {
    try {
        const res = await fetch(APP_BASE + 'api/ws/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, data: data || {} })
        });
        const result = await res.json();
        if (result.total === 0) {
            showAlert('Nessun client WebSocket connesso', 'warning');
        } else if (result.errors === 0) {
            showAlert(`Comando "${command}" inviato a ${result.sent} client`, 'success');
        } else {
            showAlert(`Inviato a ${result.sent} client, ${result.errors} errori`, 'warning');
        }
    } catch {
        showAlert('Errore nell\'invio del comando', 'error');
    }
}

// Polling stato WS (fallback se WS non disponibile)
async function pollWsStatus() {
    try {
        const res = await fetch(APP_BASE + 'api/ws/status');
        const data = await res.json();
        const badge = document.getElementById('wsStatus');
        if (badge && !(wsConnection && wsConnection.readyState === WebSocket.OPEN)) {
            badge.textContent = `WS: ${data.clients} client`;
            badge.classList.toggle('ws-active', data.clients > 0);
        }
    } catch {}
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    connectWs();
    setInterval(() => {
        if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
            connectWs();
        }
    }, 5000);

    // Polling status come fallback
    pollWsStatus();
    setInterval(pollWsStatus, 5000);

    // Bind bottoni comandi
    document.querySelectorAll('[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => {
            const cmd = btn.dataset.cmd;
            if (cmd === 'inviaDatiPaziente' && window._selectedAssistito) {
                sendWsCommand(cmd, window._selectedAssistito);
            } else {
                sendWsCommand(cmd);
            }
        });
    });
});
