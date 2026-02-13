document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Accesso in corso...';

    try {
        const qs = new URLSearchParams({
            login: username + '@asp.messina.it',
            password: password,
            scopi: 'asp5-anagrafica',
            ambito: 'api',
            domain: 'asp.messina.it'
        });
        const res = await fetch('/api/v1/login/get-token?' + qs.toString(), { method: 'POST' });
        const body = await res.json();
        if (body.ok && body.data) {
            const token = typeof body.data === 'string' ? body.data : (body.data.token || body.data.accessToken || JSON.stringify(body.data));
            sessionStorage.setItem('asp_token', token);
            sessionStorage.setItem('asp_username', username);
            window.location.href = APP_BASE + 'app.html';
        } else {
            errorEl.textContent = body.err?.msg || 'Credenziali non valide';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = 'Errore di connessione al server';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Accedi';
    }
});
