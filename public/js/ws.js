// Socket.io - connessione tramite HTTP polling + upgrade WS automatico
let socket = null;

function connectWs() {
    if (socket && socket.connected) return;

    socket = io({
        path: window.APP_BASE + 'socket.io'
    });

    socket.on('connect', () => updateWsBadge(true));
    socket.on('disconnect', () => updateWsBadge(false));

    socket.on('message', (data) => {
        // Gestione messaggi in arrivo dagli altri client
        if (data && data.command) {
            console.log('Comando ricevuto:', data.command, data.data);
        }
    });
}

function updateWsBadge(connected) {
    const badge = document.getElementById('wsStatus');
    if (badge) {
        badge.textContent = connected ? 'WS: connesso' : 'WS: off';
        badge.classList.toggle('ws-active', connected);
    }
}

function sendWsCommand(command, data) {
    if (!socket || !socket.connected) {
        showAlert('WebSocket non connesso', 'warning');
        return;
    }
    try {
        socket.emit('message', { command, data: data || {} });
        showAlert(`Comando "${command}" inviato`, 'success');
    } catch {
        showAlert('Errore nell\'invio del comando', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    connectWs();

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
