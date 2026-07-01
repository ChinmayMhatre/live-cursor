const { v4: uuidv4 } = require('uuid');
const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');

const getRandomHexColor = () => {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
};

module.exports = async (io, socket) => {
  // 1. Assign Participant Data
  const participantId = uuidv4();
  const color = getRandomHexColor();
  const wackyName = uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: ' ',
    style: 'capital'
  });

  socket.data = {
    id: participantId,
    color,
    name: wackyName,
    x: -100, // starting off-screen
    y: -100
  };

  console.log(`[+] Participant joined: ${wackyName} (${participantId}) on node ${process.pid}`);

  // 2. Fetch all active participants across ALL servers to sync this new user
  // `fetchSockets()` works across the redis-adapter to gather data from all nodes
  const sockets = await io.fetchSockets();
  const allParticipants = sockets.map(s => s.data);
  
  // Send initial sync state to the new user
  socket.emit('session:init', { id: participantId });
  socket.emit('workspace:sync', allParticipants);

  // 3. Broadcast to everyone else that this participant joined
  socket.broadcast.emit('participant:joined', socket.data);

  // 4. Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[-] Participant left: ${wackyName} (${participantId})`);
    io.emit('participant:left', { id: participantId });
  });
};
