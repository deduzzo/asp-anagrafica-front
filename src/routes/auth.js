const express = require('express');
const router = express.Router();
const { getToken } = require('../services/apiClient');

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username e password obbligatori' });
        }
        const result = await getToken(username, password);
        // Il token e' dentro result.data (envelope standard)
        const tokenData = result.data;
        // Salva il token JWT dalla risposta - puo' essere in data.token, data.accessToken, ecc.
        const token = typeof tokenData === 'string' ? tokenData : (tokenData?.token || tokenData?.accessToken || JSON.stringify(tokenData));
        req.session.token = token;
        req.session.username = username;
        res.json({ ok: true });
    } catch (err) {
        console.error('Login error:', err.message);
        const status = err.status || 500;
        res.status(status).json({ error: err.message || 'Credenziali non valide o errore di connessione' });
    }
});

router.get('/auth/status', (req, res) => {
    if (req.session && req.session.token) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

module.exports = router;
