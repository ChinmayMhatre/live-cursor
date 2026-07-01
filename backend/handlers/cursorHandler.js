let pendingMoves = {};
let batchInterval = null;

module.exports = (io, socket) => {
  if (!batchInterval) {
    batchInterval = setInterval(() => {
      if (Object.keys(pendingMoves).length > 0) {
        // Broadcast all collected moves in one go
        io.volatile.emit('cursors:update', pendingMoves);
        pendingMoves = {};
      }
    }, 33); // ~30Hz Tick Rate
  }

  socket.on('cursor:moved', (data) => {
    // Update local state (this will be returned in future fetchSockets() calls)
    socket.data.x = data.x;
    socket.data.y = data.y;

    // Add to pending batch instead of broadcasting instantly
    pendingMoves[socket.data.id] = {
      x: data.x,
      y: data.y
    };
  });
};
