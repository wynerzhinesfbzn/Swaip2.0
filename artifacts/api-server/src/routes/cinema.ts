import { Router, type IRouter } from "express";
import { getSessionToken, resolveSession } from "../lib/sessionAuth.js";
import { createCinemaRoom, listCinemaRooms, getCinemaRoom } from "../lib/cinemaWs.js";

const router: IRouter = Router();

/* POST /api/cinema/rooms — create a room */
router.post("/cinema/rooms", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const name = (typeof req.body?.name === 'string' ? req.body.name.trim() : '').slice(0, 80) || 'Кино-комната';
  const videoUrl = typeof req.body?.videoUrl === 'string' ? req.body.videoUrl.trim() : '';
  const videoTitle = typeof req.body?.videoTitle === 'string' ? req.body.videoTitle.trim() : '';

  const room = createCinemaRoom(userHash, name, videoUrl, videoTitle);
  return res.json({ success: true, room: { id: room.id, name: room.name, hostHash: room.hostHash } });
});

/* GET /api/cinema/rooms — list active rooms */
router.get("/cinema/rooms", async (_req, res) => {
  return res.json({ rooms: listCinemaRooms() });
});

/* GET /api/cinema/rooms/:id — get one room */
router.get("/cinema/rooms/:id", async (req, res) => {
  const room = getCinemaRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  return res.json({ room: { id: room.id, name: room.name, hostHash: room.hostHash, videoTitle: room.videoTitle, videoUrl: room.videoUrl } });
});

export default router;
