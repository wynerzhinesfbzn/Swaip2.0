import { WebSocketServer, WebSocket } from "ws";
import { resolveSession } from "./sessionAuth.js";
import { db, accountsTable, loungeMessagesTable, loungeRoomsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "./logger.js";

import { createGame, applyAction, sanitizeForPlayer } from "./durakGame.js";
import type { DurakState, PlayerInfo as DurakPlayerInfo, Card } from "./durakGame.js";

import { createWarGame, applyWarAction, sanitizeWarForPlayer } from "./pyanitsaGame.js";
import type { WarState, PlayerInfo as WarPlayerInfo } from "./pyanitsaGame.js";

import { createMafiaGame, applyMafiaAction, sanitizeMafiaForPlayer } from "./mafiaGame.js";
import type { MafiaState, PlayerInfo as MafiaPlayerInfo } from "./mafiaGame.js";

import { createDominoGame, applyDominoAction, sanitizeDominoForPlayer } from "./dominoGame.js";
import type { DominoState, PlayerInfo as DominoPlayerInfo } from "./dominoGame.js";

import { createTDGame, applyTDAction, sanitizeTDForPlayer } from "./truthDareGame.js";
import type { TDState, PlayerInfo as TDPlayerInfo } from "./truthDareGame.js";

import { createHangmanGame, applyHangmanAction, sanitizeHangmanForPlayer } from "./hangmanGame.js";
import type { HangmanState, PlayerInfo as HangmanPlayerInfo } from "./hangmanGame.js";

import { createCrocGame, applyCrocAction, sanitizeCrocForPlayer } from "./crocodileGame.js";
import type { CrocState, PlayerInfo as CrocPlayerInfo } from "./crocodileGame.js";

import { createCheckersGame, applyCheckersAction, sanitizeCheckersForPlayer } from "./checkersGame.js";
import type { PlayerInfo as CheckersPlayerInfo } from "./checkersGame.js";

import { createChessGame, applyChessAction, sanitizeChessForPlayer } from "./chessGame.js";
import type { PlayerInfo as ChessPlayerInfo } from "./chessGame.js";

import { createBoardGame, applyBoardAction, sanitizeBoardForPlayer } from "./boardGame.js";
import type { PlayerInfo as BoardPlayerInfo } from "./boardGame.js";

const MAX_ROOM_SIZE = 20;
type GameType = 'durak' | 'pyanitsa' | 'mafia' | 'domino' | 'truthdare' | 'hangman' | 'crocodile' | 'checkers' | 'chess' | 'boardgame';
type PlayerInfo = { hash: string; name: string; avatar: string };

interface LoungeClient {
  ws: WebSocket;
  userHash: string;
  userName: string;
  userAvatar: string;
  roomId: string;
}

interface GameSession {
  gameType: GameType;
  joined: string[];
  state: any;
  deck?: Card[];
}

const rooms = new Map<string, Set<LoungeClient>>();
const gameRooms = new Map<string, GameSession>();
const voiceRooms = new Map<string, Set<string>>();

function getRoomSize(roomId: string) { return rooms.get(roomId)?.size ?? 0; }

function sendToUser(roomId: string, targetHash: string, payload: object) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const c of room) {
    if (c.userHash === targetHash && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  }
}

function broadcastAll(roomId: string, payload: object) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const c of room) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(msg);
  }
}

function getRoomMembers(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room].map(c => ({ hash: c.userHash, name: c.userName, avatar: c.userAvatar }));
}

function sanitize(gr: GameSession, playerHash: string): object {
  if (gr.gameType === 'durak')     return sanitizeForPlayer(gr.state, playerHash);
  if (gr.gameType === 'pyanitsa')  return sanitizeWarForPlayer(gr.state, playerHash);
  if (gr.gameType === 'mafia')     return sanitizeMafiaForPlayer(gr.state, playerHash);
  if (gr.gameType === 'domino')    return sanitizeDominoForPlayer(gr.state, playerHash);
  if (gr.gameType === 'truthdare') return sanitizeTDForPlayer(gr.state, playerHash);
  if (gr.gameType === 'hangman')   return sanitizeHangmanForPlayer(gr.state, playerHash);
  if (gr.gameType === 'crocodile') return sanitizeCrocForPlayer(gr.state, playerHash);
  if (gr.gameType === 'checkers')  return sanitizeCheckersForPlayer(gr.state, playerHash);
  if (gr.gameType === 'chess')     return sanitizeChessForPlayer(gr.state, playerHash);
  if (gr.gameType === 'boardgame') return sanitizeBoardForPlayer(gr.state, playerHash);
  return gr.state;
}

function broadcastGameState(roomId: string) {
  const gr = gameRooms.get(roomId);
  const room = rooms.get(roomId);
  if (!gr || !room) return;
  for (const c of room) {
    if (c.ws.readyState !== WebSocket.OPEN) continue;
    c.ws.send(JSON.stringify({
      type: 'game_state',
      game: sanitize(gr, c.userHash),
      joined: gr.joined,
      gameType: gr.gameType,
    }));
  }
}

async function resolveUserInfo(userHash: string): Promise<{ name: string; avatar: string }> {
  try {
    const rows = await db.select({ data: accountsTable.data }).from(accountsTable)
      .where(eq(accountsTable.hash, userHash)).limit(1);
    if (rows.length) {
      const d = rows[0].data as Record<string, unknown>;
      return {
        name: (d.pro_fullName || d.pro_displayName || d.scene_artistName || d.krug_displayName || 'Гость') as string,
        avatar: (d.pro_avatar || d.scene_avatar || d.krug_avatar || '') as string,
      };
    }
  } catch {}
  return { name: 'Гость', avatar: '' };
}

const MIN_PLAYERS: Record<GameType, number> = { durak: 2, pyanitsa: 2, mafia: 4, domino: 2, truthdare: 2, hangman: 2, crocodile: 3, checkers: 2, chess: 2, boardgame: 2 };
const MAX_PLAYERS: Record<GameType, number> = { durak: 6, pyanitsa: 2, mafia: 10, domino: 4, truthdare: 10, hangman: 8, crocodile: 8, checkers: 2, chess: 2, boardgame: 4 };

export function attachLoungeWs(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
      if ((ws as any)._dead) { ws.terminate(); return; }
      (ws as any)._dead = true;
      ws.ping();
    });
  }, 25_000);
  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', async (ws: WebSocket, req) => {
    const url = new URL(req.url || '', 'http://x');
    const token = url.searchParams.get('token') || '';
    const roomId = url.searchParams.get('room') || '';

    const userHash = await resolveSession(token);
    if (!userHash) { ws.close(4001, 'unauthorized'); return; }

    const roomRow = await db.select().from(loungeRoomsTable)
      .where(eq(loungeRoomsTable.roomId, roomId)).limit(1);
    if (!roomRow.length || !roomRow[0].isActive) { ws.close(4002, 'room not found'); return; }
    if (getRoomSize(roomId) >= MAX_ROOM_SIZE) { ws.close(4003, 'room full'); return; }

    const { name: userName, avatar: userAvatar } = await resolveUserInfo(userHash);

    const existingRoom = rooms.get(roomId);
    if (existingRoom) {
      for (const c of [...existingRoom]) {
        if (c.userHash === userHash && c.ws.readyState !== WebSocket.OPEN) existingRoom.delete(c);
      }
    }

    const client: LoungeClient = { ws, userHash, userName, userAvatar, roomId };
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId)!.add(client);

    ws.on('pong', () => { (ws as any)._dead = false; });

    try {
      const recentMsgs = await db.select().from(loungeMessagesTable)
        .where(eq(loungeMessagesTable.roomId, roomId))
        .orderBy(desc(loungeMessagesTable.createdAt)).limit(50);
      recentMsgs.reverse();
      const gr = gameRooms.get(roomId);
      ws.send(JSON.stringify({
        type: 'init',
        messages: recentMsgs,
        members: getRoomMembers(roomId),
        you: { hash: userHash, name: userName, avatar: userAvatar },
        room: { roomId, name: roomRow[0].name, theme: roomRow[0].theme },
        voice: [...(voiceRooms.get(roomId) ?? [])],
        ...(gr ? { game: sanitize(gr, userHash), joined: gr.joined, gameType: gr.gameType } : {}),
      }));
    } catch (e) { logger.warn({ err: e }, 'lounge init error'); }

    broadcastAll(roomId, {
      type: 'member_joined', hash: userHash, name: userName, avatar: userAvatar,
      members: getRoomMembers(roomId),
    });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }

        /* ── Text ── */
        if (msg.type === 'text' && typeof msg.content === 'string') {
          const content = msg.content.trim().slice(0, 2000);
          if (!content) return;
          const [saved] = await db.insert(loungeMessagesTable).values({
            roomId, senderHash: userHash, senderName: userName, type: 'text', content,
          }).returning();
          broadcastAll(roomId, { type: 'message', message: saved });
          await db.update(loungeRoomsTable).set({ lastActivity: new Date() })
            .where(eq(loungeRoomsTable.roomId, roomId));
          return;
        }

        /* ── Audio ── */
        if (msg.type === 'audio' && typeof msg.audioUrl === 'string') {
          const [saved] = await db.insert(loungeMessagesTable).values({
            roomId, senderHash: userHash, senderName: userName, type: 'audio',
            audioUrl: msg.audioUrl, content: '🎙️ Голосовое',
          }).returning();
          broadcastAll(roomId, { type: 'message', message: saved });
          return;
        }

        /* ── Game join ── */
        if (msg.type === 'game_join') {
          const ALL_GAMES: GameType[] = ['durak','pyanitsa','mafia','domino','truthdare','hangman','crocodile','checkers','chess','boardgame'];
          const gameType: GameType = (ALL_GAMES.includes(msg.gameType) ? msg.gameType : 'durak') as GameType;
          const gr = gameRooms.get(roomId);

          if (gr && gr.state?.status === 'playing' && gr.gameType !== gameType) {
            ws.send(JSON.stringify({ type: 'error', text: `Сейчас идёт другая игра (${gr.gameType})` })); return;
          }

          if (!gr || gr.gameType !== gameType) {
            gameRooms.set(roomId, { gameType, state: { status: 'waiting', gameType }, deck: [], joined: [userHash] });
          } else if (!gr.joined.includes(userHash)) {
            gr.joined.push(userHash);
          }

          const updatedGr = gameRooms.get(roomId)!;
          broadcastAll(roomId, { type: 'game_joined', joined: updatedGr.joined, hash: userHash, name: userName, gameType: updatedGr.gameType });
          return;
        }

        /* ── Game start ── */
        if (msg.type === 'game_start') {
          const gr = gameRooms.get(roomId);
          if (!gr) { ws.send(JSON.stringify({ type: 'error', text: 'Нет лобби игры' })); return; }

          const membersList = getRoomMembers(roomId);
          const playerInfos: PlayerInfo[] = gr.joined
            .map(h => { const m = membersList.find(m2 => m2.hash === h); return m ? { hash: h, name: m.name, avatar: m.avatar } : null; })
            .filter(Boolean) as PlayerInfo[];

          const min = MIN_PLAYERS[gr.gameType], max = MAX_PLAYERS[gr.gameType];
          if (playerInfos.length < min) {
            ws.send(JSON.stringify({ type: 'error', text: `Нужно минимум ${min} игроков` })); return;
          }
          if (playerInfos.length > max) {
            ws.send(JSON.stringify({ type: 'error', text: `Максимум ${max} игроков` })); return;
          }

          try {
            if (gr.gameType === 'durak') {
              const { state, deck } = createGame(playerInfos as DurakPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'durak', state, deck, joined: gr.joined });
            } else if (gr.gameType === 'pyanitsa') {
              const state = createWarGame(playerInfos as WarPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'pyanitsa', state, joined: gr.joined });
            } else if (gr.gameType === 'mafia') {
              const state = createMafiaGame(playerInfos as MafiaPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'mafia', state, joined: gr.joined });
            } else if (gr.gameType === 'domino') {
              const state = createDominoGame(playerInfos as DominoPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'domino', state, joined: gr.joined });
            } else if (gr.gameType === 'truthdare') {
              const state = createTDGame(playerInfos as TDPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'truthdare', state, joined: gr.joined });
            } else if (gr.gameType === 'hangman') {
              const state = createHangmanGame(playerInfos as HangmanPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'hangman', state, joined: gr.joined });
            } else if (gr.gameType === 'crocodile') {
              const state = createCrocGame(playerInfos as CrocPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'crocodile', state, joined: gr.joined });
            } else if (gr.gameType === 'checkers') {
              const state = createCheckersGame(playerInfos as CheckersPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'checkers', state, joined: gr.joined });
            } else if (gr.gameType === 'chess') {
              const state = createChessGame(playerInfos as ChessPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'chess', state, joined: gr.joined });
            } else if (gr.gameType === 'boardgame') {
              const state = createBoardGame(playerInfos as BoardPlayerInfo[]);
              gameRooms.set(roomId, { gameType: 'boardgame', state, joined: gr.joined });
            }
            broadcastGameState(roomId);
          } catch (e: any) {
            ws.send(JSON.stringify({ type: 'error', text: e?.message || 'Ошибка старта' }));
          }
          return;
        }

        /* ── Game leave ── */
        if (msg.type === 'game_leave') {
          const gr = gameRooms.get(roomId);
          if (gr) {
            gr.joined = gr.joined.filter(h => h !== userHash);
            if (gr.joined.length === 0) {
              gameRooms.delete(roomId);
              broadcastAll(roomId, { type: 'game_ended', reason: 'Все вышли' });
            } else {
              broadcastAll(roomId, { type: 'game_joined', joined: gr.joined, gameType: gr.gameType });
            }
          }
          return;
        }

        /* ── Voice: join ── */
        if (msg.type === 'voice_join') {
          if (!voiceRooms.has(roomId)) voiceRooms.set(roomId, new Set());
          voiceRooms.get(roomId)!.add(userHash);
          broadcastAll(roomId, { type: 'voice_joined', hash: userHash, voice: [...voiceRooms.get(roomId)!] });
          return;
        }

        /* ── Voice: leave ── */
        if (msg.type === 'voice_leave') {
          voiceRooms.get(roomId)?.delete(userHash);
          const remaining = [...(voiceRooms.get(roomId) ?? [])];
          broadcastAll(roomId, { type: 'voice_left', hash: userHash, voice: remaining });
          if (!remaining.length) voiceRooms.delete(roomId);
          return;
        }

        /* ── Voice: WebRTC signaling (targeted) ── */
        if (msg.type === 'voice_offer') {
          sendToUser(roomId, msg.targetHash as string, { type: 'voice_offer', fromHash: userHash, sdp: msg.sdp });
          return;
        }
        if (msg.type === 'voice_answer') {
          sendToUser(roomId, msg.targetHash as string, { type: 'voice_answer', fromHash: userHash, sdp: msg.sdp });
          return;
        }
        if (msg.type === 'voice_ice') {
          sendToUser(roomId, msg.targetHash as string, { type: 'voice_ice', fromHash: userHash, candidate: msg.candidate });
          return;
        }

        /* ── Voice: mute indicator (broadcast) ── */
        if (msg.type === 'voice_mute') {
          broadcastAll(roomId, { type: 'voice_muted', hash: userHash, muted: !!msg.muted });
          return;
        }

        /* ── Game action ── */
        if (msg.type === 'game_action') {
          const gr = gameRooms.get(roomId);
          if (!gr) { ws.send(JSON.stringify({ type: 'error', text: 'Нет активной игры' })); return; }

          /* Мафия: начать голосование */
          if (gr.gameType === 'mafia' && msg.action?.type === 'start_vote') {
            gr.state.phase = 'vote';
            gr.state.votes = {};
            broadcastGameState(roomId);
            return;
          }

          let result: { ok: boolean; error?: string } = { ok: false, error: 'Неизвестный тип игры' };

          if (gr.gameType === 'durak') {
            if (gr.state.status !== 'playing') { result = { ok: false, error: 'Игра не идёт' }; }
            else result = applyAction(gr.state, gr.deck!, userHash, msg.action);
          } else if (gr.gameType === 'pyanitsa') {
            result = applyWarAction(gr.state, userHash, msg.action);
          } else if (gr.gameType === 'mafia') {
            result = applyMafiaAction(gr.state, userHash, msg.action);
          } else if (gr.gameType === 'domino') {
            result = applyDominoAction(gr.state, userHash, msg.action);
          } else if (gr.gameType === 'truthdare') {
            result = applyTDAction(gr.state, userHash, msg.action);
          } else if (gr.gameType === 'hangman') {
            result = applyHangmanAction(gr.state, userHash, msg.action);
          } else if (gr.gameType === 'crocodile') {
            result = applyCrocAction(gr.state, userHash, msg.action);
          } else if (gr.gameType === 'checkers') {
            result = applyCheckersAction(gr.state, userHash, msg.action);
          } else if (gr.gameType === 'chess') {
            result = applyChessAction(gr.state, userHash, msg.action);
          } else if (gr.gameType === 'boardgame') {
            result = applyBoardAction(gr.state, userHash, msg.action);
          }

          if (!result.ok) {
            ws.send(JSON.stringify({ type: 'error', text: result.error })); return;
          }

          const ended = gr.state.status === 'ended';
          broadcastGameState(roomId);
          if (ended) setTimeout(() => { gameRooms.delete(roomId); }, 30_000);
          return;
        }

      } catch {}
    });

    ws.on('close', () => {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(client);
        if (room.size === 0) rooms.delete(roomId);
      }
      /* Auto-remove from voice on disconnect */
      const vr = voiceRooms.get(roomId);
      if (vr?.has(userHash)) {
        vr.delete(userHash);
        const remaining = [...vr];
        broadcastAll(roomId, { type: 'voice_left', hash: userHash, voice: remaining });
        if (!remaining.length) voiceRooms.delete(roomId);
      }
      broadcastAll(roomId, { type: 'member_left', hash: userHash, members: getRoomMembers(roomId) });
    });

    ws.on('error', () => ws.terminate());
  });

  logger.info('Lounge WebSocket attached at /api/ws/lounge');
  return wss;
}
