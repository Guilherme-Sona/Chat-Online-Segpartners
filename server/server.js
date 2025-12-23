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
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

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

// Simple users persistence (loaded from server/data/users.json)
let users = []; // { id, name, email, sector, passwordHash, admin, token }
const USERS_FILE = path.join(DATA_DIR, "users.json");

async function loadUsersFromFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(USERS_FILE, "utf8");
    users = JSON.parse(content || "[]");
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Error loading users file:", err);
  }
}

async function saveUsersToFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving users file:", err);
  }
}

// Load persisted users at startup
loadUsersFromFile().catch((err) => console.error(err));

function authMiddleware(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ ok: false, msg: "missing token" });
  const token = m[1];
  const user = users.find((u) => u.token === token);
  if (!user) return res.status(401).json({ ok: false, msg: "invalid token" });
  req.user = { ...user };
  next();
}

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

// In-memory presence maps
const onlineUsers = new Map(); // userId -> Set(socketId)
const socketToUser = new Map(); // socketId -> userId

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  // Authenticate socket by token sent in handshake (socket.io client should send { auth: { token } })
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) {
    socket.emit("error", "missing token");
    socket.disconnect(true);
    return;
  }
  const authUser = users.find((u) => u.token === token);
  if (!authUser) {
    socket.emit("error", "invalid token");
    socket.disconnect(true);
    return;
  }

  // Attach canonical user info to socket
  socket.user = {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    sector: authUser.sector,
    admin: authUser.admin,
  };

  // Mark presence
  let set = onlineUsers.get(socket.user.id);
  if (!set) {
    set = new Set();
    onlineUsers.set(socket.user.id, set);
  }
  set.add(socket.id);
  socketToUser.set(socket.id, socket.user.id);

  // Broadcast presence change and send current presence list to connecting socket
  io.emit("presence", { userId: socket.user.id, online: true });
  socket.emit("presence-list", Array.from(onlineUsers.keys()));

  socket.on("join", ({ room, user }, callback) => {
    if (!room || !user)
      return callback({ ok: false, msg: "room and user required" });

    // Prevent impersonation: ensure payload user id matches authenticated socket user
    if (user.id !== socket.user.id)
      return callback({ ok: false, msg: "invalid user" });

    // Debug: show socket auth and requested room
    console.log("join request debug", {
      socketUserSector: socket.user.sector,
      socketUserId: socket.user.id,
      requestedRoom: room,
    });

    // Determine room permission: sector rooms or DM rooms (dm:<id1>:<id2>)
    if (room.startsWith("dm:")) {
      const parts = room.split(":").slice(1);
      if (parts.length !== 2)
        return callback({ ok: false, msg: "invalid dm room" });
      if (!parts.includes(socket.user.id) && !socket.user.admin)
        return callback({ ok: false, msg: "not allowed" });
    } else {
      // sector room
      if (socket.user.sector !== room && !socket.user.admin)
        return callback({ ok: false, msg: "not allowed" });
    }

    socket.join(room);

    const msgs = rooms[room] || [];
    callback({ ok: true, messages: msgs });

    socket.to(room).emit("user-joined", {
      user: socket.user.name || socket.user.email,
      userId: socket.user.id,
    });
  });

  socket.on("message", (payload, callback) => {
    // payload: { room, text }
    if (!payload || !payload.room || !payload.text)
      return callback({ ok: false, msg: "invalid payload" });

    const room = payload.room;

    // Permission checks similar to join
    if (room.startsWith("dm:")) {
      const parts = room.split(":").slice(1);
      if (parts.length !== 2)
        return callback({ ok: false, msg: "invalid dm room" });
      if (!parts.includes(socket.user.id) && !socket.user.admin)
        return callback({ ok: false, msg: "not allowed" });
    } else {
      if (socket.user.sector !== room && !socket.user.admin)
        return callback({ ok: false, msg: "not allowed" });
    }

    // Rate limit: max 7 messages per 10s
    const now = Date.now();
    const arr = (rateMap.get(socket.id) || []).filter((t) => now - t < 10000);
    if (arr.length >= 7) return callback({ ok: false, msg: "rate limit" });
    arr.push(now);
    rateMap.set(socket.id, arr);

    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: {
        id: socket.user.id,
        name: socket.user.name,
        email: socket.user.email,
        admin: !!socket.user.admin,
      },
      text: sanitizeText(payload.text),
      ts: now,
    };

    rooms[room] = rooms[room] || [];
    rooms[room].push(msg);

    // Persist messages (async)
    saveMessagesToFile();

    io.to(room).emit("message", msg);
    callback({ ok: true });
  });

  socket.on("leave", ({ room }) => {
    socket.leave(room);
    socket.to(room).emit("user-left", {
      user: socket.user.name || socket.user.email,
      userId: socket.user.id,
    });
  });

  socket.on("disconnect", () => {
    rateMap.delete(socket.id);

    const uid = socketToUser.get(socket.id);
    if (uid) {
      const s = onlineUsers.get(uid);
      if (s) {
        s.delete(socket.id);
        if (s.size === 0) {
          onlineUsers.delete(uid);
          io.emit("presence", { userId: uid, online: false });
        }
      }
      socketToUser.delete(socket.id);
    }
  });
});

// User API: register, login, list users
app.post("/api/register", async (req, res) => {
  const { name, email, sector, password, admin } = req.body || {};
  if (!name || !email || !sector || !password)
    return res.status(400).json({ ok: false, msg: "missing fields" });
  if (users.some((u) => u.email === email))
    return res.status(400).json({ ok: false, msg: "user exists" });

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const token = uuidv4();
  const user = { id, name, email, sector, passwordHash, admin: !!admin, token };
  users.push(user);
  await saveUsersToFile();
  return res.json({
    ok: true,
    user: { id, name, email, sector, admin: !!admin },
    token,
  });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ ok: false, msg: "missing fields" });
  const user = users.find((u) => u.email === email);
  if (!user)
    return res.status(400).json({ ok: false, msg: "invalid credentials" });
  if (!bcrypt.compareSync(password, user.passwordHash))
    return res.status(400).json({ ok: false, msg: "invalid credentials" });
  user.token = uuidv4();
  await saveUsersToFile();
  return res.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      sector: user.sector,
      admin: user.admin,
    },
    token: user.token,
  });
});

app.get("/api/users", authMiddleware, (req, res) => {
  const list = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    sector: u.sector,
    admin: u.admin,
  }));
  res.json(list);
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
