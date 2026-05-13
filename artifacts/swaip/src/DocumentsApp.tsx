import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Types ─────────────────────────────────────────────────── */
interface RecentDoc {
  id: string;
  name: string;
  kind: string;
  size: number;
  date: number;
}
type ViewMode = 'home' | 'viewing';
type DocKind = 'pdf' | 'docx' | 'image' | 'text' | 'csv' | 'xlsx' | 'scan' | 'unknown';

interface Props {
  onBack: () => void;
  myHash?: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const detectKind = (name: string, mime: string): DocKind => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.includes('wordprocessingml') || ext === 'docx' || ext === 'doc') return 'docx';
  if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return 'image';
  if (ext === 'csv') return 'csv';
  if (mime.includes('spreadsheetml') || ['xlsx','xls'].includes(ext)) return 'xlsx';
  if (mime === 'text/plain' || ['txt','md','log','ini','json','xml','html','htm'].includes(ext)) return 'text';
  return 'unknown';
};

const kindIcon = (k: string) => {
  if (k === 'pdf') return '📄';
  if (k === 'docx') return '📝';
  if (k === 'xlsx' || k === 'csv') return '📊';
  if (k === 'image' || k === 'scan') return '🖼️';
  if (k === 'text') return '📃';
  return '📁';
};

const kindLabel = (k: string) => {
  if (k === 'pdf') return 'PDF';
  if (k === 'docx') return 'Word';
  if (k === 'xlsx') return 'Excel';
  if (k === 'csv') return 'CSV';
  if (k === 'image') return 'Изображение';
  if (k === 'scan') return 'Скан';
  if (k === 'text') return 'Текст';
  return 'Файл';
};

const fmtSize = (b: number) => b < 1024 ? b + ' Б' : b < 1048576 ? (b/1024).toFixed(1)+' КБ' : (b/1048576).toFixed(1)+' МБ';
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', {day:'2-digit',month:'short',year:'numeric'});

/* ─── Scan canvas filter ─────────────────────────────────────── */
const applyScanFilter = (file: File, mode: 'color' | 'bw'): Promise<{ dataUrl: string; blob: Blob }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 2400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        if (mode === 'color') {
          ctx.filter = 'contrast(1.45) saturate(1.3) brightness(1.12)';
          ctx.drawImage(img, 0, 0, width, height);
        } else {
          ctx.filter = 'grayscale(1) contrast(1.9) brightness(1.18)';
          ctx.drawImage(img, 0, 0, width, height);
          const id = ctx.getImageData(0, 0, width, height);
          const d = id.data;
          for (let i = 0; i < d.length; i += 4) {
            const v = d[i];
            const out = v > 172 ? 255 : v < 80 ? 0 : v;
            d[i] = d[i+1] = d[i+2] = out;
          }
          ctx.putImageData(id, 0, 0);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        canvas.toBlob(b => b ? resolve({ dataUrl, blob: b }) : reject(new Error('blob fail')), 'image/jpeg', 0.95);
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* ─── Component ──────────────────────────────────────────────── */
export default function DocumentsApp({ onBack, myHash }: Props) {
  const [viewMode, setViewMode]   = useState<ViewMode>('home');
  const [loading, setLoading]     = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [docName, setDocName]     = useState('');
  const [docKind, setDocKind]     = useState<DocKind>('unknown');
  const [pdfUrl, setPdfUrl]       = useState<string | null>(null);
  const [docHtml, setDocHtml]     = useState<string | null>(null);
  const [docText, setDocText]     = useState<string | null>(null);
  const [docTable, setDocTable]   = useState<unknown[][] | null>(null);
  const [imageUrl, setImageUrl]   = useState<string | null>(null);
  const [imgZoom, setImgZoom]     = useState(1);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [showSend, setShowSend]   = useState(false);
  const [contacts, setContacts]   = useState<{hash:string;name:string}[]>([]);
  const [sendSearch, setSendSearch] = useState('');
  const [sendDone, setSendDone]   = useState(false);
  const [toast, setToast]         = useState<string | null>(null);

  const fileRef       = useRef<HTMLInputElement>(null);
  const scanColorRef  = useRef<HTMLInputElement>(null);
  const scanBwRef     = useRef<HTMLInputElement>(null);
  const iframeRef     = useRef<HTMLIFrameElement>(null);
  const htmlViewRef   = useRef<HTMLDivElement>(null);

  /* Load recent docs */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('swaip_recent_docs');
      if (saved) setRecentDocs(JSON.parse(saved));
    } catch {}
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const saveRecent = useCallback((name: string, kind: string, size: number) => {
    setRecentDocs(prev => {
      const updated = [
        { id: Date.now().toString(), name, kind, size, date: Date.now() },
        ...prev.filter(d => d.name !== name),
      ].slice(0, 30);
      try { localStorage.setItem('swaip_recent_docs', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const clearDoc = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    if (imageUrl && imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
    setPdfUrl(null); setDocHtml(null); setDocText(null); setDocTable(null); setImageUrl(null);
    setImgZoom(1); setError(null);
  };

  /* ── Process file ── */
  const processFile = useCallback(async (file: File, overrideKind?: DocKind) => {
    setLoading(true);
    setError(null);
    clearDoc();
    const kind = overrideKind ?? detectKind(file.name, file.type);
    setDocName(file.name);
    setDocKind(kind);
    try {
      if (kind === 'pdf') {
        const url = URL.createObjectURL(file);
        setPdfUrl(url);
        saveRecent(file.name, kind, file.size);
        setViewMode('viewing');
      } else if (kind === 'image' || kind === 'scan') {
        const url = URL.createObjectURL(file);
        setImageUrl(url);
        saveRecent(file.name, kind, file.size);
        setViewMode('viewing');
      } else if (kind === 'docx') {
        const mammoth = await import('mammoth');
        const buf = await file.arrayBuffer();
        const result = await (mammoth as unknown as { convertToHtml: (o: {arrayBuffer: ArrayBuffer}) => Promise<{value: string}> }).convertToHtml({ arrayBuffer: buf });
        setDocHtml(result.value || '<p><em>Документ пуст или не удалось прочитать содержимое</em></p>');
        saveRecent(file.name, kind, file.size);
        setViewMode('viewing');
      } else if (kind === 'text') {
        const text = await file.text();
        setDocText(text);
        saveRecent(file.name, kind, file.size);
        setViewMode('viewing');
      } else if (kind === 'csv') {
        const text = await file.text();
        const rows = text.split('\n').filter(r => r.trim()).map(r => {
          const cells: string[] = [];
          let cur = '', inQ = false;
          for (const ch of r) {
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
            else cur += ch;
          }
          cells.push(cur);
          return cells;
        });
        setDocTable(rows);
        saveRecent(file.name, kind, file.size);
        setViewMode('viewing');
      } else if (kind === 'xlsx') {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
        setDocTable(data);
        saveRecent(file.name, kind, file.size);
        setViewMode('viewing');
      } else {
        setError('Формат не поддерживается.\nПоддерживается: PDF, DOCX, TXT, XLSX, CSV, JPG, PNG, WEBP и другие изображения.');
      }
    } catch (e) {
      setError('Не удалось открыть файл:\n' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [saveRecent]);

  /* ── Scan ── */
  const handleScan = useCallback(async (file: File, scanMode: 'color' | 'bw') => {
    setScanning(true);
    try {
      const { dataUrl, blob } = await applyScanFilter(file, scanMode);
      const name = `Скан_${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.jpg`;
      setDocName(name);
      setDocKind('scan');
      setImageUrl(dataUrl);
      saveRecent(name, 'scan', blob.size);
      setViewMode('viewing');
    } catch {
      setError('Не удалось обработать изображение');
    } finally {
      setScanning(false);
    }
  }, [saveRecent]);

  /* ── Print ── */
  const handlePrint = useCallback(() => {
    if (docKind === 'pdf' && pdfUrl) {
      const win = window.open(pdfUrl, '_blank');
      win?.addEventListener('load', () => win.print());
      return;
    }
    const win = window.open('', '_blank');
    if (!win) return;
    let body = '';
    if (docHtml) {
      body = `<style>body{font-family:Arial,sans-serif;margin:40px;font-size:14px;line-height:1.7;color:#111;}img{max-width:100%;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ccc;padding:6px;}</style>${docHtml}`;
    } else if (docText) {
      body = `<style>body{font-family:monospace;margin:40px;font-size:12px;white-space:pre-wrap;color:#111;}</style>${docText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}`;
    } else if (imageUrl) {
      body = `<style>body{margin:0;display:flex;justify-content:center;align-items:flex-start;padding:20px;}img{max-width:100%;height:auto;}</style><img src="${imageUrl}"/>`;
    } else if (docTable) {
      const hdrs = docTable[0] as string[];
      const rows = docTable.slice(1) as string[][];
      body = `<style>body{font-family:Arial,sans-serif;margin:20px;}table{border-collapse:collapse;width:100%;font-size:11px;}th{background:#f0f0f0;}td,th{border:1px solid #ccc;padding:5px 8px;}</style><table><thead><tr>${hdrs.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>${docName}</title></head><body>${body}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 600);
  }, [docKind, pdfUrl, docHtml, docText, imageUrl, docTable, docName]);

  /* ── Load contacts ── */
  const openSend = useCallback(async () => {
    setShowSend(true);
    setSendDone(false);
    setSendSearch('');
    if (contacts.length > 0) return;
    try {
      const token = localStorage.getItem('session_token') || '';
      const resp = await fetch('/api/contacts', { headers: { 'x-session-token': token } });
      if (resp.ok) {
        const data = await resp.json();
        setContacts((data.contacts || []).map((c: {hash:string;name?:string;info?:{name:string}}) => ({
          hash: c.hash,
          name: c.name ?? c.info?.name ?? c.hash.slice(0,8),
        })));
      }
    } catch {}
  }, [contacts.length]);

  /* ── Colors ── */
  const BG     = '#0a0a14';
  const CARD   = 'rgba(255,255,255,0.05)';
  const BORDER = 'rgba(255,255,255,0.10)';
  const ACCENT = '#4f8ef7';
  const TEXT   = '#e8eaf0';
  const SUB    = 'rgba(232,234,240,0.55)';

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(sendSearch.toLowerCase()));

  /* ── Render ── */
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: BG, display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 16px 14px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(10,10,22,0.98)', flexShrink: 0, backdropFilter: 'blur(16px)' }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={viewMode === 'home' ? onBack : () => { clearDoc(); setViewMode('home'); }}
          style={{ width: 36, height: 36, borderRadius: '50%', background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</motion.button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {viewMode === 'home' ? '📂 Документы' : docName}
          </div>
          {viewMode === 'viewing' && <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>{kindLabel(docKind)}</div>}
        </div>
        {viewMode === 'viewing' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={handlePrint}
              title="Печать"
              style={{ width: 34, height: 34, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🖨️
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={openSend}
              title="Поделиться"
              style={{ width: 34, height: 34, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              📤
            </motion.button>
            {(docKind === 'image' || docKind === 'scan') && (
              <>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setImgZoom(z => Math.min(z + 0.25, 4))}
                  style={{ width: 34, height: 34, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setImgZoom(z => Math.max(z - 0.25, 0.25))}
                  style={{ width: 34, height: 34, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>－</motion.button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <AnimatePresence mode="wait">

          {/* ── HOME ── */}
          {viewMode === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ height: '100%', overflowY: 'auto', padding: '20px 16px 100px' }}>

              {/* Scan section */}
              <div style={{ background: 'linear-gradient(135deg,#0d1b38,#162032)', borderRadius: 16, padding: '16px', marginBottom: 18, border: `1px solid rgba(79,142,247,0.25)`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(79,142,247,0.08)' }} />
                <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>📷 Сканер документов</div>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 14, lineHeight: 1.5 }}>
                  Сфотографируйте документ — приложение автоматически обработает его как скан
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <motion.button whileTap={{ scale: 0.95 }} disabled={scanning}
                    onClick={() => scanColorRef.current?.click()}
                    style={{ padding: '12px 8px', borderRadius: 12, background: ACCENT, border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: scanning ? 0.5 : 1 }}>
                    🎨 Цветной скан
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} disabled={scanning}
                    onClick={() => scanBwRef.current?.click()}
                    style={{ padding: '12px 8px', borderRadius: 12, background: 'transparent', border: `1.5px solid ${ACCENT}`, color: ACCENT, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: scanning ? 0.5 : 1 }}>
                    🖤 Ч/Б скан
                  </motion.button>
                </div>

                {/* Scanning animation */}
                <AnimatePresence>
                  {scanning && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,22,0.93)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 16 }}>
                      <div style={{ position: 'relative', width: 140, height: 90, border: `2px solid ${ACCENT}`, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.4)' }}>
                        <motion.div animate={{ y: [0, 86, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                          style={{ position: 'absolute', left: 0, right: 0, height: 3, background: `linear-gradient(90deg,transparent,${ACCENT},transparent)`, boxShadow: `0 0 8px ${ACCENT}` }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ fontSize: 28 }}>📄</div>
                        </div>
                      </div>
                      <div style={{ color: ACCENT, fontSize: 13, fontWeight: 800 }}>Сканирую…</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Open file */}
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileRef.current?.click()}
                style={{ width: '100%', padding: '16px', borderRadius: 16, background: CARD, border: `2px dashed ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
                <span style={{ fontSize: 22 }}>📂</span>
                <div style={{ textAlign: 'left' }}>
                  <div>Открыть файл</div>
                  <div style={{ fontSize: 10, color: SUB, fontWeight: 500, marginTop: 2 }}>PDF · DOCX · TXT · XLSX · CSV · JPG · PNG и другие</div>
                </div>
              </motion.button>

              {/* Formats badges */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
                {['PDF','DOCX','TXT','XLSX','CSV','JPG','PNG','WEBP'].map(fmt => (
                  <div key={fmt} style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(79,142,247,0.12)', color: ACCENT, fontSize: 10, fontWeight: 700, border: `1px solid rgba(79,142,247,0.2)` }}>{fmt}</div>
                ))}
              </div>

              {/* Recent docs */}
              {recentDocs.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    🕐 Последние документы
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recentDocs.map(doc => (
                      <div key={doc.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: CARD, border: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 24, flexShrink: 0 }}>{kindIcon(doc.kind)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                          <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>{kindLabel(doc.kind)} · {fmtSize(doc.size)} · {fmtDate(doc.date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Error */}
              {error && (
                <div style={{ marginTop: 16, padding: '14px', borderRadius: 12, background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.25)', color: '#ff6060', fontSize: 12, fontWeight: 600, whiteSpace: 'pre-line' }}>
                  ⚠️ {error}
                </div>
              )}
            </motion.div>
          )}

          {/* ── VIEWER ── */}
          {viewMode === 'viewing' && (
            <motion.div key="viewer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* PDF */}
              {docKind === 'pdf' && pdfUrl && (
                <iframe ref={iframeRef} src={pdfUrl} style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }} title={docName} />
              )}

              {/* DOCX → HTML */}
              {docKind === 'docx' && docHtml && (
                <div style={{ flex: 1, overflowY: 'auto', background: '#fff', padding: '0' }}>
                  <div ref={htmlViewRef}
                    style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px', fontFamily: 'Arial,sans-serif', fontSize: 14, lineHeight: 1.7, color: '#111' }}
                    dangerouslySetInnerHTML={{ __html: docHtml }} />
                </div>
              )}

              {/* TXT */}
              {docKind === 'text' && docText !== null && (
                <div style={{ flex: 1, overflowY: 'auto', background: '#fafafa', padding: '24px' }}>
                  <pre style={{ fontFamily: '"Courier New",monospace', fontSize: 13, lineHeight: 1.7, color: '#111', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                    {docText}
                  </pre>
                </div>
              )}

              {/* Image / Scan */}
              {(docKind === 'image' || docKind === 'scan') && imageUrl && (
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#111', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
                  <img src={imageUrl} alt={docName}
                    style={{ transform: `scale(${imgZoom})`, transformOrigin: 'top center', maxWidth: '100%', height: 'auto', borderRadius: 4, boxShadow: '0 4px 30px rgba(0,0,0,0.5)', transition: 'transform 0.2s' }} />
                </div>
              )}

              {/* Table (XLSX / CSV) */}
              {(docKind === 'xlsx' || docKind === 'csv') && docTable && (
                <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, fontFamily: 'Arial,sans-serif' }}>
                    <thead>
                      <tr>
                        {(docTable[0] as string[]).map((h, i) => (
                          <th key={i} style={{ border: '1px solid #d0d0d0', padding: '7px 10px', background: '#f5f5f5', fontWeight: 700, color: '#222', whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>{String(h)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(docTable.slice(1) as string[][]).map((row, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ border: '1px solid #e8e8e8', padding: '6px 10px', color: '#222' }}>{String(cell ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>

        {/* Loading overlay */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 20, backdropFilter: 'blur(6px)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid rgba(79,142,247,0.2)`, borderTopColor: ACCENT }} />
              <div style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}>Открываю документ…</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Send modal ── */}
      <AnimatePresence>
        {showSend && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end' }}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              style={{ width: '100%', maxHeight: '70vh', background: '#111622', borderRadius: '20px 20px 0 0', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 16px', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: TEXT }}>📤 Отправить документ</div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowSend(false)}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: CARD, border: `1px solid ${BORDER}`, color: SUB, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</motion.button>
              </div>
              <div style={{ padding: '12px 16px 8px' }}>
                <input value={sendSearch} onChange={e => setSendSearch(e.target.value)} placeholder="Поиск по контактам…"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>
                {sendDone ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 12 }}>
                    <div style={{ fontSize: 40 }}>✅</div>
                    <div style={{ color: TEXT, fontSize: 14, fontWeight: 700 }}>Ссылка на документ отправлена</div>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: SUB, fontSize: 13 }}>
                    {contacts.length === 0 ? 'Загружаю контакты…' : 'Ничего не найдено'}
                  </div>
                ) : (
                  filteredContacts.map(ct => (
                    <motion.button key={ct.hash} whileTap={{ scale: 0.97 }}
                      onClick={() => { showToast(`Отправлено ${ct.name}`); setSendDone(true); setTimeout(() => setShowSend(false), 1800); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: `1px solid ${BORDER}`, textAlign: 'left' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg,${ACCENT},#7b5bf7)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15, fontWeight: 900, color: '#fff' }}>
                        {ct.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{ct.name}</div>
                    </motion.button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,40,70,0.97)', border: `1px solid ${BORDER}`, color: TEXT, padding: '10px 20px', borderRadius: 40, fontSize: 13, fontWeight: 700, zIndex: 999, whiteSpace: 'nowrap', backdropFilter: 'blur(10px)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hidden inputs ── */}
      <input ref={fileRef} type="file"
        accept=".pdf,.docx,.doc,.txt,.md,.log,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.json,.xml,.html,.htm"
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
        style={{ display: 'none' }} />
      <input ref={scanColorRef} type="file" accept="image/*" capture="environment"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f, 'color'); e.target.value = ''; }}
        style={{ display: 'none' }} />
      <input ref={scanBwRef} type="file" accept="image/*" capture="environment"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f, 'bw'); e.target.value = ''; }}
        style={{ display: 'none' }} />
    </div>
  );
}
