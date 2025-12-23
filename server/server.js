const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3000;

const fs = require("fs").promises;
const path = require("path");

// Serve frontend files from project root so /login, /home and /chat work remotely
const publicDir = path.join(__dirname, "..");
app.use(express.static(publicDir));

// Friendly routes
app.get("/", (req, res) =>
  res.sendFile(path.join(publicDir, "Tela de Login", "login.html"))
);
app.get("/login", (req, res) =>
  res.sendFile(path.join(publicDir, "Tela de Login", "login.html"))
);
app.get("/chat", (req, res) =>
  res.sendFile(path.join(publicDir, "chat", "chat.html"))
);

// Persistence + in-memory store of messages per room
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "messages.json");
const MESSAGE_TTL = 24 * 60 * 60 * 1000; // 24h
let rooms = {}; // { roomName: [ {id, user, text, ts} ] }

// Basic sanitizer (removes HTML tags, trims)
function sanitizeText(str) {
  return String(str || "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

async function loadMessagesFromFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(content || "{}");
    const now = Date.now();
    Object.keys(parsed).forEach((room) => {
      rooms[room] = (parsed[room] || []).filter(
        (m) => now - m.ts <= MESSAGE_TTL
      );
      if (rooms[room].length === 0) delete rooms[room];
    });
  } catch (err) {
    if (err.code !== "ENOENT")
      console.error("Error loading messages file:", err);
  }
}

async function saveMessagesToFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(rooms, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving messages file:", err);
  }
}

// Clean up messages older than TTL and persist
function cleanupOldMessages() {
  const now = Date.now();
  Object.keys(rooms).forEach((room) => {
    rooms[room] = (rooms[room] || []).filter((m) => now - m.ts <= MESSAGE_TTL);
    if (rooms[room].length === 0) delete rooms[room];
  });
  // Persist after cleanup
  saveMessagesToFile();
}

// Load persisted messages at startup
loadMessagesFromFile().catch((err) => console.error(err));
setInterval(cleanupOldMessages, 60 * 60 * 1000); // hourly

// Simple rate limiting per socket (timestamps)
const rateMap = new Map();

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on("join", ({ room, user }, callback) => {
    if (!room || !user)
      return callback({ ok: false, msg: "room and user required" });

    if (user.sector !== room && !user.admin)
      return callback({ ok: false, msg: "not allowed" });

    socket.join(room);

    const msgs = rooms[room] || [];
    callback({ ok: true, messages: msgs });

    socket.to(room).emit("user-joined", { user: user.name || user.email });
  });

  socket.on("message", (payload, callback) => {
    // payload: { room, user, text }
    if (!payload || !payload.room || !payload.user || !payload.text)
      return callback({ ok: false, msg: "invalid payload" });

    // permission check
    if (payload.user.sector !== payload.room && !payload.user.admin)
      return callback({ ok: false, msg: "not allowed" });

    // Rate limit: max 7 messages per 10s
    const now = Date.now();
    const arr = (rateMap.get(socket.id) || []).filter((t) => now - t < 10000);
    if (arr.length >= 7) return callback({ ok: false, msg: "rate limit" });
    arr.push(now);
    rateMap.set(socket.id, arr);

    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: {
        name: payload.user.name,
        email: payload.user.email,
        admin: !!payload.user.admin,
      },
      text: sanitizeText(payload.text),
      ts: now,
    };

    rooms[payload.room] = rooms[payload.room] || [];
    rooms[payload.room].push(msg);

    // Persist messages (async)
    saveMessagesToFile();

    io.to(payload.room).emit("message", msg);
    callback({ ok: true });
  });

  socket.on("leave", ({ room, user }) => {
    socket.leave(room);
    socket.to(room).emit("user-left", { user: user.name || user.email });
  });

  socket.on("disconnect", () => {
    rateMap.delete(socket.id);
  });
});

// Simple REST endpoint to peek messages
app.get("/rooms/:room/messages", (req, res) => {
  const r = req.params.room;
  res.json(rooms[r] || []);
});

// Export messages for a room (optionally since timestamp)
app.get("/rooms/:room/export", (req, res) => {
  const r = req.params.room;
  const since = parseInt(req.query.since || "0", 10);
  const msgs = (rooms[r] || []).filter((m) => m.ts >= since);
  const filename = `messages-${r}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json(msgs);
});

// Import messages into a room (body should be an array of messages)
app.post("/rooms/:room/import", async (req, res) => {
  const r = req.params.room;
  const payload = req.body;
  if (!Array.isArray(payload))
    return res
      .status(400)
      .json({ ok: false, msg: "expected array of messages" });

  rooms[r] = rooms[r] || [];
  const existingIds = new Set(rooms[r].map((m) => m.id));
  let added = 0;
  const now = Date.now();

  for (const m of payload) {
    if (!m || typeof m !== "object") continue;
    const id =
      m.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (existingIds.has(id)) continue; // skip duplicates

    const msg = {
      id,
      user: {
        name: m.user?.name || m.user?.email || "Usuário",
        email: m.user?.email,
        admin: !!m.user?.admin,
      },
      text: sanitizeText(m.text || ""),
      ts: typeof m.ts === "number" ? m.ts : now,
    };

    // only import messages within TTL window
    if (now - msg.ts <= MESSAGE_TTL) {
      rooms[r].push(msg);
      added++;
    }
  }

  await saveMessagesToFile();
  res.json({ ok: true, added });
});

server.listen(PORT, () => console.log(`Chat server listening on ${PORT}`));
