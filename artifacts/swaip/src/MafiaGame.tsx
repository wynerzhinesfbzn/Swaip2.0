import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InGameChat from './InGameChat';

type MafiaRole = 'mafia' | 'civilian' | 'doctor' | 'sheriff';
type MafiaPhase = 'night_mafia' | 'night_doctor' | 'night_sheriff' | 'day' | 'vote' | 'ended';

interface PlayerInfo { hash: string; name: string; avatar: string; }
interface GameState {
  gameId: string; gameType: 'mafia';
  status: 'playing' | 'ended'; phase: MafiaPhase;
  myRole: MafiaRole; mafiaTeam?: string[];
  alive: string[]; dead: { hash: string; role: MafiaRole; name: string }[];
  lastEvent: string; players: Record<string, PlayerInfo>; playerOrder: string[];
  winner: 'mafia' | 'civilians' | null; votes: Record<string, string>; myVote: string | null;
  dayCount: number; sheriffResult?: { hash: string; isMafia: boolean };
  eliminatedThisRound: string | null;
  nightActed: { mafiaActed: boolean; doctorActed: boolean; sheriffActed: boolean };
}

const ROLE_LABEL: Record<MafiaRole, string> = {
  mafia: '🔫 Мафия', civilian: '👤 Мирный', doctor: '🏥 Доктор', sheriff: '🔍 Шериф'
};
const ROLE_COLOR: Record<MafiaRole, string> = {
  mafia: '#ef4444', civilian: '#6366f1', doctor: '#22c55e', sheriff: '#f59e0b'
};
const C = { bg: '#07070f', surface: '#0f0f1c', card: '#14141f', border: 'rgba(200,200,255,0.1)',
  text: '#e8e8f8', sub: '#6060a0', accent: '#6366f1', green: '#22c55e', red: '#ef4444' };

function hashColor(h: string) {
  const p = ['#6366f1','#ec4899','#3b82f6','#14b8a6','#f59e0b','#ef4444','#8b5cf6','#22c55e'];
  let n = 0; for (let i = 0; i < 8 && i < h.length; i++) n += h.charCodeAt(i);
  return p[n % p.length];
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
}

function PlayerPill({ info, isDead, isMafia, isTarget, isMe, onSelect, roleReveal }:
  { info: PlayerInfo; isDead?: boolean; isMafia?: boolean; isTarget?: boolean;
    isMe?: boolean; onSelect?: () => void; roleReveal?: MafiaRole }) {
  return (
    <motion.div whileTap={onSelect ? { scale: 0.95 } : {}} onClick={onSelect}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: isTarget ? 'rgba(99,102,241,0.18)' : C.card,
        border: isTarget ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
        borderRadius: 14, cursor: onSelect ? 'pointer' : 'default', opacity: isDead ? 0.45 : 1 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: hashColor(info.hash),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
        filter: isDead ? 'grayscale(1)' : 'none' }}>
        {initials(info.name)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isDead ? C.sub : C.text }}>
          {info.name} {isMe && <span style={{ color: C.accent, fontSize: 10 }}>• Ты</span>}
          {isDead && <span style={{ color: C.sub, fontSize: 10 }}> • 💀</span>}
        </div>
        {isMafia && <div style={{ fontSize: 10, color: '#ef4444' }}>🔫 Соратник</div>}
        {roleReveal && <div style={{ fontSize: 10, color: ROLE_COLOR[roleReveal] }}>{ROLE_LABEL[roleReveal]}</div>}
      </div>
      {isTarget && <div style={{ fontSize: 16 }}>🎯</div>}
    </motion.div>
  );
}

export default function MafiaGame({ game, myHash, onAction, onLeave, chatMessages, onChat }:
  { game: GameState; myHash: string; onAction: (a: object) => void; onLeave: () => void; chatMessages?: any[]; onChat?: (t: string) => void }) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [showRole, setShowRole] = useState(true);
  const [voteSent, setVoteSent] = useState(false);

  const myRole = game.myRole;
  const isAlive = game.alive.includes(myHash);
  const isNight = game.phase.startsWith('night');
  const isDay = game.phase === 'day';
  const isVote = game.phase === 'vote';

  const canAct = isAlive && (
    (game.phase === 'night_mafia' && myRole === 'mafia') ||
    (game.phase === 'night_doctor' && myRole === 'doctor') ||
    (game.phase === 'night_sheriff' && myRole === 'sheriff') ||
    (game.phase === 'vote' && !game.myVote)
  );

  const myNightActed =
    (game.phase === 'night_mafia' && game.nightActed.mafiaActed && myRole === 'mafia') ||
    (game.phase === 'night_doctor' && game.nightActed.doctorActed && myRole === 'doctor') ||
    (game.phase === 'night_sheriff' && game.nightActed.sheriffActed && myRole === 'sheriff');

  const sendAction = () => {
    if (!selectedTarget) return;
    if (game.phase === 'night_mafia') onAction({ type: 'game_action', action: { type: 'mafia_kill', target: selectedTarget } });
    if (game.phase === 'night_doctor') onAction({ type: 'game_action', action: { type: 'doctor_save', target: selectedTarget } });
    if (game.phase === 'night_sheriff') onAction({ type: 'game_action', action: { type: 'sheriff_check', target: selectedTarget } });
    if (isVote) { onAction({ type: 'game_action', action: { type: 'vote', target: selectedTarget } }); setVoteSent(true); }
    setSelectedTarget(null);
  };

  const startVote = () => {
    onAction({ type: 'game_action', action: { type: 'start_vote' } });
  };

  // Targets for night actions (can't target self or mafia teammates)
  const nightTargets = game.alive.filter(h => {
    if (h === myHash) return false;
    if (game.phase === 'night_mafia' && myRole === 'mafia' && game.mafiaTeam?.includes(h)) return false;
    return true;
  });
  const voteTargets = game.alive.filter(h => h !== myHash);

  /* ── ENDED ── */
  if (game.status === 'ended') {
    const iWon = (game.winner === 'civilians' && myRole !== 'mafia') ||
                 (game.winner === 'mafia' && myRole === 'mafia');
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200, overflow: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, fontFamily: 'Montserrat,sans-serif', padding: 24 }}>
        <div style={{ fontSize: 52 }}>{iWon ? '🎉' : '😔'}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text, textAlign: 'center' }}>
          {game.winner === 'civilians' ? '🌟 Мирные победили!' : '🔫 Мафия захватила город!'}
        </div>
        <div style={{ fontSize: 13, color: C.sub }}>{game.lastEvent}</div>
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {game.playerOrder.map(h => {
            const dead = game.dead.find(d => d.hash === h);
            const role = dead?.role ?? (game.alive.includes(h) ? (game as any).roles?.[h] as MafiaRole : undefined);
            return (
              <PlayerPill key={h} info={game.players[h]} isDead={!!dead} isMe={h === myHash}
                roleReveal={dead?.role} />
            );
          })}
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onLeave}
          style={{ padding: '13px 32px', background: C.accent, border: 'none', borderRadius: 20,
            color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginTop: 10 }}>
          Выйти
        </motion.button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: isNight ? '#020208' : C.bg, zIndex: 200,
      display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat,sans-serif', overflow: 'hidden',
      transition: 'background 1s' }}>

      {/* Шапка */}
      <div style={{ background: isNight ? '#04040e' : C.surface, padding: '48px 16px 12px',
        borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22 }}>{isNight ? '🌙' : '☀️'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>
              {game.phase === 'night_mafia' ? 'НОЧЬ — Мафия действует' :
               game.phase === 'night_doctor' ? 'НОЧЬ — Доктор лечит' :
               game.phase === 'night_sheriff' ? 'НОЧЬ — Шериф проверяет' :
               game.phase === 'day' ? `☀️ ДЕНЬ ${game.dayCount}` :
               game.phase === 'vote' ? '🗳️ ГОЛОСОВАНИЕ' : ''}
            </div>
            <div style={{ fontSize: 11, color: C.sub }}>
              Живых: {game.alive.length} · День {game.dayCount}
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
            style={{ fontSize: 11, color: C.sub, background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>Выйти</motion.button>
        </div>
      </div>

      {/* Твоя роль (карточка) */}
      <AnimatePresence>
        {showRole && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            style={{ margin: '10px 14px', padding: '12px 16px', borderRadius: 16,
              background: `${ROLE_COLOR[myRole]}18`, border: `1.5px solid ${ROLE_COLOR[myRole]}55`,
              display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 24 }}>{ROLE_LABEL[myRole].split(' ')[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: ROLE_COLOR[myRole] }}>
                Твоя роль: {ROLE_LABEL[myRole].split(' ').slice(1).join(' ')}
              </div>
              {myRole === 'mafia' && game.mafiaTeam && game.mafiaTeam.length > 1 && (
                <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                  Команда: {game.mafiaTeam.filter(h => h !== myHash).map(h => game.players[h]?.name).join(', ')}
                </div>
              )}
              {game.phase === 'day' && myRole === 'sheriff' && game.sheriffResult && (
                <div style={{ fontSize: 11, fontWeight: 700, color: game.sheriffResult.isMafia ? '#ef4444' : C.green, marginTop: 2 }}>
                  🔍 Проверка: {game.players[game.sheriffResult.hash]?.name} —
                  {game.sheriffResult.isMafia ? ' МАФИЯ!' : ' Мирный'}
                </div>
              )}
            </div>
            <button onClick={() => setShowRole(false)}
              style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 16 }}>×</button>
          </motion.div>
        )}
      </AnimatePresence>
      {!showRole && (
        <button onClick={() => setShowRole(true)}
          style={{ margin: '4px 14px 0', background: 'none', border: 'none', color: C.accent,
            fontSize: 11, cursor: 'pointer', textAlign: 'left' }}>
          {ROLE_LABEL[myRole]} (показать)
        </button>
      )}

      {/* Событие ночи/дня */}
      {game.lastEvent && (
        <div style={{ margin: '8px 14px', padding: '10px 14px', borderRadius: 12,
          background: C.card, border: `1px solid ${C.border}`, fontSize: 12, color: C.text, fontStyle: 'italic' }}>
          {game.lastEvent}
        </div>
      )}

      {/* Список игроков */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Живые */}
        {(canAct ? (game.phase.startsWith('night') ? nightTargets : voteTargets) : game.alive).map(h => (
          <PlayerPill key={h} info={game.players[h]} isMe={h === myHash}
            isMafia={myRole === 'mafia' && game.mafiaTeam?.includes(h) && h !== myHash}
            isTarget={selectedTarget === h}
            onSelect={canAct && h !== myHash ? () => setSelectedTarget(prev => prev === h ? null : h) : undefined} />
        ))}
        {/* Мёртвые */}
        {game.dead.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: C.sub, marginTop: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
              Выбывшие
            </div>
            {game.dead.map(d => (
              <PlayerPill key={d.hash} info={game.players[d.hash]} isDead roleReveal={d.role} />
            ))}
          </>
        )}

        {/* Не моя ночь — жди */}
        {isNight && !canAct && isAlive && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: C.sub, fontSize: 13 }}>
            {game.phase === 'night_mafia' && myRole !== 'mafia' ? '🌙 Мафия действует в темноте…' :
             game.phase === 'night_doctor' && myRole !== 'doctor' ? '🌙 Доктор выбирает кого спасти…' :
             game.phase === 'night_sheriff' && myRole !== 'sheriff' ? '🌙 Шериф проводит расследование…' :
             '🌙 Ждём…'}
          </div>
        )}
        {!isAlive && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: C.sub, fontSize: 13 }}>
            👻 Ты выбыл — наблюдай
          </div>
        )}
        {isDay && isAlive && (
          <div style={{ textAlign: 'center', color: C.sub, fontSize: 12, padding: '10px 0' }}>
            Обсудите в чате комнаты, затем нажмите «Голосовать»
          </div>
        )}
      </div>

      {/* Действие */}
      {canAct && (
        <div style={{ padding: '10px 14px 32px', background: C.surface, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 12, color: C.sub, display: 'flex', alignItems: 'center' }}>
            {selectedTarget
              ? `Выбрано: ${game.players[selectedTarget]?.name}`
              : isVote ? 'Выбери кого исключить' : 'Выбери цель'}
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={sendAction} disabled={!selectedTarget}
            style={{ padding: '12px 22px', background: selectedTarget ? C.accent : '#333',
              border: 'none', borderRadius: 16, color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: selectedTarget ? 'pointer' : 'not-allowed' }}>
            {isVote ? '🗳️ Голосовать' : game.phase === 'night_doctor' ? '💉 Лечить' :
             game.phase === 'night_sheriff' ? '🔍 Проверить' : '🔫 Убить'}
          </motion.button>
        </div>
      )}
      {myNightActed && (
        <div style={{ padding: '12px 14px 32px', background: C.surface, borderTop: `1px solid ${C.border}`,
          textAlign: 'center', color: C.green, fontSize: 13, fontWeight: 700 }}>
          ✅ Действие выбрано — ждём остальных…
        </div>
      )}
      {isDay && isAlive && !isVote && (
        <div style={{ padding: '10px 14px 32px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => onAction({ type: 'game_action', action: { type: 'start_vote' } })}
            style={{ width: '100%', padding: '13px', background: '#f59e0b', border: 'none',
              borderRadius: 18, color: '#000', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}>
            🗳️ Начать голосование
          </motion.button>
        </div>
      )}
      {isVote && game.myVote && (
        <div style={{ padding: '12px 14px 32px', background: C.surface, borderTop: `1px solid ${C.border}`,
          textAlign: 'center', color: C.sub, fontSize: 12 }}>
          Ты проголосовал за {game.players[game.myVote]?.name} · Ждём других ({Object.keys(game.votes).length}/{game.alive.length})
        </div>
      )}
      <InGameChat messages={chatMessages || []} myHash={myHash} onSend={onChat || (() => {})} />
    </div>
  );
}
