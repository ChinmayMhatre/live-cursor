const { io } = require('socket.io-client');

const SOCKET_URL = 'http://localhost:3000';
const NUM_CLIENTS = 100;
const MOVEMENT_INTERVAL_MS = 50; // 20 times a second

console.log(`Spawning ${NUM_CLIENTS} headless clients...`);

const clients = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
  setTimeout(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      // Start moving randomly (relative coords 0.0 to 1.0)
      let x = Math.random();
      let y = Math.random();

      setInterval(() => {
        // random jitter (e.g. max 0.02 which is roughly 2% of the screen)
        x += (Math.random() * 0.04) - 0.02;
        y += (Math.random() * 0.04) - 0.02;

        // Clamp to screen bounds
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        
        socket.emit('cursor:moved', { x, y });
      }, MOVEMENT_INTERVAL_MS);
    });

    clients.push(socket);
  }, i * 50); // Stagger connections by 50ms to prevent overwhelming Redis
}

console.log(`All ${NUM_CLIENTS} clients are connecting and will broadcast their cursor movements.`);
