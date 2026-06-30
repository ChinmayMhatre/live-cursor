const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const cors = require('cors');

const registerAdminHandlers = require('./handlers/adminHandler');
const registerSessionHandlers = require('./handlers/sessionHandler');
const registerCursorHandlers = require('./handlers/cursorHandler');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function startServer() {
  // Setup Redis Pub/Sub for horizontal scaling
  const pubClient = createClient({ url: REDIS_URL });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('Redis Pub Error:', err));
  subClient.on('error', (err) => console.error('Redis Sub Error:', err));

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Redis adapter connected');
  } catch (err) {
    console.error('Failed to connect to Redis. Running without Redis adapter.', err);
    // Proceed without redis adapter if local redis is not available
  }

  io.on('connection', async (socket) => {
    // Modularly register all handlers for this socket connection
    registerAdminHandlers(io, socket);
    await registerSessionHandlers(io, socket);
    registerCursorHandlers(io, socket);
  });

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT} (PID: ${process.pid})`);
  });
}

startServer();
