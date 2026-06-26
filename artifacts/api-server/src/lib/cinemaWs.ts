import { WebSocketServer, WebSocket } from "ws";
import { resolveSession } from "./sessionAuth.js";
import { db, accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

/* ── Types ── */
interface CinemaRoom {
  id: string;
  name: string;
  hostHash: string;
  videoUrl: string;
  videoTitle: string;
  isPlaying: boolean;
  currentTime: number;
  lastSyncAt: number;
  createdAt: number;
  messages: CinemaMsg[];
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

interface CinemaMsg {
  id: string;
  userHash: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: number;
}

interface CinemaClient {
  ws: WebSocket;
  userHash: string;
  userName: string;
  userAvatar: string;
  roomId: string;
}

/* ── In-memory state ── */
const rooms = new Map<string, CinemaRoom>();
const clients = new Map<string, Set<CinemaClient>>(); // roomId → clients

function genId(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

function broadcast(roomId: string, payload: unknown, exclude?: WebSocket) {
  const set = clients.get(roomId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const c of set) {
    if (c.ws !== exclude && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  }
}

function getMembers(roomId: string) {
  const set = clients.get(roomId);
  if (!set) return [];
  return [...set].map(c => ({ hash: c.userHash, name: c.userName, avatar: c.userAvatar }));
}

function effectiveTime(room: CinemaRoom): number {
  if (!room.isPlaying) return room.currentTime;
  return room.currentTime + (Date.now() - room.lastSyncAt) / 1000;
}

async function resolveUserInfo(hash: string) {
  try {
    const rows = await db.select({ data: accountsTable.data })
      .from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (rows[0]) {
      const d = (rows[0].data as any) || {};
      return { name: d.pro_name || d.krug_name || d.scene_artistName || 'Гость', avatar: d.pro_avatarUrl || d.krug_avatarUrl || '' };
    }
  } catch { /* ignore */ }
  return { name: 'Гость', avatar: '' };
}

/* ── Public API ── */
export function createCinemaRoom(hostHash: string, name: string, videoUrl = '', videoTitle = ''): CinemaRoom {
  const id = genId(6);
  const room: CinemaRoom = {
    id, name, hostHash, videoUrl, videoTitle,
    isPlaying: false, currentTime: 0, lastSyncAt: Date.now(),
    createdAt: Date.now(), messages: [],
  };
  rooms.set(id, room);
  /* Auto-cleanup after 6 hours of no viewers */
  scheduleCleanup(id);
  return room;
}

function scheduleCleanup(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  room.cleanupTimer = setTimeout(() => {
    const active = clients.get(roomId);
    if (!active || active.size === 0) {
      rooms.delete(roomId);
      clients.delete(roomId);
    }
  }, 6 * 60 * 60 * 1000);
}

export function listCinemaRooms() {
  return [...rooms.values()].map(r => ({
    id: r.id,
    name: r.name,
    hostHash: r.hostHash,
    videoTitle: r.videoTitle,
    videoUrl: r.videoUrl,
    isPlaying: r.isPlaying,
    memberCount: clients.get(r.id)?.size ?? 0,
    createdAt: r.createdAt,
  }));
}

export function getCinemaRoom(id: string) {
  return rooms.get(id) ?? null;
}

function parseCookieHeader(header: string, name: string): string {
  try {
    const match = ('; ' + header).match(new RegExp('; ' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  } catch { return ''; }
}

/* ── WebSocket handler ── */
export function attachCinemaWs(): WebSocketServer {
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
    /* Accept token from query param OR from httpOnly cookie (same-origin WS sends cookies) */
    const token = url.searchParams.get('token')
      || parseCookieHeader(req.headers.cookie || '', 'swaip_token')
      || '';
    const roomId = url.searchParams.get('room') || '';

    logger.info({ token: token ? token.slice(0, 8) + '…' : '(empty)', roomId }, 'cinema ws connection attempt');

    const userHash = await resolveSession(token);

    if (!userHash) {
      logger.warn({ token: token ? 'present' : 'missing', roomId }, 'cinema ws: unauthorized');
      ws.close(4001, 'unauthorized');
      return;
    }

    const room = rooms.get(roomId);
    if (!room) { ws.close(4002, 'room not found'); return; }

    const { name: userName, avatar: userAvatar } = await resolveUserInfo(userHash);

    if (!clients.has(roomId)) clients.set(roomId, new Set());
    const roomClients = clients.get(roomId)!;

    /* Remove stale connection for same user */
    for (const c of [...roomClients]) {
      if (c.userHash === userHash && c.ws.readyState !== WebSocket.OPEN) roomClients.delete(c);
    }

    const client: CinemaClient = { ws, userHash, userName, userAvatar, roomId };
    roomClients.add(client);

    ws.on('pong', () => { (ws as any)._dead = false; });

    /* Send initial state */
    ws.send(JSON.stringify({
      type: 'init',
      room: {
        id: room.id,
        name: room.name,
        hostHash: room.hostHash,
        videoUrl: room.videoUrl,
        videoTitle: room.videoTitle,
        isPlaying: room.isPlaying,
        currentTime: effectiveTime(room),
      },
      members: getMembers(roomId),
      messages: room.messages.slice(-100),
      you: { hash: userHash, name: userName, avatar: userAvatar },
    }));

    /* Notify others */
    broadcast(roomId, {
      type: 'member_joined',
      hash: userHash, name: userName, avatar: userAvatar,
      members: getMembers(roomId),
    }, ws);

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }

        /* ── Chat ── */
        if (msg.type === 'chat' && typeof msg.text === 'string') {
          const text = msg.text.trim().slice(0, 500);
          if (!text) return;
          const chatMsg: CinemaMsg = {
            id: genId(), userHash, userName, userAvatar,
            text, createdAt: Date.now(),
          };
          room.messages.push(chatMsg);
          if (room.messages.length > 200) room.messages.shift();
          broadcast(roomId, { type: 'chat', message: chatMsg });
          return;
        }

        /* ── Host-only controls ── */
        const isHost = userHash === room.hostHash;

        if (msg.type === 'set_video' && isHost) {
          const url = (typeof msg.url === 'string' ? msg.url.trim() : '');
          const title = (typeof msg.title === 'string' ? msg.title.trim() : url);
          if (!url) return;
          room.videoUrl = url;
          room.videoTitle = title || url;
          room.isPlaying = false;
          room.currentTime = 0;
          room.lastSyncAt = Date.now();
          broadcast(roomId, {
            type: 'video_changed',
            url: room.videoUrl, title: room.videoTitle,
            by: userName, byHash: userHash,
          });
          return;
        }

        if (msg.type === 'play' && isHost) {
          const t = typeof msg.currentTime === 'number' ? msg.currentTime : room.currentTime;
          room.currentTime = t;
          room.isPlaying = true;
          room.lastSyncAt = Date.now();
          broadcast(roomId, { type: 'play', currentTime: t, by: userName });
          return;
        }

        if (msg.type === 'pause' && isHost) {
          const t = typeof msg.currentTime === 'number' ? msg.currentTime : effectiveTime(room);
          room.currentTime = t;
          room.isPlaying = false;
          room.lastSyncAt = Date.now();
          broadcast(roomId, { type: 'pause', currentTime: t, by: userName });
          return;
        }

        if (msg.type === 'seek' && isHost) {
          const t = typeof msg.currentTime === 'number' ? Math.max(0, msg.currentTime) : 0;
          room.currentTime = t;
          room.lastSyncAt = Date.now();
          broadcast(roomId, { type: 'seek', currentTime: t, by: userName });
          return;
        }

        /* Guest requests sync state from host */
        if (msg.type === 'request_sync') {
          ws.send(JSON.stringify({
            type: 'sync_state',
            isPlaying: room.isPlaying,
            currentTime: effectiveTime(room),
          }));
          return;
        }

        /* Generic relay — broadcasts payload to all room members without storing.
         * Used for: karaoke queue updates, singer audio chunks, karaoke song metadata. */
        if (msg.type === 'relay') {
          broadcast(roomId, {
            type: 'relay',
            from: userHash,
            fromName: userName,
            payload: msg.payload ?? {},
          }, ws);
          return;
        }

        /* Direct relay to a specific user (for future WebRTC signaling) */
        if (msg.type === 'relay_to' && typeof msg.targetHash === 'string') {
          const set = clients.get(roomId);
          if (set) {
            for (const c of set) {
              if (c.userHash === msg.targetHash && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(JSON.stringify({
                  type: 'relay',
                  from: userHash,
                  fromName: userName,
                  payload: msg.payload ?? {},
                }));
              }
            }
          }
          return;
        }

      } catch (e) {
        logger.warn({ err: e }, 'cinema ws message error');
      }
    });

    ws.on('close', () => {
      roomClients.delete(client);
      broadcast(roomId, {
        type: 'member_left',
        hash: userHash, name: userName,
        members: getMembers(roomId),
      });
      scheduleCleanup(roomId);
    });
  });

  logger.info('Cinema WebSocket attached at /api/ws/cinema');
  return wss;
}
