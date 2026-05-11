import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const C = {
  bg: '#0f0f1c', card: '#14141f', border: 'rgba(200,200,255,0.12)',
  text: '#e8e8f8', sub: '#6060a0', accent: '#6366f1',
};

function hashColor(h: string) {
  const p = ['#6366f1','#8b5cf6','#ec4899','#3b82f6','#14b8a6','#f59e0b','#ef4444','#22c55e'];
  let n = 0; for (let i = 0; i < Math.min(h.length, 8); i++) n += h.charCodeAt(i); return p[n % p.length];
}
function initials(n: string) {
  const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
}
function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

interface Msg { id: string | number; senderHash: string; senderName: string; type: string; content?: string; audioUrl?: string; createdAt?: string; }

export default function InGameChat({
  messages, myHash, onSend,
}: {
  messages: Msg[];
  myHash: string;
  onSend: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [seenCount, setSeenCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const unread = open ? 0 : messages.filter(m => m.type === 'text').length - seenCount;

  useEffect(() => {
    if (open) {
      setSeenCount(messages.filter(m => m.type === 'text').length);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [open, messages]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    onSend(t);
    setInput('');
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 32, right: 18, zIndex: 300,
          width: 50, height: 50, borderRadius: '50%',
          background: open ? C.accent : 'rgba(30,30,50,0.95)',
          border: `1.5px solid ${open ? C.accent : C.border}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, cursor: 'pointer', color: '#fff',
        }}
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 20, height: 20, borderRadius: '50%',
            background: '#ef4444', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff',
          }}>{unread > 9 ? '9+' : unread}</div>
        )}
      </motion.button>

      {/* Chat drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop — tap to close */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 280, background: 'rgba(0,0,0,0.4)' }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 290,
                height: '52dvh', background: C.bg,
                borderRadius: '22px 22px 0 0',
                border: `1px solid ${C.border}`,
                display: 'flex', flexDirection: 'column',
                fontFamily: 'Montserrat,sans-serif',
                overflow: 'hidden',
              }}
            >
              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, padding: '0 14px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
                💬 Чат комнаты
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 6px', minHeight: 0 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: C.sub, padding: '20px 0', fontSize: 12 }}>Пока тихо…</div>
                )}
                {messages.filter(m => m.type === 'text').map((m) => {
                  const isMe = m.senderHash === myHash;
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 6, marginBottom: 7, alignItems: 'flex-end' }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: hashColor(m.senderHash),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, color: '#fff',
                      }}>{initials(m.senderName)}</div>
                      <div style={{ maxWidth: '72%' }}>
                        <div style={{ fontSize: 8, color: C.sub, marginBottom: 2, textAlign: isMe ? 'right' : 'left' }}>
                          {isMe ? 'Ты' : m.senderName}{m.createdAt ? ` · ${fmt(m.createdAt)}` : ''}
                        </div>
                        <div style={{
                          padding: '7px 11px',
                          borderRadius: isMe ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                          background: isMe ? C.accent : C.card,
                          border: `1px solid ${isMe ? 'transparent' : C.border}`,
                          fontSize: 12, color: C.text, lineHeight: 1.45, wordBreak: 'break-word',
                        }}>{m.content}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{
                padding: '8px 12px 20px', borderTop: `1px solid ${C.border}`,
                display: 'flex', gap: 8, alignItems: 'center', background: C.bg,
              }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Написать…"
                  style={{
                    flex: 1, padding: '9px 13px', borderRadius: 18,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 13, outline: 'none',
                    fontFamily: 'Montserrat,sans-serif', minWidth: 0,
                  }}
                />
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={send}
                  disabled={!input.trim()}
                  style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: input.trim() ? C.accent : '#222',
                    border: 'none', color: '#fff', fontSize: 15,
                    cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0,
                  }}
                >➤</motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
