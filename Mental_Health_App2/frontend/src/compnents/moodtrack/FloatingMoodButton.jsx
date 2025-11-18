import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const DEFAULT_POS = { right: 24, bottom: 120 };

const FloatingMoodButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState(DEFAULT_POS);
  const [animate, setAnimate] = useState(false);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const btnRef = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('floatingMoodPos');
      if (saved) setPos(JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }, []);

  // Listen for programmatic open events (e.g., from exit modal)
  useEffect(() => {
    const handler = () => {
      setAnimate(true);
      setIsOpen(true);
      setTimeout(() => setAnimate(false), 600);
    };
    window.addEventListener('openFloatingMoodModal', handler);
    return () => window.removeEventListener('openFloatingMoodModal', handler);
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      const x = e.clientX || (e.touches && e.touches[0].clientX);
      const y = e.clientY || (e.touches && e.touches[0].clientY);
      const newRight = window.innerWidth - x - dragOffset.current.x;
      const newBottom = window.innerHeight - y - dragOffset.current.y;
      const newPos = { right: Math.max(8, Math.min(newRight, window.innerWidth - 40)), bottom: Math.max(8, Math.min(newBottom, window.innerHeight - 40)) };
      setPos(newPos);
    };

    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        try { localStorage.setItem('floatingMoodPos', JSON.stringify(pos)); } catch (e) { }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMouseMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMouseMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [pos]);

  const startDrag = (e) => {
    dragging.current = true;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    dragOffset.current = { x: rect.right - x, y: rect.bottom - y };
  };

  // handle mouse double click
  const handleDoubleClick = (e) => {
    if (dragging.current) return;
    setAnimate(true);
    setIsOpen(true);
    setTimeout(()=> setAnimate(false), 600);
  };

  // handle touch double-tap
  const handleTouchEnd = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!dragging.current) {
        setAnimate(true);
        setIsOpen(true);
        setTimeout(()=> setAnimate(false), 600);
      }
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const moodLabels = ['😄', '😊', '😐', '😔', '😢'];

  const submitMood = async (mood) => {
    const username = localStorage.getItem('tokenUser') || '';
    const date = new Date().toISOString().split('T')[0];
    try {
      if (!username) {
        alert('Please login to save your mood');
        setIsOpen(false);
        return;
      }
      await axios.post(`http://localhost:4000/api/moods/${username}`, { date, mood });
      setIsOpen(false);
      const el = document.createElement('div');
      el.textContent = 'Mood saved';
      el.style.position = 'fixed'; el.style.bottom = '24px'; el.style.left = '50%'; el.style.transform = 'translateX(-50%)'; el.style.background = 'rgba(0,0,0,0.8)'; el.style.color='white'; el.style.padding='8px 12px'; el.style.borderRadius='8px'; document.body.appendChild(el);
      setTimeout(()=>el.remove(),1200);
    } catch (err) {
      console.error('Failed to save mood', err);
      alert('Failed to save mood.');
    }
  };

  return (
    <>
      <style>{`
        @keyframes popAnim { 0% { transform: scale(1); } 50% { transform: scale(1.25); } 100% { transform: scale(1); } }
        @keyframes floatPulse { 0% { transform: translateY(0); } 50% { transform: translateY(-6px); } 100% { transform: translateY(0); } }
        .fm-button-anim { animation: popAnim 0.5s ease; }
        .fm-button-pulse { animation: floatPulse 3s ease-in-out infinite; }
      `}</style>

      {/* Floating button */}
      <div
        ref={btnRef}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onDoubleClick={handleDoubleClick}
        onTouchEnd={handleTouchEnd}
        onDragStart={(e)=>e.preventDefault()}
        style={{ position: 'fixed', right: pos.right, bottom: pos.bottom, zIndex: 9999, cursor: 'grab', userSelect: 'none' }}
      >
        <div className={`${animate ? 'fm-button-anim' : 'fm-button-pulse'}`} style={{ width: 56, height: 56, borderRadius: 28, background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 10px 20px rgba(0,0,0,0.2)', userSelect:'none' }}>
          <span style={{ fontSize: 26, pointerEvents:'none' }}>🙂</span>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>setIsOpen(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background:'white', padding:20, borderRadius:12, minWidth:280, boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginBottom:12, fontSize:18, fontWeight:600 }}>How are you feeling now?</h3>
            <div style={{ display:'flex', justifyContent:'space-around', marginBottom:12 }}>
              {moodLabels.map((m)=> (
                <button key={m} onClick={()=>submitMood(m)} style={{ fontSize:28, background:'transparent', border:'none', cursor:'pointer' }}>
                  {m}
                </button>
              ))}
            </div>
            <div style={{ textAlign:'right' }}>
              <button onClick={()=>setIsOpen(false)} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #ddd' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingMoodButton;
