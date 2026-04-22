import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════ ГЕНЕРАТОР ЦЕН ═══════════════════════ */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };
}
export interface Candle { ts: number; open: number; high: number; low: number; close: number; vol: number; }

function buildCandles(totalDays = 180): Candle[] {
  const r = lcg(0x57419001);
  const MS = 86_400_000;
  const start = Date.now() - totalDays * MS;
  const out: Candle[] = [];
  let p = 1.0;
  for (let i = 0; i <= totalDays; i++) {
    const open = p;
    const trend = 0.0018, noise = (r() - 0.44) * 0.026;
    p = Math.max(0.97, p + p * (trend + noise));
    const wick1 = r() * 0.013, wick2 = r() * 0.011;
    const hi = Math.max(open, p) + p * wick1;
    const lo = Math.min(open, p) - p * wick2;
    out.push({ ts: start + i * MS, open, high: hi, low: lo, close: p, vol: 200000 + r() * 1200000 });
  }
  return out;
}
const ALL = buildCandles(180);

/* ═══════════════════════ ТИПЫ ═══════════════════════ */
type Currency = 'RUB'|'USD'|'EUR'|'GBP'|'CNY';
type Period   = '1D'|'1W'|'1M'|'3M'|'ALL';
type ChartMode= 'line'|'candle'|'bar';
type Screen   = 'main'|'cabinet';
const SYM: Record<Currency,string> = { RUB:'₽', USD:'$', EUR:'€', GBP:'£', CNY:'¥' };
const DAYS: Record<Period,number>   = { '1D':1, '1W':7, '1M':30, '3M':90, 'ALL':180 };
const CURRENCIES: Currency[] = ['RUB','USD','EUR','GBP','CNY'];
const PERIODS: Period[]       = ['1D','1W','1M','3M','ALL'];

interface Wallet { balanceRub:string; balanceUsd:string; balanceEur:string; balanceGbp:string; balanceCny:string; }
const BAL_KEY: Record<Currency, keyof Wallet> = {
  RUB:'balanceRub', USD:'balanceUsd', EUR:'balanceEur', GBP:'balanceGbp', CNY:'balanceCny',
};

/* ═══════════════════════ ЦВЕТА ═══════════════════════ */
const BG    = '#07070f';
const CARD  = 'rgba(255,255,255,0.05)';
const CARD2 = 'rgba(255,255,255,0.08)';
const LINE  = 'rgba(255,255,255,0.09)';
const TEXT  = '#e8e8f6';
const SUB   = 'rgba(220,220,240,0.45)';
const GREEN = '#0ecb81';
const RED   = '#f6465d';
const FF    = '"Montserrat",sans-serif';

/* ══════════════════ ЛИНЕЙНЫЙ ГРАФИК ══════════════════ */
function LineChart({ candles, accent }: { candles: Candle[]; accent: string }) {
  const W = 360, H = 180, PX = 4, PY = 10;
  if (candles.length < 2) return null;
  const closes = candles.map(c => c.close);
  const mn = Math.min(...closes), mx = Math.max(...closes);
  const range = mx - mn || 0.001;
  const sx = (i: number) => PX + (i / (closes.length - 1)) * (W - PX * 2);
  const sy = (v: number) => PY + (1 - (v - mn) / range) * (H - PY * 2);
  const pts = closes.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const area = `M ${sx(0)} ${sy(closes[0])} ` +
    closes.map((v, i) => `L ${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ') +
    ` L ${sx(closes.length-1)} ${H} L ${sx(0)} ${H} Z`;
  const isUp = closes[closes.length-1] >= closes[0];
  const col = isUp ? GREEN : RED;
  const gid = 'lg1';
  const [tip, setTip] = useState<{x:number;y:number;v:number;d:number}|null>(null);

  const handleTouch = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const cx = e.touches[0].clientX - rect.left;
    const frac = Math.max(0, Math.min(1, (cx - PX) / (W - PX*2)));
    const idx = Math.round(frac * (closes.length - 1));
    setTip({ x: sx(idx), y: sy(closes[idx]), v: closes[idx], d: candles[idx].ts });
  }, [closes, candles]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, display:'block', touchAction:'none' }}
      onTouchMove={handleTouch} onTouchEnd={() => setTip(null)}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={col} stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      {/* grid */}
      {[0.25,0.5,0.75].map(f => (
        <line key={f} x1={PX} x2={W-PX} y1={PY+(1-f)*(H-PY*2)} y2={PY+(1-f)*(H-PY*2)}
          stroke={LINE} strokeWidth="1"/>
      ))}
      <path d={area} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {tip && <>
        <line x1={tip.x} x2={tip.x} y1={PY} y2={H-PY} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3,3"/>
        <circle cx={tip.x} cy={tip.y} r="4" fill={col}/>
        <circle cx={tip.x} cy={tip.y} r="8" fill={col} fillOpacity="0.2"/>
        <rect x={Math.min(tip.x-38, W-80)} y={2} width={76} height={18} rx={5} fill="rgba(20,20,35,0.95)" stroke={col} strokeWidth="0.8"/>
        <text x={Math.min(tip.x-38, W-80)+38} y={14} fontSize="9" fill={TEXT} textAnchor="middle" fontFamily={FF} fontWeight="700">
          {SYM['RUB']}{tip.v.toFixed(4)}
        </text>
      </>}
    </svg>
  );
}

/* ══════════════════ СВЕЧНОЙ ГРАФИК ══════════════════ */
function CandleChart({ candles, mode }: { candles: Candle[]; mode: 'candle'|'bar' }) {
  const W = 360, H = 180, PX = 4, PY = 10;
  const [tipIdx, setTipIdx] = useState<number|null>(null);
  if (candles.length < 2) return null;
  const prices = candles.flatMap(c => [c.high, c.low]);
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const range = mx - mn || 0.001;
  const sy = (v: number) => PY + (1 - (v - mn) / range) * (H - PY * 2);
  const bw = Math.max(1.5, ((W - PX*2) / candles.length) - 1.2);
  const sx = (i: number) => PX + (i / (candles.length - 1)) * (W - PX * 2);

  const handleTouch = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const cx = e.touches[0].clientX - rect.left;
    const frac = Math.max(0, Math.min(1, (cx - PX) / (W - PX*2)));
    setTipIdx(Math.round(frac * (candles.length - 1)));
  }, [candles]);

  const tc = tipIdx !== null ? candles[tipIdx] : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H, display:'block', touchAction:'none' }}
      onTouchMove={handleTouch} onTouchEnd={() => setTipIdx(null)}>
      {[0.25,0.5,0.75].map(f => (
        <line key={f} x1={PX} x2={W-PX} y1={PY+(1-f)*(H-PY*2)} y2={PY+(1-f)*(H-PY*2)}
          stroke={LINE} strokeWidth="1"/>
      ))}
      {candles.map((c, i) => {
        const x = sx(i), isG = c.close >= c.open;
        const col = isG ? GREEN : RED;
        const bodyY = Math.min(sy(c.open), sy(c.close));
        const bodyH = Math.max(1.5, Math.abs(sy(c.open) - sy(c.close)));
        if (mode === 'bar') {
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={sy(c.high)} y2={sy(c.low)} stroke={col} strokeWidth="1.2"/>
              <line x1={x-bw*0.4} x2={x} y1={sy(c.open)} y2={sy(c.open)} stroke={col} strokeWidth="1.2"/>
              <line x1={x} x2={x+bw*0.4} y1={sy(c.close)} y2={sy(c.close)} stroke={col} strokeWidth="1.2"/>
            </g>
          );
        }
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={sy(c.high)} y2={sy(c.low)} stroke={col} strokeWidth="1"/>
            <rect x={x - bw/2} y={bodyY} width={bw} height={bodyH}
              fill={isG ? col : col} fillOpacity={isG ? 0.9 : 0.85}
              stroke={col} strokeWidth="0.3"/>
          </g>
        );
      })}
      {tc && <>
        <line x1={sx(tipIdx!)} x2={sx(tipIdx!)} y1={PY} y2={H-PY}
          stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,2"/>
        <rect x={2} y={2} width={130} height={22} rx={5} fill="rgba(12,12,28,0.97)" stroke={LINE} strokeWidth="0.8"/>
        <text x={8} y={16} fontSize="8.5" fill={SUB} fontFamily={FF}>
          O:{tc.open.toFixed(3)}  H:{tc.high.toFixed(3)}  L:{tc.low.toFixed(3)}  C:
          <tspan fill={tc.close>=tc.open?GREEN:RED} fontWeight="800">{tc.close.toFixed(3)}</tspan>
        </text>
      </>}
    </svg>
  );
}

/* ══════════════════ СТАКАН ══════════════════ */
function buildBook(mid: number, tick: number) {
  const r = lcg(((Date.now() / 8000 | 0) * 13 + tick) >>> 0);
  const asks = Array.from({length:10},(_,i)=>({
    price: +(mid + 0.0008*(i+1) + r()*0.001).toFixed(4),
    amount: +(200+r()*6000).toFixed(1),
  })).sort((a,b)=>a.price-b.price);
  const bids = Array.from({length:10},(_,i)=>({
    price: +(mid - 0.0008*(i+1) - r()*0.001).toFixed(4),
    amount: +(200+r()*6000).toFixed(1),
  })).sort((a,b)=>b.price-a.price);
  const maxAmt = Math.max(...asks.map(a=>a.amount),...bids.map(b=>b.amount));
  return { asks: asks.reverse(), bids, mid, maxAmt };
}

/* ══════════════════ ЛИЧНЫЙ КАБИНЕТ ══════════════════ */
function Cabinet({ wallet, accent, price, onBack, currency, setCurrency }:{
  wallet:Wallet|null; accent:string; price:number;
  onBack:()=>void; currency:Currency; setCurrency:(c:Currency)=>void;
}) {
  const totalSwp = wallet ? CURRENCIES.reduce((s,cur)=>s+parseFloat(wallet[BAL_KEY[cur]] as string||'0'),0) : 0;
  const totalVal = totalSwp * price;

  const txPlaceholder = [
    { icon:'📥', label:'Зачисление', sub:'Скоро доступно', amt:'+0 SWP', col:GREEN },
    { icon:'📤', label:'Вывод',      sub:'Скоро доступно', amt:'0 SWP',  col:TEXT  },
  ];

  return (
    <div style={{ position:'fixed', inset:0, background:BG, display:'flex', flexDirection:'column',
      fontFamily:FF, zIndex:10 }}>
      {/* Хедер */}
      <div style={{ padding:'48px 16px 14px', display:'flex', alignItems:'center', gap:12,
        borderBottom:`1px solid ${LINE}`, background:'rgba(7,7,15,0.97)',
        backdropFilter:'blur(16px)', flexShrink:0 }}>
        <motion.button whileTap={{scale:0.88}} onClick={onBack}
          style={{ width:38,height:38,borderRadius:'50%',background:CARD2,border:`1px solid ${LINE}`,
            color:TEXT,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          ←
        </motion.button>
        <div>
          <div style={{ fontSize:16,fontWeight:900,letterSpacing:'0.02em' }}>Личный кабинет</div>
          <div style={{ fontSize:10,color:SUB }}>Кошелёк SWP</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        {/* Главная карточка баланса */}
        <div style={{ margin:'16px', borderRadius:20,
          background:`linear-gradient(135deg,${accent}22,${accent}0a)`,
          border:`1.5px solid ${accent}44`, padding:'24px 20px' }}>
          <div style={{ fontSize:11,color:SUB,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8 }}>
            Общий баланс
          </div>
          <div style={{ fontSize:42,fontWeight:900,letterSpacing:'-0.02em',color:TEXT }}>
            {totalSwp.toFixed(4)}
            <span style={{ fontSize:18,color:accent,marginLeft:8 }}>SWP</span>
          </div>
          <div style={{ fontSize:14,color:SUB,marginTop:6 }}>
            ≈ {SYM[currency]}{totalVal.toFixed(4)}
            <span style={{ fontSize:11,color:GREEN,marginLeft:8,fontWeight:700 }}>+0.00%</span>
          </div>
          {/* Кнопки */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:18 }}>
            {[
              { icon:'⬇️', label:'Пополнить', col:GREEN },
              { icon:'⬆️', label:'Вывести',   col:RED   },
              { icon:'↔️', label:'Перевести', col:accent },
            ].map(({ icon, label, col }) => (
              <div key={label} style={{ position:'relative' }}>
                <button disabled style={{ width:'100%', padding:'10px 0', borderRadius:12,
                  background:`${col}18`, border:`1px solid ${col}33`,
                  color:`${col}55`, fontSize:11, fontWeight:800, cursor:'not-allowed',
                  fontFamily:FF, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <span style={{ fontSize:18 }}>{icon}</span>
                  {label}
                </button>
                <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',
                  justifyContent:'center',borderRadius:12,background:'rgba(7,7,15,0.7)',
                  fontSize:9,color:SUB,fontWeight:800,letterSpacing:'0.08em' }}>СКОРО</div>
              </div>
            ))}
          </div>
        </div>

        {/* Выбор валюты */}
        <div style={{ padding:'0 16px 12px' }}>
          <div style={{ fontSize:11,color:SUB,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10,fontWeight:700 }}>
            Валютные пулы
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {CURRENCIES.map(cur=>(
              <motion.button key={cur} whileTap={{scale:0.9}} onClick={()=>setCurrency(cur)}
                style={{ flex:1, padding:'8px 4px', borderRadius:12, textAlign:'center',
                  border:`1px solid ${currency===cur?accent:LINE}`,
                  background: currency===cur?`${accent}1a`:CARD, cursor:'pointer' }}>
                <div style={{ fontSize:15 }}>{SYM[cur]}</div>
                <div style={{ fontSize:8,color:currency===cur?accent:SUB,fontWeight:700,marginTop:1 }}>{cur}</div>
                <div style={{ fontSize:10,color:TEXT,marginTop:2,fontWeight:800 }}>
                  {wallet?parseFloat(wallet[BAL_KEY[cur]] as string||'0').toFixed(2):'0'}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Карточки пулов */}
        {CURRENCIES.map(cur=>{
          const bal = wallet ? parseFloat(wallet[BAL_KEY[cur]] as string||'0') : 0;
          const val = bal * price;
          return (
            <div key={cur} style={{ margin:'0 16px 8px', padding:'14px 16px', borderRadius:14,
              background:CARD, border:`1px solid ${currency===cur?accent+'44':LINE}`,
              display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40,height:40,borderRadius:12,
                  background: currency===cur?`${accent}22`:'rgba(255,255,255,0.06)',
                  border:`1px solid ${currency===cur?accent+'44':LINE}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:20,flexShrink:0 }}>
                  {SYM[cur]}
                </div>
                <div>
                  <div style={{ fontSize:14,fontWeight:800,color:TEXT }}>{cur}</div>
                  <div style={{ fontSize:10,color:SUB,marginTop:2 }}>
                    {cur==='RUB'?'Российский рубль':cur==='USD'?'Доллар США':
                     cur==='EUR'?'Евро':cur==='GBP'?'Фунт стерлингов':'Китайский юань'}
                  </div>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:15,fontWeight:900,color:bal>0?GREEN:TEXT }}>
                  {bal.toFixed(4)} <span style={{ fontSize:10,color:accent }}>SWP</span>
                </div>
                <div style={{ fontSize:11,color:SUB,marginTop:2 }}>≈ {SYM[cur]}{val.toFixed(4)}</div>
              </div>
            </div>
          );
        })}

        {/* История операций */}
        <div style={{ padding:'16px 16px 8px' }}>
          <div style={{ fontSize:11,color:SUB,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10,fontWeight:700 }}>
            История операций
          </div>
          <div style={{ padding:'32px 0',textAlign:'center',color:SUB,fontSize:13,
            background:CARD,borderRadius:14,border:`1px solid ${LINE}` }}>
            <div style={{ fontSize:32,marginBottom:8 }}>📋</div>
            <div style={{ fontWeight:700 }}>Операций пока нет</div>
            <div style={{ fontSize:11,marginTop:4 }}>Здесь появится история после пополнения</div>
          </div>
        </div>

        {/* Инфо */}
        <div style={{ margin:'8px 16px 24px', padding:'14px 16px', borderRadius:14,
          background:'rgba(255,200,0,0.06)', border:'1px solid rgba(255,200,0,0.2)',
          fontSize:12, color:'rgba(255,215,0,0.85)', lineHeight:1.6 }}>
          🔔 <b>Скоро:</b> Пополнение и вывод SWP. Купленные в рублях монеты хранятся
          только в рублёвом пуле — конвертация между валютами недоступна.
          Следи за обновлениями!
        </div>
      </div>
    </div>
  );
}

/* ══════════════════ ГЛАВНЫЙ КОМПОНЕНТ ══════════════════ */
interface Props { apiBase:string; userHash:string; sessionToken:string; onBack:()=>void; accent:string; }

export default function SwpExchange({ apiBase, userHash, sessionToken, onBack, accent }: Props) {
  const [screen,      setScreen]      = useState<Screen>('main');
  const [currency,    setCurrency]    = useState<Currency>('RUB');
  const [period,      setPeriod]      = useState<Period>('1M');
  const [chartMode,   setChartMode]   = useState<ChartMode>('candle');
  const [wallet,      setWallet]      = useState<Wallet|null>(null);
  const [tick,        setTick]        = useState(0);
  const [tab,         setTab]         = useState<'chart'|'book'|'about'>('chart');

  /* Живое обновление */
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),5000); return()=>clearInterval(id); },[]);

  /* Кошелёк */
  useEffect(()=>{
    if(!sessionToken||!userHash)return;
    fetch(`${apiBase}/api/exchange/wallet`,{headers:{'x-session-token':sessionToken}})
      .then(r=>r.json()).then(d=>{ if(d.ok)setWallet(d.wallet); }).catch(()=>{});
  },[apiBase,userHash,sessionToken]);

  /* Живая цена */
  const livePrice = useMemo(()=>{
    const base = ALL[ALL.length-1].close;
    const r = lcg(((Date.now()/5000|0)+tick+7)>>>0);
    return base + base*(r()-0.499)*0.005;
  },[tick]);

  /* Свечи за период */
  const candles = useMemo(()=>ALL.slice(-DAYS[period]-1),[period]);

  /* Статистика */
  const chg24 = useMemo(()=>((ALL[ALL.length-1].close-ALL[ALL.length-2].close)/ALL[ALL.length-2].close)*100,[]);
  const chg7d  = useMemo(()=>((ALL[ALL.length-1].close-ALL[ALL.length-8].close)/ALL[ALL.length-8].close)*100,[]);
  const vol24  = useMemo(()=>{ const r=lcg(((Date.now()/30000|0)+tick)>>>0); return 820000+r()*200000; },[tick]);
  const hi24   = useMemo(()=>ALL[ALL.length-1].high,[]);
  const lo24   = useMemo(()=>ALL[ALL.length-1].low,[]);

  const book = useMemo(()=>buildBook(livePrice,tick),[livePrice,tick]);
  const sym  = SYM[currency];
  const isUp = chg24>=0;

  const fmtM = (v:number) => v>=1e9?(v/1e9).toFixed(2)+'B': v>=1e6?(v/1e6).toFixed(2)+'M': v>=1e3?(v/1e3).toFixed(1)+'K':v.toFixed(0);

  if(screen==='cabinet') return (
    <Cabinet wallet={wallet} accent={accent} price={livePrice}
      onBack={()=>setScreen('main')} currency={currency} setCurrency={setCurrency}/>
  );

  return (
    <div style={{ position:'fixed',inset:0,background:BG,color:TEXT,fontFamily:FF,
      display:'flex',flexDirection:'column',zIndex:300,overflow:'hidden' }}>

      {/* ══ ХЕДЕР ══ */}
      <div style={{ padding:'44px 14px 10px',display:'flex',alignItems:'center',gap:10,
        borderBottom:`1px solid ${LINE}`,background:'rgba(7,7,15,0.98)',
        backdropFilter:'blur(20px)',flexShrink:0 }}>
        <motion.button whileTap={{scale:0.88}} onClick={onBack}
          style={{ width:36,height:36,borderRadius:'50%',background:CARD2,border:`1px solid ${LINE}`,
            color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',
            justifyContent:'center',flexShrink:0 }}>←</motion.button>
        {/* Иконка + название */}
        <div style={{ display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0 }}>
          <div style={{ width:34,height:34,borderRadius:9,flexShrink:0,
            background:`linear-gradient(135deg,${accent},#6d28d9)`,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:11,fontWeight:900,color:'#fff',letterSpacing:'-0.02em',
            boxShadow:`0 0 14px ${accent}55` }}>SWP</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14,fontWeight:900,letterSpacing:'0.02em',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
              SWP / SWAIP Token
            </div>
            <div style={{ fontSize:9,color:SUB }}>Виртуальная монета · 10 000 000 SWP</div>
          </div>
        </div>
        {/* Кабинет */}
        <motion.button whileTap={{scale:0.92}} onClick={()=>setScreen('cabinet')}
          style={{ padding:'6px 12px',borderRadius:10,background:`${accent}1a`,
            border:`1px solid ${accent}44`,color:accent,fontSize:11,fontWeight:800,
            cursor:'pointer',flexShrink:0,letterSpacing:'0.02em' }}>
          💼
        </motion.button>
      </div>

      {/* ══ ТЕЛО (СКРОЛЛ) ══ */}
      <div style={{ flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch' }}>

        {/* ── БОЛЬШАЯ ЦЕНА ── */}
        <div style={{ padding:'12px 14px 0',display:'flex',alignItems:'flex-end',gap:10,justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex',gap:8,marginBottom:4 }}>
              {CURRENCIES.map(cur=>(
                <motion.button key={cur} whileTap={{scale:0.9}} onClick={()=>setCurrency(cur)}
                  style={{ padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:700,cursor:'pointer',
                    border:`1px solid ${currency===cur?accent:LINE}`,
                    background:currency===cur?`${accent}20`:'transparent',
                    color:currency===cur?accent:SUB }}>
                  {cur}
                </motion.button>
              ))}
            </div>
            <motion.div key={tick}
              initial={{opacity:0.6,y:-2}} animate={{opacity:1,y:0}} transition={{duration:0.2}}
              style={{ fontSize:30,fontWeight:900,letterSpacing:'-0.02em',
                color:isUp?GREEN:RED,lineHeight:1 }}>
              {sym}{livePrice.toFixed(4)}
            </motion.div>
            <div style={{ display:'flex',gap:10,marginTop:4,fontSize:11 }}>
              <span style={{ color:isUp?GREEN:RED,fontWeight:700 }}>{isUp?'▲':'▼'}{Math.abs(chg24).toFixed(2)}% (24ч)</span>
              <span style={{ color:chg7d>=0?GREEN:RED,fontWeight:700 }}>{chg7d>=0?'+':''}{chg7d.toFixed(2)}% (7д)</span>
            </div>
          </div>
          {/* Мини-статы */}
          <div style={{ textAlign:'right',fontSize:10,color:SUB,lineHeight:1.8 }}>
            <div>Макс 24ч: <b style={{color:GREEN}}>{sym}{hi24.toFixed(4)}</b></div>
            <div>Мин 24ч:  <b style={{color:RED}}>{sym}{lo24.toFixed(4)}</b></div>
            <div>Объём:    <b style={{color:TEXT}}>{fmtM(vol24)}</b></div>
          </div>
        </div>

        {/* ── ВКЛАДКИ ── */}
        <div style={{ display:'flex',borderBottom:`1px solid ${LINE}`,margin:'10px 14px 0',gap:0 }}>
          {(['chart','book','about'] as const).map(t=>(
            <motion.button key={t} whileTap={{scale:0.95}} onClick={()=>setTab(t)}
              style={{ flex:1,padding:'9px 0',fontSize:11,fontWeight:700,cursor:'pointer',
                background:'none',border:'none',color:tab===t?accent:SUB,
                borderBottom:tab===t?`2px solid ${accent}`:'2px solid transparent',
                letterSpacing:'0.03em',fontFamily:FF }}>
              {t==='chart'?'📈 График':t==='book'?'📋 Стакан':'ℹ️ О монете'}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ════ ГРАФИК ════ */}
          {tab==='chart'&&(
            <motion.div key="chart" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              {/* Режим + период */}
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'10px 14px 6px' }}>
                {/* Тип */}
                <div style={{ display:'flex',gap:4 }}>
                  {(['line','candle','bar'] as ChartMode[]).map(m=>(
                    <motion.button key={m} whileTap={{scale:0.9}} onClick={()=>setChartMode(m)}
                      style={{ padding:'4px 10px',borderRadius:8,fontSize:10,fontWeight:700,cursor:'pointer',
                        border:`1px solid ${chartMode===m?accent:LINE}`,
                        background:chartMode===m?`${accent}20`:'transparent',
                        color:chartMode===m?accent:SUB }}>
                      {m==='line'?'━━':m==='candle'?'🕯':'|||'}
                    </motion.button>
                  ))}
                </div>
                {/* Период */}
                <div style={{ display:'flex',gap:3 }}>
                  {PERIODS.map(p=>(
                    <motion.button key={p} whileTap={{scale:0.9}} onClick={()=>setPeriod(p)}
                      style={{ padding:'4px 8px',borderRadius:7,fontSize:10,fontWeight:700,cursor:'pointer',
                        border:`1px solid ${period===p?accent:LINE}`,
                        background:period===p?`${accent}20`:'transparent',
                        color:period===p?accent:SUB }}>
                      {p}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Сам график */}
              <div style={{ margin:'0 14px',borderRadius:14,
                background:'rgba(255,255,255,0.03)',border:`1px solid ${LINE}`,
                padding:'10px 2px 2px',overflow:'hidden' }}>
                {chartMode==='line'
                  ? <LineChart candles={candles} accent={accent}/>
                  : <CandleChart candles={candles} mode={chartMode}/>}
                {/* Ось X — даты */}
                <div style={{ display:'flex',justifyContent:'space-between',
                  padding:'4px 10px 6px',fontSize:8,color:SUB }}>
                  {[0, Math.floor(candles.length/3), Math.floor(candles.length*2/3), candles.length-1]
                    .map(i=><span key={i}>{new Date(candles[i]?.ts||0).toLocaleDateString('ru',{day:'2-digit',month:'short'})}</span>)}
                </div>
              </div>

              {/* Y-ось цены */}
              <div style={{ display:'flex',justifyContent:'space-between',
                padding:'6px 16px 0',fontSize:10,color:SUB }}>
                <span>Откр: <b style={{color:TEXT}}>{sym}{candles[0]?.open.toFixed(4)}</b></span>
                <span>Зак: <b style={{color:isUp?GREEN:RED}}>{sym}{candles[candles.length-1]?.close.toFixed(4)}</b></span>
                <span>Δ: <b style={{color:isUp?GREEN:RED}}>{isUp?'+':''}{((candles[candles.length-1]?.close/candles[0]?.open-1)*100).toFixed(2)}%</b></span>
              </div>

              {/* Объём */}
              <div style={{ margin:'8px 14px 0', height:36, borderRadius:10,
                background:'rgba(255,255,255,0.03)', border:`1px solid ${LINE}`, overflow:'hidden',
                display:'flex', alignItems:'flex-end', padding:'2px 2px 0', gap:'1px' }}>
                {candles.filter((_,i)=>i%Math.max(1,Math.floor(candles.length/60))===0).map((c,i)=>{
                  const maxV=Math.max(...candles.map(x=>x.vol));
                  const h=Math.max(2,(c.vol/maxV)*32);
                  return <div key={i} style={{ flex:1, height:h, borderRadius:'1px 1px 0 0',
                    background:c.close>=c.open?`${GREEN}55`:`${RED}55` }}/>;
                })}
              </div>
              <div style={{ fontSize:9,color:SUB,padding:'3px 16px 0',textAlign:'right' }}>Объём</div>

              {/* Общая статистика */}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,
                margin:'10px 14px',background:LINE,borderRadius:12,overflow:'hidden' }}>
                {[
                  { l:'Капитал',    v:`${fmtM(livePrice*10000000)}`, c:TEXT  },
                  { l:'Предложение',v:'10 000 000',                  c:TEXT  },
                  { l:'В обращении',v:'10 000 000',                  c:TEXT  },
                  { l:'Старт цены', v:`${sym}1.0000`,               c:SUB   },
                  { l:'ATH',        v:`${sym}${Math.max(...ALL.map(c=>c.high)).toFixed(4)}`, c:GREEN },
                  { l:'ATL',        v:`${sym}${Math.min(...ALL.map(c=>c.low)).toFixed(4)}`,  c:RED   },
                ].map(({l,v,c})=>(
                  <div key={l} style={{ padding:'9px 10px',background:BG,textAlign:'center' }}>
                    <div style={{ fontSize:9,color:SUB,marginBottom:2,letterSpacing:'0.04em' }}>{l}</div>
                    <div style={{ fontSize:11,fontWeight:800,color:c }}>{v}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ════ СТАКАН ════ */}
          {tab==='book'&&(
            <motion.div key="book" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              style={{ padding:'10px 14px' }}>
              <div style={{ display:'grid',gridTemplateColumns:'1fr auto 1fr',
                fontSize:9,color:SUB,fontWeight:700,letterSpacing:'0.06em',
                padding:'0 4px 6px',textTransform:'uppercase' }}>
                <span>Кол-во</span><span style={{textAlign:'center'}}>Цена</span><span style={{textAlign:'right'}}>Кол-во</span>
              </div>
              {/* Asks */}
              {book.asks.map((a,i)=>{
                const pct=Math.min(100,(a.amount/book.maxAmt)*100);
                return(
                  <div key={i} style={{ display:'grid',gridTemplateColumns:'1fr auto 1fr',
                    fontSize:11,padding:'3.5px 4px',position:'relative',overflow:'hidden' }}>
                    <div style={{ position:'absolute',right:0,top:0,bottom:0,width:`${pct*0.5}%`,
                      background:`${RED}15`,borderRadius:2 }}/>
                    <span style={{ color:SUB,fontSize:10 }}>{a.amount.toFixed(1)}</span>
                    <span style={{ color:RED,fontWeight:800,textAlign:'center',
                      fontFamily:'monospace' }}>{sym}{a.price}</span>
                    <span style={{ color:SUB,textAlign:'right',fontSize:10 }}>—</span>
                  </div>
                );
              })}
              {/* Mid */}
              <div style={{ textAlign:'center',padding:'8px 0',
                borderTop:`1px solid ${LINE}`,borderBottom:`1px solid ${LINE}`,margin:'4px 0',
                fontSize:18,fontWeight:900,color:isUp?GREEN:RED,letterSpacing:'0.01em' }}>
                {sym}{livePrice.toFixed(4)}
                <span style={{ fontSize:11,marginLeft:6,color:isUp?GREEN:RED }}>{isUp?'▲':'▼'}</span>
              </div>
              {/* Bids */}
              {book.bids.map((b,i)=>{
                const pct=Math.min(100,(b.amount/book.maxAmt)*100);
                return(
                  <div key={i} style={{ display:'grid',gridTemplateColumns:'1fr auto 1fr',
                    fontSize:11,padding:'3.5px 4px',position:'relative',overflow:'hidden' }}>
                    <div style={{ position:'absolute',left:0,top:0,bottom:0,width:`${pct*0.5}%`,
                      background:`${GREEN}15`,borderRadius:2 }}/>
                    <span style={{ color:SUB,fontSize:10 }}>—</span>
                    <span style={{ color:GREEN,fontWeight:800,textAlign:'center',
                      fontFamily:'monospace' }}>{sym}{b.price}</span>
                    <span style={{ color:SUB,textAlign:'right',fontSize:10 }}>{b.amount.toFixed(1)}</span>
                  </div>
                );
              })}
              {/* Суммарный объём */}
              <div style={{ display:'flex',justifyContent:'space-between',
                marginTop:10,padding:'10px 4px 0',borderTop:`1px solid ${LINE}`,fontSize:10 }}>
                <div style={{ color:GREEN }}>
                  <div style={{ color:SUB,marginBottom:2 }}>Покупки</div>
                  <b>{fmtM(book.bids.reduce((s,b)=>s+b.amount,0))}</b>
                </div>
                <div style={{ textAlign:'right',color:RED }}>
                  <div style={{ color:SUB,marginBottom:2 }}>Продажи</div>
                  <b>{fmtM(book.asks.reduce((s,a)=>s+a.amount,0))}</b>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════ О МОНЕТЕ ════ */}
          {tab==='about'&&(
            <motion.div key="about" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              style={{ padding:'12px 14px' }}>
              <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:16 }}>
                <div style={{ width:52,height:52,borderRadius:14,flexShrink:0,
                  background:`linear-gradient(135deg,${accent},#6d28d9)`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:16,fontWeight:900,color:'#fff',
                  boxShadow:`0 0 20px ${accent}55` }}>SWP</div>
                <div>
                  <div style={{ fontSize:17,fontWeight:900 }}>SWAIP Token</div>
                  <div style={{ fontSize:10,color:SUB,marginTop:2 }}>
                    Тикер: SWP · Эмиссия: 10 000 000
                  </div>
                </div>
              </div>
              {[
                { t:'Что такое SWP?', b:'SWP — нативная монета экосистемы SWAIP. Используется для вознаграждений авторов, донатов, доступа к премиум-функциям и будущей децентрализованной экономики платформы.' },
                { t:'Фиксированный курс запуска', b:`При покупке курс 1 SWP = 1 ${SYM['RUB']} / 1 ${SYM['USD']} / 1 ${SYM['EUR']} и т.д. Каждая валюта имеет независимый пул ликвидности. Обмен между валютными пулами недоступен.` },
                { t:'Почему цена растёт?', b:'SWAIP активно развивается — растёт аудитория, появляются новые функции. Ценность монеты отражает реальный рост платформы.' },
                { t:'Безопасность', b:'Все балансы хранятся на защищённых серверах SWAIP. Операции подтверждаются через твою учётную запись с Ed25519 подписью.' },
              ].map(({t,b})=>(
                <div key={t} style={{ marginBottom:10,padding:'12px 14px',borderRadius:12,
                  background:CARD,border:`1px solid ${LINE}` }}>
                  <div style={{ fontSize:12,fontWeight:800,marginBottom:5 }}>{t}</div>
                  <div style={{ fontSize:11,color:SUB,lineHeight:1.65 }}>{b}</div>
                </div>
              ))}
              {/* Ключевые показатели */}
              <div style={{ padding:'14px',borderRadius:12,background:CARD,border:`1px solid ${LINE}` }}>
                <div style={{ fontSize:11,fontWeight:800,marginBottom:10 }}>Ключевые показатели</div>
                {[
                  ['Общий выпуск',  '10 000 000 SWP'],
                  ['Дата запуска',  new Date(ALL[0].ts).toLocaleDateString('ru',{day:'2-digit',month:'long',year:'numeric'})],
                  ['Цена запуска',  `${SYM['RUB']}1.0000 / ${SYM['USD']}1.0000`],
                  ['Текущая цена',  `${SYM['RUB']}${livePrice.toFixed(4)}`],
                  ['Рост с запуска',`+${((livePrice-1)*100).toFixed(2)}%`],
                  ['Платформа',     'SWAIP Network'],
                ].map(([l,v])=>(
                  <div key={l} style={{ display:'flex',justifyContent:'space-between',
                    padding:'7px 0',borderBottom:`1px solid ${LINE}`,fontSize:11 }}>
                    <span style={{ color:SUB }}>{l}</span>
                    <span style={{ color:TEXT,fontWeight:700 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:10,padding:'10px 14px',borderRadius:12,
                background:'rgba(255,255,255,0.03)',border:`1px solid ${LINE}`,
                fontSize:10,color:SUB,lineHeight:1.7 }}>
                Токен SWP не является ценной бумагой. Это внутренняя валюта
                мессенджера SWAIP для использования в экосистеме платформы.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Кнопка Личного кабинета ── */}
        <motion.button whileTap={{scale:0.97}} onClick={()=>setScreen('cabinet')}
          style={{ display:'flex',width:'calc(100% - 28px)',margin:'10px 14px 24px',
            padding:'14px 18px',borderRadius:14,cursor:'pointer',
            background:`linear-gradient(135deg,${accent}18,${accent}08)`,
            border:`1.5px solid ${accent}44`,alignItems:'center',
            gap:12,color:TEXT,fontFamily:FF }}>
          <div style={{ width:40,height:40,borderRadius:11,background:`${accent}22`,
            border:`1px solid ${accent}44`,display:'flex',alignItems:'center',
            justifyContent:'center',fontSize:20,flexShrink:0 }}>💼</div>
          <div style={{ flex:1,textAlign:'left' }}>
            <div style={{ fontSize:14,fontWeight:800 }}>Личный кабинет</div>
            <div style={{ fontSize:10,color:SUB,marginTop:2 }}>
              Баланс · История · Пополнение
            </div>
          </div>
          <span style={{ color:accent,fontSize:18 }}>›</span>
        </motion.button>
      </div>
    </div>
  );
}
