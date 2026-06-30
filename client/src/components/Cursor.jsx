import React, { useRef, useEffect } from 'react';
import { MousePointer2 } from 'lucide-react';

const Cursor = ({ participant }) => {
  const { id, x, y, color, name } = participant;
  const cursorRef = useRef(null);
  
  // Track the latest relative coordinates for the resize listener
  const latestRelativeCoords = useRef({ x, y });

  useEffect(() => {
    const applyTransform = (relX, relY) => {
      if (relX === -100 && relY === -100) return; // Default off-screen

      if (cursorRef.current) {
        const absX = relX * window.innerWidth;
        const absY = relY * window.innerHeight;
        cursorRef.current.style.transform = `translate(${absX}px, ${absY}px)`;
        
        if (cursorRef.current.style.display === 'none') {
          cursorRef.current.style.display = 'block';
        }
      }
    };

    const handleMove = (e) => {
      latestRelativeCoords.current = { x: e.detail.x, y: e.detail.y };
      applyTransform(e.detail.x, e.detail.y);
    };

    const handleResize = () => {
      applyTransform(latestRelativeCoords.current.x, latestRelativeCoords.current.y);
    };

    const eventName = `cursor-move-${id}`;
    window.addEventListener(eventName, handleMove);
    window.addEventListener('resize', handleResize);
    
    // Apply initial transform if not default
    applyTransform(latestRelativeCoords.current.x, latestRelativeCoords.current.y);

    return () => {
      window.removeEventListener(eventName, handleMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [id]);

  const isInitiallyHidden = x === -100 && y === -100;
  
  return (
    <div
      ref={cursorRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        // The transform will be overridden by the useEffect instantly if not hidden
        display: isInitiallyHidden ? 'none' : 'block',
        pointerEvents: 'none',
        zIndex: 50,
        transition: 'transform 0.05s linear',
      }}
    >
      <MousePointer2
        size={24}
        color={color}
        fill={color}
        style={{ transform: 'rotate(-15deg)', stroke: 'white', strokeWidth: 1.5 }}
      />
      <div
        style={{
          backgroundColor: color,
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          marginTop: '4px',
          marginLeft: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        {name}
      </div>
    </div>
  );
};

export default Cursor;
