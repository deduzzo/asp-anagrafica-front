const express = require('express');

const PORT = parseInt(process.env.PORT || '3000');
const BASE_PATH = process.env.BASE_PATH || '/apps/asp-anagrafica-front';

const pkg = require('./package.json');

const app = express();

app.get('/version', (req, res) => res.json({ version: pkg.version }));

app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Server attivo su http://0.0.0.0:${PORT}`);
    console.log(`BASE_PATH: ${BASE_PATH}`);
});
