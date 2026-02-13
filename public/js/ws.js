// Polling stato WebSocket
let wsPollingInterval = null;

function startWsPolling() {
    updateWsStatus();
    wsPollingInterval = setInterval(updateWsStatus, 3000);
}

async function updateWsStatus() {
    try {
        const res = await fetch('/api/ws/status');
        const data = await res.json();
        const badge = document.getElementById('wsStatus');
        if (badge) {
            badge.textContent = `WS: ${data.clients}`;
            badge.classList.toggle('ws-active', data.clients > 0);
        }
    } catch {
        // silently ignore
    }
}

async function sendWsCommand(command, data) {
    try {
        const res = await fetch('/api/ws/command', {
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
        return result;
    } catch (err) {
        showAlert('Errore nell\'invio del comando WebSocket', 'error');
    }
}

// Bind WS command buttons
document.addEventListener('DOMContentLoaded', () => {
    startWsPolling();

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
