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

    socket.on('workspace:sync', (allParticipants) => {
      const state = {};
      allParticipants.forEach(p => {
        state[p.id] = p;
      });
      setParticipants(state);

      // The socket doesn't explicitly send back our generated ID yet,
      // but we can infer it if we know which one is us, or just render all.
      // Actually, all participants will be rendered. We can just hide ours if we want,
      // but for this demo, it's fine if we don't see our own network cursor 
      // (we won't anyway since we don't emit our own to ourselves).
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

    socket.on('cursor:moved', ({ id, x, y }) => {
      // Decoupled state: do not trigger a React re-render.
      // Instead, dispatch a custom event that the specific Cursor component listens to.
      window.dispatchEvent(new CustomEvent(`cursor-move-${id}`, { detail: { x, y } }));
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

      {Object.values(participants).map(p => (
        <Cursor key={p.id} participant={p} />
      ))}
    </div>
  );
}

export default App;
