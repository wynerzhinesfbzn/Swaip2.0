import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InGameChat from './InGameChat';

interface Card { suit: string; value: string; id: string; }
interface AttackSlot { attack: Card; defense: Card | null; }
interface PlayerInfo { hash: string; name: string; avatar: string; }

interface GameState {
  gameId: string;
  status: 'waiting' | 'playing' | 'ended';
  phase: 'attack' | 'defend';
  deckCount: number;
  trumpSuit: string;
  trumpCard: Card;
  table: AttackSlot[];
  attackerHash: string;
  defenderHash: string;
  playerOrder: string[];
  players: Record<string, PlayerInfo>;
  winners: string[];
  durak: string | null;
  handSizes: Record<string, number>;
  myHand: Card[];
  passedHashes: string[];
}

const RED_SUITS = new Set(['♥', '♦']);
const suitColor = (s: string) => RED_SUITS.has(s) ? '#ef4444' : '#e8e8f8';

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function hashColor(hash: string) {
  const pal = ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e'];
  let n = 0;
  for (let i = 0; i < Math.min(hash.length, 8); i++) n += hash.charCodeAt(i);
  return pal[n % pal.length];
}

/* ── Карта ────────────────────────────── */
function CardView({ card, selected, onClick, small, faceDown }:
  { card?: Card; selected?: boolean; onClick?: () => void; small?: boolean; faceDown?: boolean }) {
  const w = small ? 42 : 58;
  const h = small ? 62 : 84;

  if (faceDown || !card) return (
    <div style={{ width: w, height: h, borderRadius: 8, background: 'linear-gradient(135deg,#312e81,#1e1b4b)',
      border: '1.5px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
  );

  const color = suitColor(card.suit);
  return (
    <motion.div whileTap={{ scale: 0.92 }} onClick={onClick}
      style={{ width: w, height: h, borderRadius: 8, background: '#fff', cursor: onClick ? 'pointer' : 'default',
        border: selected ? '2.5px solid #6366f1' : '1.5px solid rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', padding: '4px 5px', position: 'relative', flexShrink: 0,
        boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.4)' : '0 2px 6px rgba(0,0,0,0.3)',
        transform: selected ? 'translateY(-8px)' : 'none', transition: 'transform 0.15s' }}>
      <div style={{ fontSize: small ? 10 : 13, fontWeight: 900, color, lineHeight: 1 }}>
        {card.value}<br />{card.suit}
      </div>
      <div style={{ position: 'absolute', bottom: 4, right: 5, fontSize: small ? 10 : 13, fontWeight: 900, color,
        transform: 'rotate(180deg)', lineHeight: 1 }}>
        {card.value}<br />{card.suit}
      </div>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        fontSize: small ? 14 : 20, color, opacity: 0.25 }}>{card.suit}</div>
    </motion.div>
  );
}

/* ── Слот атаки/защиты ────────────────── */
function TableSlot({ slot, myHand, myHash, defenderHash, onDefend, selectedCard, small }:
  { slot: AttackSlot; myHand: Card[]; myHash: string; defenderHash: string;
    onDefend: (attackId: string, defId: string) => void; selectedCard: Card | null; small?: boolean }) {
  const canClick = myHash === defenderHash && !slot.defense && selectedCard;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <CardView card={slot.attack} small={small} />
      <div style={{ width: 2, height: 10, background: 'rgba(255,255,255,0.2)' }} />
      {slot.defense
        ? <CardView card={slot.defense} small={small} />
        : (
          <motion.div whileTap={{ scale: 0.9 }}
            onClick={() => { if (canClick && selectedCard) onDefend(slot.attack.id, selectedCard.id); }}
            style={{ width: small ? 42 : 58, height: small ? 62 : 84, borderRadius: 8, border: '2px dashed rgba(255,255,255,0.2)',
              cursor: canClick ? 'pointer' : 'default',
              background: canClick ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {canClick && <span style={{ fontSize: 18 }}>🎯</span>}
          </motion.div>
        )
      }
    </div>
  );
}

/* ── Главный компонент ────────────────── */
export default function DurakGame({ game, joined, myHash, onAction, onLeave, chatMessages, onChat }:
  { game: GameState; joined: string[]; myHash: string; onAction: (action: object) => void; onLeave: () => void; chatMessages?: any[]; onChat?: (t: string) => void }) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const isAttacker = game.attackerHash === myHash;
  const isDefender = game.defenderHash === myHash;
  const isHelper = !isAttacker && !isDefender && game.status === 'playing';
  const hasPassed = game.passedHashes.includes(myHash);

  const playCard = useCallback((card: Card) => {
    if (isAttacker || isHelper) {
      onAction({ type: 'game_action', action: { type: 'attack', cardId: card.id } });
      setSelectedCard(null);
    } else {
      setSelectedCard(prev => prev?.id === card.id ? null : card);
    }
  }, [isAttacker, isHelper, onAction]);

  const defend = useCallback((attackId: string, defId: string) => {
    onAction({ type: 'game_action', action: { type: 'defend', attackCardId: attackId, defenseCardId: defId } });
    setSelectedCard(null);
  }, [onAction]);

  const pass = useCallback(() => { onAction({ type: 'game_action', action: { type: 'pass' } }); }, [onAction]);
  const take = useCallback(() => { onAction({ type: 'game_action', action: { type: 'take' } }); }, [onAction]);

  const players = game.playerOrder.map(h => ({
    info: game.players[h],
    handSize: game.handSizes[h] ?? 0,
    isAttacker: h === game.attackerHash,
    isDefender: h === game.defenderHash,
    isWinner: game.winners.includes(h),
    isDurak: h === game.durak,
  }));

  const myRole = isAttacker ? '⚔️ Атака' : isDefender ? '🛡️ Защита' : '👀 Помощник';
  const C = { bg: '#09090f', surface: '#111118', card: '#18181f', border: 'rgba(200,200,255,0.1)', text: '#e8e8f8', sub: '#7070a0', accent: '#6366f1' };

  if (game.status === 'ended') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20,
        fontFamily: 'Montserrat,sans-serif' }}>
        <div style={{ fontSize: 60 }}>🃏</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', textAlign: 'center' }}>Игра окончена!</div>
        {game.durak && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>🤡</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginTop: 8 }}>
              Дурак: {game.players[game.durak]?.name || 'Неизвестный'}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
          {game.winners.map((h, i) => (
            <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)',
              borderRadius: 14, padding: '10px 16px' }}>
              <div style={{ fontSize: 20 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
              <div style={{ color: '#fff', fontWeight: 700 }}>{game.players[h]?.name}</div>
            </div>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onLeave}
          style={{ marginTop: 10, padding: '13px 32px', background: C.accent, border: 'none', borderRadius: 20,
            color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          Выйти из игры
        </motion.button>
      </div>
    );
  }

  if (game.status === 'waiting') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
        fontFamily: 'Montserrat,sans-serif', padding: 24 }}>
        <div style={{ fontSize: 50 }}>🃏</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>Дурак</div>
        <div style={{ fontSize: 14, color: C.sub }}>Ждём игроков… ({joined.length} готовы)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }}>
          {joined.map(h => (
            <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.card,
              borderRadius: 12, padding: '10px 14px', border: `1px solid ${C.border}` }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: hashColor(h),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                {initials(game.players[h]?.name || '?')}
              </div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{game.players[h]?.name}</div>
              {h === myHash && <div style={{ marginLeft: 'auto', fontSize: 11, color: C.accent }}>Это ты</div>}
            </div>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onLeave}
          style={{ padding: '11px 28px', background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 20, color: C.sub, fontSize: 14, cursor: 'pointer' }}>
          Выйти
        </motion.button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200, display: 'flex',
      flexDirection: 'column', fontFamily: 'Montserrat,sans-serif', overflow: 'hidden' }}>

      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '48px 16px 10px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🃏</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.text }}>Дурак · {myRole}</div>
            <div style={{ fontSize: 11, color: C.sub }}>Козырь: {game.trumpCard.value}{game.trumpCard.suit} · Колода: {game.deckCount}</div>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.92 }} onClick={onLeave}
          style={{ fontSize: 11, color: C.sub, background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>Выйти</motion.button>
      </div>

      {/* Игроки */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', overflowX: 'auto', background: C.surface }}>
        {players.map(({ info, handSize, isAttacker: att, isDefender: def, isWinner, isDurak: dura }) => (
          <div key={info?.hash} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 52 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: hashColor(info?.hash || ''),
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff',
              border: att ? '2px solid #ef4444' : def ? '2px solid #3b82f6' : '2px solid transparent',
              opacity: isWinner ? 0.4 : 1 }}>
              {initials(info?.name || '?')}
            </div>
            <div style={{ fontSize: 9, color: C.sub, textAlign: 'center', maxWidth: 52, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info?.name?.split(' ')[0]}</div>
            <div style={{ fontSize: 10, color: C.text }}>
              {isWinner ? '✅' : dura ? '🤡' : `🃏${handSize}`}
            </div>
            {att && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>ATK</div>}
            {def && <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700 }}>DEF</div>}
          </div>
        ))}
      </div>

      {/* Стол */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px', display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}>
        {game.table.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.sub, fontSize: 13 }}>
            {isAttacker ? '⚔️ Твой ход — выбери карту для атаки' : `Ждём атаки от ${game.players[game.attackerHash]?.name}...`}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {game.table.map((slot, i) => (
              <TableSlot key={i} slot={slot} myHand={game.myHand} myHash={myHash}
                defenderHash={game.defenderHash} onDefend={defend} selectedCard={selectedCard} />
            ))}
          </div>
        )}
      </div>

      {/* Действия */}
      {game.status === 'playing' && (
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
          {isDefender && game.table.some(s => !s.defense) && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={take}
              style={{ flex: 1, padding: '11px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 16, color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              😤 Взять карты
            </motion.button>
          )}
          {(isAttacker || isHelper) && game.table.length > 0 && !hasPassed && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={pass}
              style={{ flex: 1, padding: '11px', background: 'rgba(99,102,241,0.12)', border: `1px solid ${C.accent}44`,
                borderRadius: 16, color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ✋ Пас
            </motion.button>
          )}
          {isDefender && selectedCard && (
            <div style={{ flex: 1, padding: '11px', textAlign: 'center', color: C.sub, fontSize: 12 }}>
              Нажми на пустой слот чтобы отбиться
            </div>
          )}
        </div>
      )}

      {/* Рука */}
      <div style={{ padding: '8px 8px 32px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 8, paddingLeft: 4 }}>
          Твои карты ({game.myHand.length})
          {isDefender && selectedCard ? ' — нажми на слот защиты' : ''}
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {game.myHand.map(card => (
            <CardView key={card.id} card={card}
              selected={selectedCard?.id === card.id}
              onClick={() => playCard(card)} />
          ))}
          {game.myHand.length === 0 && (
            <div style={{ color: C.sub, fontSize: 13, padding: '20px 0' }}>🏆 Карт нет — ты победил!</div>
          )}
        </div>
      </div>
      <InGameChat messages={chatMessages || []} myHash={myHash} onSend={onChat || (() => {})} />
    </div>
  );
}
