// Electron Bridge - attivo solo quando l'app gira dentro Electron
if (!window.electronAPI) {
    // Non siamo in Electron, non fare nulla
} else {
    (function() {
        const api = window.electronAPI;

        // --- Badge WS nell'header ---
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            const badge = document.createElement('span');
            badge.id = 'wsStatus';
            badge.className = 'ws-badge';
            badge.textContent = 'WS: 0';
            badge.title = 'Client WebSocket connessi';
            headerRight.insertBefore(badge, headerRight.firstChild);
        }

        // --- Versione app nell'header ---
        api.getAppVersion().then((version) => {
            const headerLeft = document.querySelector('.header-left h1');
            if (headerLeft && version) {
                const vSpan = document.createElement('span');
                vSpan.style.cssText = 'font-size:0.7rem;color:var(--text-muted);margin-left:0.5rem;font-weight:400;';
                vSpan.textContent = 'v' + version;
                headerLeft.appendChild(vSpan);
            }
        });

        // --- Pannello comandi WS ---
        const detailSection = document.getElementById('detailSection');
        if (detailSection) {
            const wsPanel = document.createElement('div');
            wsPanel.id = 'wsCommandsPanel';
            wsPanel.className = 'ws-commands';
            wsPanel.innerHTML = `
                <div class="detail-section">
                    <h3>Comandi WebSocket</h3>
                    <div class="ws-commands-grid">
                        <button class="btn btn-ws" data-cmd="inviaDatiPaziente">Invia Dati</button>
                        <button class="btn btn-ws" data-cmd="ricercaAnagrafica">Ricerca Anagrafica</button>
                        <button class="btn btn-ws" data-cmd="aggiungiNuovoAssistito">Nuovo Assistito</button>
                        <button class="btn btn-ws" data-cmd="salva">Salva</button>
                        <button class="btn btn-ws" data-cmd="schedaIndirizzo">Scheda Indirizzo</button>
                        <button class="btn btn-ws" data-cmd="metodoPagamento">Metodo Pagamento</button>
                    </div>
                </div>`;
            // Inserisci dopo detailContent
            const detailContent = document.getElementById('detailContent');
            if (detailContent) {
                detailContent.appendChild(wsPanel);
            }

            // Event listeners per i pulsanti
            wsPanel.querySelectorAll('[data-cmd]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const command = btn.dataset.cmd;
                    let data = {};

                    if (command === 'inviaDatiPaziente' && window._selectedAssistito) {
                        data = window._selectedAssistito;
                    }

                    const result = await api.sendWsCommand(command, data);
                    if (result.sent > 0 && result.errors === 0) {
                        showAlert(`Comando "${command}" inviato a ${result.sent} client`, 'success');
                    } else if (result.sent > 0) {
                        showAlert(`Inviato a ${result.sent} client, ${result.errors} errori`, 'warning');
                    } else {
                        showAlert('Nessun client WebSocket connesso', 'warning');
                    }
                });
            });
        }

        // --- Aggiorna badge WS in tempo reale ---
        api.onWsClientCount((count) => {
            const badge = document.getElementById('wsStatus');
            if (badge) {
                badge.textContent = 'WS: ' + count;
                badge.classList.toggle('ws-active', count > 0);
            }
        });

        // --- Stato server WS ---
        api.onWsServerStatus((status) => {
            const badge = document.getElementById('wsStatus');
            if (badge && !status.active) {
                badge.textContent = 'WS: err';
                badge.classList.remove('ws-active');
                badge.classList.add('ws-error');
            }
        });

        // --- Broadcast automatico alla selezione paziente ---
        window.addEventListener('assistitoSelected', async (e) => {
            const count = await api.getWsClientCount();
            if (count > 0 && e.detail) {
                await api.sendWsCommand('inviaDatiPaziente', e.detail);
            }
        });

        // --- Auto-update notifications ---
        function removeUpdateBanner() {
            const old = document.getElementById('updateBanner');
            if (old) old.remove();
        }

        api.onUpdateAvailable((info) => {
            removeUpdateBanner();
            const container = document.getElementById('alertContainer');
            const banner = document.createElement('div');
            banner.id = 'updateBanner';
            banner.className = 'update-banner';
            banner.innerHTML = `
                <span class="update-banner-text">Nuova versione disponibile: <strong>v${info.version}</strong></span>
                <button class="btn btn-small btn-primary" id="downloadUpdateBtn">Scarica</button>
                <button class="btn btn-small btn-outline update-dismiss">&times;</button>`;
            container.appendChild(banner);

            banner.querySelector('#downloadUpdateBtn').addEventListener('click', () => {
                banner.querySelector('#downloadUpdateBtn').disabled = true;
                banner.querySelector('#downloadUpdateBtn').textContent = 'Download...';
                // Aggiungi barra progresso
                let progressBar = banner.querySelector('.update-progress');
                if (!progressBar) {
                    progressBar = document.createElement('div');
                    progressBar.className = 'update-progress';
                    progressBar.innerHTML = '<div class="update-progress-bar" style="width:0%"></div>';
                    banner.querySelector('.update-banner-text').after(progressBar);
                }
                api.downloadUpdate();
            });
            banner.querySelector('.update-dismiss').addEventListener('click', () => {
                banner.remove();
            });
        });

        api.onUpdateDownloadProgress((info) => {
            const bar = document.querySelector('.update-progress-bar');
            if (bar) {
                bar.style.width = info.percent + '%';
            }
            const btn = document.getElementById('downloadUpdateBtn');
            if (btn) btn.textContent = `${info.percent}%`;
        });

        api.onUpdateDownloaded((info) => {
            removeUpdateBanner();
            const container = document.getElementById('alertContainer');
            const banner = document.createElement('div');
            banner.id = 'updateBanner';
            banner.className = 'update-banner update-banner-ready';
            banner.innerHTML = `
                <span class="update-banner-text">Aggiornamento <strong>v${info.version}</strong> pronto!</span>
                <button class="btn btn-small btn-primary" id="installUpdateBtn">Installa e riavvia</button>
                <button class="btn btn-small btn-outline update-dismiss">Dopo</button>`;
            container.appendChild(banner);

            banner.querySelector('#installUpdateBtn').addEventListener('click', () => {
                api.installUpdate();
            });
            banner.querySelector('.update-dismiss').addEventListener('click', () => {
                banner.remove();
            });
        });

        api.onUpdateError((info) => {
            const btn = document.getElementById('downloadUpdateBtn');
            if (btn) {
                btn.textContent = 'Riprova';
                btn.disabled = false;
            }
            showAlert('Errore aggiornamento: ' + info.message, 'error', 5000);
        });

        // --- Comandi in arrivo da client esterni ---
        api.onWsIncomingCommand((msg) => {
            console.log('WS comando ricevuto:', msg);
        });
    })();
}
