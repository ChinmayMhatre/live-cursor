const { io: ioClient } = require('socket.io-client');

let loadTestClients = [];
let loadTestActive = false;

module.exports = (io, socket) => {
  // Send current load test status on connect
  socket.emit('load-test-status', { active: loadTestActive });

  // Handle Admin: Start Load Test
  socket.on('admin:start-load-test', () => {
    console.log('Received admin:start-load-test event!');
    if (loadTestActive) return;
    loadTestActive = true;
    io.emit('load-test-status', { active: true });
    
    const PORT = process.env.PORT || 3000;
    const LOCAL_SOCKET_URL = `http://localhost:${PORT}`;
    const NUM_CLIENTS = 100;
    const MOVEMENT_INTERVAL_MS = 50;

    for (let i = 0; i < NUM_CLIENTS; i++) {
      setTimeout(() => {
        if (!loadTestActive) return; // Stop if cancelled during stagger
        
        const clientSocket = ioClient(LOCAL_SOCKET_URL, {
          transports: ['websocket'],
        });

        let interval;
        clientSocket.on('connect', () => {
          let x = Math.random();
          let y = Math.random();

          interval = setInterval(() => {
            x += (Math.random() * 0.04) - 0.02;
            y += (Math.random() * 0.04) - 0.02;
            x = Math.max(0, Math.min(1, x));
            y = Math.max(0, Math.min(1, y));
            
            clientSocket.emit('cursor:moved', { x, y });
          }, MOVEMENT_INTERVAL_MS);
        });

        loadTestClients.push({ socket: clientSocket, interval });
      }, i * 50);
    }
  });

  // Handle Admin: Stop Load Test
  socket.on('admin:stop-load-test', () => {
    if (!loadTestActive) return;
    loadTestActive = false;
    io.emit('load-test-status', { active: false });
    
    loadTestClients.forEach(client => {
      clearInterval(client.interval);
      client.socket.disconnect();
    });
    loadTestClients = [];
  });
};
