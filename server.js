const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const PORT = parseInt(process.env.PORT || '3000');
const BASE_PATH = process.env.BASE_PATH || '/apps/asp-anagrafica-front';

const app = express();
app.use(express.static('public'));

const server = createServer(app);

/* ======================== Socket.io ======================== */
const io = new Server(server, {
    cors: { origin: '*' },
    transports: ['polling']
});

io.on('connection', (socket) => {
    console.log(`Client connesso (${socket.id}). Totale: ${io.engine.clientsCount}`);

    socket.on('message', (data) => {
        // Broadcast a tutti gli altri client
        socket.broadcast.emit('message', data);
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnesso (${socket.id}). Totale: ${io.engine.clientsCount}`);
    });
});

server.listen(PORT, () => {
    console.log(`Server attivo su http://0.0.0.0:${PORT}`);
    console.log(`BASE_PATH: ${BASE_PATH}`);
});
