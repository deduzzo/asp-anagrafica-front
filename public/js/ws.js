// WebSocket - connessione diretta al server WSS sulla porta 12345
let wsConnection = null;

// WSS sullo stesso host, porta 12345
const WS_URL = 'wss://' + window.location.hostname + ':12345';

function connectWs() {
    try {
        if (wsConnection && (wsConnection.readyState === WebSocket.OPEN || wsConnection.readyState === WebSocket.CONNECTING)) return;

        wsConnection = new WebSocket(WS_URL);

        wsConnection.onopen = () => updateWsBadge(true);
        wsConnection.onclose = () => { wsConnection = null; updateWsBadge(false); };
        wsConnection.onerror = () => { wsConnection = null; updateWsBadge(false); };
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
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        showAlert('WebSocket non connesso', 'warning');
        return;
    }
    try {
        wsConnection.send(JSON.stringify({ command, data: data || {} }));
        showAlert(`Comando "${command}" inviato`, 'success');
    } catch {
        showAlert('Errore nell\'invio del comando', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    connectWs();
    setInterval(() => {
        if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) connectWs();
    }, 5000);

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
