const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { callApi } = require('../services/apiClient');

router.post('/anagrafica/ricerca', authMiddleware, async (req, res) => {
    try {
        const params = req.body;
        const data = await callApi(req.session.token, '/api/v1/anagrafica/ricerca', params);
        res.json(data);
    } catch (err) {
        console.error('Ricerca error:', err.message);
        if (err.status === 401) {
            req.session.destroy(() => {});
            return res.status(401).json({ error: 'Sessione scaduta, effettuare nuovamente il login' });
        }
        res.status(err.status || 500).json({ error: 'Errore nella ricerca' });
    }
});

module.exports = router;
