// State
window._selectedAssistito = null;
let currentSearchType = 'cf';

// Utility: converte Unix timestamp (secondi) in data leggibile DD/MM/YYYY
function formatDate(val) {
    if (!val && val !== 0) return '';
    if (typeof val === 'string') return val; // gia' formattato
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
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        if (!data.authenticated) {
            window.location.href = '/';
            return;
        }
        document.getElementById('userInfo').textContent = data.username;
    } catch {
        window.location.href = '/';
    }
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
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

        // Validazione: servono almeno 2 parametri tra nome (min 3), cognome (min 3), dataNascita (min 4)
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
        const res = await fetch('/api/anagrafica/ricerca', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        if (res.status === 401) {
            showAlert('Sessione scaduta', 'error');
            setTimeout(() => window.location.href = '/', 1500);
            return;
        }
        const body = await res.json();
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

    // Gestisci errori API
    if (body.ok === false && body.err) {
        showAlert(body.err.msg || 'Errore nella ricerca', 'error');
        section.style.display = 'none';
        return;
    }

    // Estrai i dati dall'envelope
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

    // Auto-select se risultato singolo
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

    // Calcola eta'
    let eta = '';
    if (item.dataNascita) {
        const nascita = typeof item.dataNascita === 'number' ? new Date(item.dataNascita * 1000) : new Date(item.dataNascita);
        const ref = item.dataDecesso
            ? (typeof item.dataDecesso === 'number' ? new Date(item.dataDecesso * 1000) : new Date(item.dataDecesso))
            : new Date();
        if (!isNaN(nascita.getTime())) {
            eta = Math.floor((ref - nascita) / (365.25 * 24 * 60 * 60 * 1000));
        }
    }

    // Anagrafica
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

    // Residenza
    renderDetailGrid('detailResidenza', [
        ['Indirizzo', item.indirizzoResidenza],
        ['CAP', item.capResidenza],
        ['Comune', item.comuneResidenza],
        ['Cod. ISTAT Comune', item.codIstatComuneResidenza]
    ]);

    // Sanitari
    renderDetailGrid('detailSanitari', [
        ['ASP', item.asp],
        ['Tipo Assistito', item.ssnTipoAssistito],
        ['N. Tessera', item.ssnNumeroTessera],
        ['Inizio Assistenza', formatDate(item.ssnInizioAssistenza)],
        ['Fine Assistenza', formatDate(item.ssnFineAssistenza)],
        ['Motiv. Fine', item.ssnMotivazioneFineAssistenza],
        ['Data Decesso', formatDate(item.dataDecesso)]
    ]);

    // Medico
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
