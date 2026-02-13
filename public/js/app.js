// State
window._selectedAssistito = null;
let currentSearchType = 'cf';

// Token da sessionStorage
function getToken() {
    return sessionStorage.getItem('asp_token');
}

// Utility: formatta data (gestisce sia stringhe che Unix timestamps)
function formatDate(val) {
    if (!val && val !== 0) return '';
    if (typeof val === 'string') return val;
    const d = new Date(val * 1000);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Alert system
function showAlert(message, type = 'info', duration = 3000) {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `<span>${message}</span><button class="alert-close">&times;</button>`;
    container.appendChild(alert);
    alert.querySelector('.alert-close').addEventListener('click', () => alert.remove());
    if (duration > 0) {
        setTimeout(() => { if (alert.parentNode) alert.remove(); }, duration);
    }
}

// Auth check
function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = APP_BASE;
        return;
    }
    const username = sessionStorage.getItem('asp_username') || '';
    document.getElementById('userInfo').textContent = username;
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('asp_token');
    sessionStorage.removeItem('asp_username');
    window.location.href = APP_BASE;
});

// Search type tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSearchType = btn.dataset.tab;
        document.getElementById('searchCF').style.display = currentSearchType === 'cf' ? '' : 'none';
        document.getElementById('searchDetails').style.display = currentSearchType === 'details' ? '' : 'none';
    });
});

// Search
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const params = {};

    if (currentSearchType === 'cf') {
        const cf = document.getElementById('codiceFiscale').value.trim().toUpperCase();
        if (!cf || cf.length < 5) { showAlert('Inserire almeno 5 caratteri del codice fiscale', 'warning'); return; }
        params.codiceFiscale = cf;
    } else {
        const cognome = document.getElementById('cognome').value.trim();
        const nome = document.getElementById('nome').value.trim();
        const dn = document.getElementById('dataNascita').value;

        let validParams = 0;
        if (cognome && cognome.length >= 3) validParams++;
        if (nome && nome.length >= 3) validParams++;
        if (dn && dn.length >= 4) validParams++;

        if (validParams < 2) {
            showAlert('Inserire almeno 2 parametri tra nome (min 3 car.), cognome (min 3 car.) e data di nascita', 'warning');
            return;
        }
        if (cognome) params.cognome = cognome;
        if (nome) params.nome = nome;
        if (dn) params.dataNascita = dn;
        const sesso = document.getElementById('sesso').value;
        if (sesso) params.sesso = sesso;
        const cn = document.getElementById('comuneNascita').value.trim();
        if (cn) params.comuneNascita = cn;
        const cr = document.getElementById('comuneResidenza').value.trim();
        if (cr) params.comuneResidenza = cr;
    }

    showLoading(true);
    try {
        const token = getToken();
        if (!token) {
            showAlert('Sessione scaduta', 'error');
            setTimeout(() => { window.location.href = APP_BASE; }, 1500);
            return;
        }

        // Chiamata diretta all'API ASP
        const qs = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== '') {
                qs.append(key, value);
            }
        }
        const res = await fetch('/api/v1/anagrafica/ricerca?' + qs.toString(), {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const body = await res.json();

        if (res.status === 401) {
            showAlert('Sessione scaduta, effettuare nuovamente il login', 'error');
            sessionStorage.removeItem('asp_token');
            setTimeout(() => { window.location.href = APP_BASE; }, 1500);
            return;
        }

        renderResults(body);
    } catch (err) {
        showAlert('Errore nella ricerca', 'error');
    } finally {
        showLoading(false);
    }
});

// Render results - gestisce envelope { ok, err, data }
function renderResults(body) {
    const section = document.getElementById('resultsSection');
    const tbody = document.getElementById('resultsBody');
    const count = document.getElementById('resultsCount');

    if (body.ok === false && body.err) {
        showAlert(body.err.msg || 'Errore nella ricerca', 'error');
        section.style.display = 'none';
        return;
    }

    let items = [];
    const data = body.data !== undefined ? body.data : body;

    if (Array.isArray(data)) {
        items = data;
    } else if (data && Array.isArray(data.assistiti)) {
        items = data.assistiti;
    } else if (data && Array.isArray(data.risultati)) {
        items = data.risultati;
    } else if (data && typeof data === 'object' && (data.cf || data.codiceFiscale)) {
        items = [data];
    }

    count.textContent = items.length;
    tbody.innerHTML = '';

    if (items.length === 0) {
        showAlert('Nessun risultato trovato', 'info');
        section.style.display = 'none';
        return;
    }

    items.forEach((item) => {
        const isDeceased = !!item.dataDecesso;
        const tr = document.createElement('tr');
        tr.className = isDeceased ? 'row-deceased' : '';
        tr.innerHTML = `
            <td>${item.cf || item.codiceFiscale || ''}</td>
            <td>${item.cognome || ''}</td>
            <td>${item.nome || ''}</td>
            <td>${formatDate(item.dataNascita)}</td>
            <td>${item.comuneResidenza || ''}</td>
            <td>${isDeceased ? '<span class="badge badge-danger">Deceduto</span>' : '<span class="badge badge-success">In vita</span>'}</td>
        `;
        tr.addEventListener('click', () => showDetail(item));
        tbody.appendChild(tr);
    });

    section.style.display = '';
    document.getElementById('detailSection').style.display = 'none';

    if (items.length === 1) {
        showDetail(items[0]);
    }
}

// Show detail
function showDetail(item) {
    window._selectedAssistito = item;
    const section = document.getElementById('detailSection');

    const isDeceased = !!item.dataDecesso;
    if (isDeceased) {
        showAlert('Attenzione: paziente deceduto', 'warning', 5000);
    }

    // Calcola eta
    let eta = '';
    if (item.dataNascita) {
        let nascita;
        if (typeof item.dataNascita === 'number') {
            nascita = new Date(item.dataNascita * 1000);
        } else if (typeof item.dataNascita === 'string' && item.dataNascita.includes('/')) {
            const parts = item.dataNascita.split('/');
            nascita = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
            nascita = new Date(item.dataNascita);
        }

        let ref = new Date();
        if (item.dataDecesso) {
            if (typeof item.dataDecesso === 'number') {
                ref = new Date(item.dataDecesso * 1000);
            } else if (typeof item.dataDecesso === 'string' && item.dataDecesso.includes('/')) {
                const parts = item.dataDecesso.split('/');
                ref = new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }

        if (!isNaN(nascita.getTime())) {
            eta = Math.floor((ref - nascita) / (365.25 * 24 * 60 * 60 * 1000));
        }
    }

    renderDetailGrid('detailAnagrafica', [
        ['Codice Fiscale', item.cf || item.codiceFiscale],
        ['CF Normalizzato', item.cfNormalizzato],
        ['Cognome', item.cognome],
        ['Nome', item.nome],
        ['Sesso', item.sesso],
        ['Data Nascita', formatDate(item.dataNascita)],
        ['Comune Nascita', item.comuneNascita],
        ['Cod. ISTAT Nascita', item.codIstatComuneNascita],
        ['Provincia Nascita', item.provinciaNascita],
        ['Eta', eta]
    ]);

    renderDetailGrid('detailResidenza', [
        ['Indirizzo', item.indirizzoResidenza],
        ['CAP', item.capResidenza],
        ['Comune', item.comuneResidenza],
        ['Cod. ISTAT Comune', item.codIstatComuneResidenza]
    ]);

    renderDetailGrid('detailSanitari', [
        ['ASP', item.asp],
        ['Tipo Assistito', item.ssnTipoAssistito],
        ['N. Tessera', item.ssnNumeroTessera],
        ['Inizio Assistenza', formatDate(item.ssnInizioAssistenza)],
        ['Fine Assistenza', formatDate(item.ssnFineAssistenza)],
        ['Motiv. Fine', item.ssnMotivazioneFineAssistenza],
        ['Data Decesso', formatDate(item.dataDecesso)]
    ]);

    const tipoMedico = (item.MMGTipo === 'P' || item.MMGTipo === 'PLS') ? 'Pediatra' : ((item.MMGTipo === 'M' || item.MMGTipo === 'MMG') ? 'MMG' : item.MMGTipo);
    renderDetailGrid('detailMedico', [
        ['Tipo', tipoMedico],
        ['Cognome', item.MMGCognome],
        ['Nome', item.MMGNome],
        ['CF Medico', item.MMGCf],
        ['Cod. Regionale', item.MMGCodReg],
        ['Data Scelta', formatDate(item.MMGDataScelta)],
        ['Data Revoca', formatDate(item.MMGDataRevoca)],
        ['Ultima Operazione', item.MMGUltimaOperazione],
        ['Ultimo Stato', item.MMGUltimoStato]
    ]);

    section.style.display = '';
    section.scrollIntoView({ behavior: 'smooth' });
}

function renderDetailGrid(containerId, fields) {
    const container = document.getElementById(containerId);
    container.innerHTML = fields
        .filter(([, val]) => val !== undefined && val !== null && val !== '' && val !== 0)
        .map(([label, val]) => `<div class="detail-item"><span class="detail-label">${label}</span><span class="detail-value">${val}</span></div>`)
        .join('');
}

// Copy actions
document.getElementById('copyJsonBtn').addEventListener('click', () => {
    if (!window._selectedAssistito) { showAlert('Nessun assistito selezionato', 'warning'); return; }
    navigator.clipboard.writeText(JSON.stringify(window._selectedAssistito, null, 2))
        .then(() => showAlert('JSON copiato negli appunti', 'success'))
        .catch(() => showAlert('Errore nella copia', 'error'));
});

document.getElementById('copyCfBtn').addEventListener('click', () => {
    const cf = window._selectedAssistito?.cf || window._selectedAssistito?.codiceFiscale;
    if (!cf) { showAlert('Nessun CF da copiare', 'warning'); return; }
    navigator.clipboard.writeText(cf)
        .then(() => showAlert('CF copiato negli appunti', 'success'))
        .catch(() => showAlert('Errore nella copia', 'error'));
});

document.getElementById('closeDetailBtn').addEventListener('click', () => {
    document.getElementById('detailSection').style.display = 'none';
    window._selectedAssistito = null;
});

// Loading
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// Init
checkAuth();
