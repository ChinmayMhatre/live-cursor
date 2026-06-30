module.exports = (io, socket) => {
  socket.on('cursor:moved', (data) => {
    // Update local state (this will be returned in future fetchSockets() calls)
    socket.data.x = data.x;
    socket.data.y = data.y;

    // Broadcast high-frequency updates
    // Payload is minimized to just ID and coordinates
    socket.broadcast.emit('cursor:moved', {
      id: socket.data.id,
      x: data.x,
      y: data.y
    });
  });
};
