import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import Cursor from './components/Cursor';
import './index.css';

// In production (Docker), Nginx serves the app and proxies /socket.io to the backend.
// In local dev (Vite), we connect directly to the Node.js server.
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : '/';

function App() {
  const [participants, setParticipants] = useState({});
  const [myId, setMyId] = useState(null);
  const [isLoadTesting, setIsLoadTesting] = useState(false);
  const socketRef = useRef(null);
  const lastMoveTime = useRef(0);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('load-test-status', ({ active }) => {
      setIsLoadTesting(active);
    });

    socket.on('session:init', ({ id }) => {
      setMyId(id);
    });

    socket.on('workspace:sync', (allParticipants) => {
      const state = {};
      allParticipants.forEach(p => {
        state[p.id] = p;
      });
      setParticipants(state);

      // We now explicitly know our generated ID via session:init
    });

    socket.on('participant:joined', (participant) => {
      setParticipants(prev => ({ ...prev, [participant.id]: participant }));
    });

    socket.on('participant:left', ({ id }) => {
      setParticipants(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    socket.on('cursors:update', (batch) => {
      // Loop through the batched dictionary and dispatch custom events
      for (const id in batch) {
        const { x, y } = batch[id];
        window.dispatchEvent(new CustomEvent(`cursor-move-${id}`, { detail: { x, y } }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!socketRef.current) return;

      const now = Date.now();
      // Throttle to roughly 60fps (16ms)
      if (now - lastMoveTime.current > 16) {
        socketRef.current.emit('cursor:moved', {
          x: e.clientX / window.innerWidth,
          y: e.clientY / window.innerHeight
        });
        lastMoveTime.current = now;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const toggleLoadTest = () => {
    console.log('Toggling load test. Current state:', isLoadTesting);
    console.log('Socket reference:', !!socketRef.current);
    if (socketRef.current) {
      if (isLoadTesting) {
        socketRef.current.emit('admin:stop-load-test');
      } else {
        socketRef.current.emit('admin:start-load-test');
      }
    }
  };

  return (
    <div className="workspace">
      <div className="workspace-header">
        <h1>Shared Workspace</h1>
        <p style={{ display: 'inline-block', marginRight: '20px' }}>
          Active Participants: {Object.keys(participants).length}
        </p>
        <button
          onClick={toggleLoadTest}
          style={{
            padding: '8px 16px',
            backgroundColor: isLoadTesting ? '#ef4444' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            pointerEvents: 'auto'
          }}
        >
          {isLoadTesting ? 'Stop Load Test' : 'Start Load Test'}
        </button>
      </div>

      {Object.values(participants)
        .filter(p => p.id !== myId)
        .map(p => (
          <Cursor key={p.id} participant={p} />
        ))}
    </div>
  );
}

export default App;
