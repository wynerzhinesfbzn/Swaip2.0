import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const getST = () => {
  try { return localStorage.getItem('swaip_session_token') || localStorage.getItem('swaip_session') || ''; }
  catch { return ''; }
};
const API_BASE = window.location.origin;

interface StoryItem {
  id: number;
  authorHash: string;
  mediaType: string;
  mediaUrl: string | null;
  textContent: string | null;
  bgGradient: string | null;
  overlayItems: any;
  createdAt: string;
  expiresAt: string;
}

interface StoryGroup {
  authorHash: string;
  authorMode: string;
  authorName: string;
  authorAvatar: string;
  authorHandle: string;
  stories: StoryItem[];
}

interface StoriesBarProps {
  myHash: string;
  myAvatar: string;
  myName: string;
  accent: string;
  onCreateStory?: () => void;
}

function AvatarCircle({ name, avatar, size }: { name: string; avatar: string; size: number }) {
  const [err, setErr] = useState(false);
  if (avatar && !err) {
    return <img src={avatar} alt="" onError={() => setErr(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  const letter = name?.[0]?.toUpperCase() || '?';
  const colors = ['#6366f1','#ec4899','#f97316','#22c55e','#3b82f6','#a855f7'];
  const bg = colors[letter.charCodeAt(0) % colors.length];
  return (
    <div style={{ width:'100%', height:'100%', background: `linear-gradient(135deg,${bg},${bg}88)`,
      display:'flex', alignItems:'center', justifyContent:'center', fontSize: size * 0.38, fontWeight:900, color:'#fff' }}>
      {letter}
    </div>
  );
}

export default function StoriesBar({ myHash, myAvatar, myName, accent, onCreateStory }: StoriesBarProps) {
  const [groups, setGroups]         = useState<StoryGroup[]>([]);
  const [seenSet, setSeenSet]       = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('swaip_seen_stories') || '[]')); }
    catch { return new Set(); }
  });
  const [viewerGroup, setViewerGroup] = useState<StoryGroup | null>(null);
  const [viewerIdx,   setViewerIdx]   = useState(0);
  const [progress,    setProgress]    = useState(0);
  const [paused,      setPaused]      = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStories = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/stories`);
      if (r.ok) { const d = await r.json(); setGroups(d.groups ?? []); }
    } catch {}
  }, []);

  useEffect(() => {
    loadStories();
    const t = setInterval(loadStories, 30_000);
    return () => clearInterval(t);
  }, [loadStories]);

  const markSeen = useCallback((key: string) => {
    setSeenSet(prev => {
      const next = new Set(prev);
      next.add(key);
      try { localStorage.setItem('swaip_seen_stories', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const storyKey = (hash: string, id: number) => `${hash}_${id}`;

  const openViewer = (group: StoryGroup, idx = 0) => {
    setViewerGroup(group);
    setViewerIdx(idx);
    setProgress(0);
    markSeen(storyKey(group.authorHash, group.stories[idx]?.id));
  };

  const closeViewer = useCallback(() => {
    setViewerGroup(null);
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const goNext = useCallback(() => {
    setViewerGroup(prev => {
      if (!prev) return null;
      const nextIdx = viewerIdx + 1;
      if (nextIdx < prev.stories.length) {
        setViewerIdx(nextIdx);
        setProgress(0);
        markSeen(storyKey(prev.authorHash, prev.stories[nextIdx]?.id));
        return prev;
      }
      const gi = groups.findIndex(g => g.authorHash === prev.authorHash);
      if (gi < groups.length - 1) {
        const ng = groups[gi + 1];
        setViewerIdx(0);
        setProgress(0);
        markSeen(storyKey(ng.authorHash, ng.stories[0]?.id));
        return ng;
      }
      return null;
    });
  }, [viewerIdx, groups, markSeen]);

  const goPrev = useCallback(() => {
    if (viewerIdx > 0) { setViewerIdx(v => v - 1); setProgress(0); }
  }, [viewerIdx]);

  useEffect(() => {
    if (!viewerGroup || paused) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);
    const dur = viewerGroup.stories[viewerIdx]?.mediaType === 'video' ? 15_000 : 5_000;
    const step = 100;
    let elapsed = 0;
    intervalRef.current = setInterval(() => {
      elapsed += step;
      setProgress(Math.min(elapsed / dur * 100, 100));
      if (elapsed >= dur) { clearInterval(intervalRef.current!); goNext(); }
    }, step);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [viewerGroup, viewerIdx, paused, goNext]);

  const others  = groups.filter(g => g.authorHash !== myHash);
  const myGroup = groups.find(g => g.authorHash === myHash);
  const hasMyStory = !!myGroup;
  const allSeen = (g: StoryGroup) => g.stories.every(s => seenSet.has(storyKey(g.authorHash, s.id)));
  const curStory = viewerGroup?.stories[viewerIdx];

  if (others.length === 0 && !hasMyStory) {
    return (
      <div style={{ padding:'12px 14px 6px', display:'flex', gap:12, alignItems:'center' }}>
        <motion.div whileTap={{ scale:0.92 }} onClick={onCreateStory}
          style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:5, cursor:'pointer' }}>
          <div style={{ width:58, height:58, borderRadius:'50%', border:`2px dashed rgba(255,255,255,0.25)`,
            display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
            <AvatarCircle name={myName} avatar={myAvatar} size={58} />
            <div style={{ position:'absolute', bottom:1, right:1, width:18, height:18, borderRadius:'50%',
              background:accent, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, color:'#000', fontWeight:900, border:'2px solid #0a0c14' }}>+</div>
          </div>
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.45)', fontWeight:700 }}>Моя история</span>
        </motion.div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', fontFamily:'"Montserrat",sans-serif' }}>
          Здесь появятся истории ваших друзей
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ overflowX:'auto', display:'flex', gap:12, padding:'12px 14px 10px',
        scrollbarWidth:'none', flexShrink:0 }}>
        {/* My Story circle */}
        <motion.div whileTap={{ scale:0.92 }}
          onClick={hasMyStory ? () => openViewer(myGroup!) : onCreateStory}
          style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:5, cursor:'pointer' }}>
          <div style={{ position:'relative', width:60, height:60 }}>
            <div style={{ width:60, height:60, borderRadius:'50%', overflow:'hidden',
              outline: hasMyStory ? `2.5px solid ${accent}` : 'none', outlineOffset:2,
              border: hasMyStory ? '2px solid transparent' : '2px dashed rgba(255,255,255,0.3)' }}>
              <AvatarCircle name={myName} avatar={myAvatar} size={60} />
            </div>
            {!hasMyStory && (
              <div style={{ position:'absolute', bottom:0, right:0, width:20, height:20, borderRadius:'50%',
                background:accent, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, color:'#000', fontWeight:900, border:'2px solid #0a0c14' }}>+</div>
            )}
          </div>
          <span style={{ fontSize:9, color:hasMyStory?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.45)',
            fontWeight:700, maxWidth:62, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>
            {hasMyStory ? 'Моя история' : 'Моя история'}
          </span>
        </motion.div>

        {/* Others */}
        {others.map(group => {
          const isSeen = allSeen(group);
          return (
            <motion.div key={group.authorHash} whileTap={{ scale:0.92 }} onClick={() => openViewer(group)}
              style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:5, cursor:'pointer' }}>
              <div style={{ width:60, height:60, borderRadius:'50%',
                background: isSeen ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg,${accent},#ec4899)`,
                padding: '2.5px', boxSizing:'border-box' as const }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', overflow:'hidden', border:'2px solid #0a0c14' }}>
                  <AvatarCircle name={group.authorName} avatar={group.authorAvatar} size={56} />
                </div>
              </div>
              <span style={{ fontSize:9, fontWeight: isSeen ? 500 : 700, maxWidth:62,
                color: isSeen ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>
                {group.authorName}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* ── Viewer ── */}
      <AnimatePresence>
        {viewerGroup && curStory && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, zIndex:9999, background:'#000', display:'flex', flexDirection:'column' }}>

            {/* Progress bars */}
            <div style={{ display:'flex', gap:3, padding:`max(14px,env(safe-area-inset-top)) 14px 8px`,
              position:'absolute', top:0, left:0, right:0, zIndex:2 }}>
              {viewerGroup.stories.map((s, i) => (
                <div key={s.id} style={{ flex:1, height:3, borderRadius:2,
                  background:'rgba(255,255,255,0.3)', overflow:'hidden' }}>
                  <div style={{ height:'100%', background:'#fff',
                    width: i < viewerIdx ? '100%' : i === viewerIdx ? `${progress}%` : '0%',
                    transition: 'width 0.1s linear' }} />
                </div>
              ))}
            </div>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'calc(env(safe-area-inset-top) + 22px) 14px 8px',
              position:'absolute', top:0, left:0, right:0, zIndex:2,
              background:'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', flexShrink:0, border:`2px solid ${accent}55` }}>
                <AvatarCircle name={viewerGroup.authorName} avatar={viewerGroup.authorAvatar} size={36} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#fff', fontFamily:'"Montserrat",sans-serif' }}>
                  {viewerGroup.authorName}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', fontFamily:'"Montserrat",sans-serif' }}>
                  {new Date(curStory.createdAt).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
              <button onClick={closeViewer}
                style={{ background:'rgba(255,255,255,0.18)', border:'none', borderRadius:'50%',
                  width:34, height:34, color:'#fff', fontSize:18, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
            </div>

            {/* Content */}
            <div style={{ flex:1, position:'relative', overflow:'hidden' }}
              onMouseDown={() => setPaused(true)}
              onMouseUp={() => setPaused(false)}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => setPaused(false)}>

              {curStory.mediaType === 'image' && curStory.mediaUrl && (
                <img src={curStory.mediaUrl} alt=""
                  style={{ width:'100%', height:'100%', objectFit:'contain' }} />
              )}
              {curStory.mediaType === 'video' && curStory.mediaUrl && (
                <video src={curStory.mediaUrl} autoPlay muted playsInline loop
                  style={{ width:'100%', height:'100%', objectFit:'contain' }} />
              )}
              {curStory.mediaType === 'text' && (
                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
                  background: curStory.bgGradient || `linear-gradient(135deg,${accent}66,#1a1c2a)`,
                  padding:32, boxSizing:'border-box' }}>
                  <div style={{ fontSize:24, fontWeight:900, color:'#fff', textAlign:'center',
                    fontFamily:'"Montserrat",sans-serif', textShadow:'0 2px 16px rgba(0,0,0,0.7)', lineHeight:1.4 }}>
                    {curStory.textContent}
                  </div>
                </div>
              )}

              {/* Tap zones (left = prev, right = next) */}
              <div style={{ position:'absolute', inset:0, display:'flex' }}>
                <div style={{ flex:1 }}
                  onClick={e => { e.stopPropagation(); goPrev(); }} />
                <div style={{ flex:2 }}
                  onClick={e => { e.stopPropagation(); goNext(); }} />
              </div>
            </div>

            {/* Bottom gradient */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:80,
              background:'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', pointerEvents:'none' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
