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
        const res = await fetch(APP_BASE + 'api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
            window.location.href = APP_BASE + 'app.html';
        } else {
            errorEl.textContent = data.error || 'Errore durante il login';
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
