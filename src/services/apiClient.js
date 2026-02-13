const BASE_URL = 'https://ws1.asp.messina.it';

async function callApi(token, endpoint, params = {}, method = 'POST') {
    // I parametri vanno come query string (come da swagger)
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            qs.append(key, value);
        }
    }
    const url = `${BASE_URL}${endpoint}?${qs.toString()}`;
    const res = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    // Gestisci anche HTTP 300 (MULTIPLE_RESULTS) come risposta valida
    const body = await res.json();
    if (res.status === 401) {
        const error = new Error(body?.err?.msg || 'Non autorizzato');
        error.status = 401;
        throw error;
    }
    return body;
}

async function getToken(username, password) {
    // Parametri come query string (da swagger: tutti i params sono "in": "query")
    const qs = new URLSearchParams({
        login: username + '@asp.messina.it',
        password,
        scopi: 'asp5-anagrafica',
        ambito: 'api',
        domain: 'asp.messina.it'
    });
    const url = `${BASE_URL}/api/v1/login/get-token?${qs.toString()}`;
    const res = await fetch(url, { method: 'POST' });
    const body = await res.json();
    if (!body.ok) {
        const error = new Error(body?.err?.msg || 'Login fallito');
        error.status = res.status;
        throw error;
    }
    return body;
}

module.exports = { callApi, getToken };
