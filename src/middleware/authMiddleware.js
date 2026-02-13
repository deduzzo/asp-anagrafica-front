function authMiddleware(req, res, next) {
    if (!req.session || !req.session.token) {
        return res.status(401).json({ error: 'Non autenticato' });
    }
    next();
}

module.exports = authMiddleware;
