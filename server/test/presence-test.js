const { io } = require("socket.io-client");
const fetch = global.fetch || require("node-fetch");

const base = process.env.BASE_URL || "http://localhost:3000";

async function registerAndLogin(name, email, sector, pwd) {
  await fetch(`${base}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, sector, password: pwd }),
  }).catch(() => {}); // ignore if exists

  const res = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pwd }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error("login failed: " + JSON.stringify(j));
  return j;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log("Starting presence/DM test");
  const a = await registerAndLogin(
    "Alice",
    "alice@example.com",
    "Sales",
    "12345"
  );
  const b = await registerAndLogin("Bob", "bob@example.com", "Sales", "12345");
  console.log(
    "Tokens:",
    a.token.slice(0, 8) + "...",
    b.token.slice(0, 8) + "..."
  );

  const socketA = io(base, { auth: { token: a.token } });
  const socketB = io(base, { auth: { token: b.token } });

  socketA.on("connect", () => console.log("Alice connected", socketA.id));
  socketB.on("connect", () => console.log("Bob connected", socketB.id));

  socketA.on("presence", (p) => console.log("Alice presence event:", p));
  socketB.on("presence", (p) => console.log("Bob presence event:", p));

  socketA.on("presence-list", (arr) =>
    console.log("Alice presence list:", arr)
  );
  socketB.on("presence-list", (arr) => console.log("Bob presence list:", arr));

  socketA.on("message", (m) => console.log("Alice saw message:", m));
  socketB.on("message", (m) => console.log("Bob saw message:", m));

  // wait for presence propagation
  await sleep(500);

  // both join Sales room
  socketA.emit("join", { room: "Sales", user: { id: a.user.id } }, (resp) =>
    console.log("Alice joined Sales:", resp)
  );
  socketB.emit("join", { room: "Sales", user: { id: b.user.id } }, (resp) =>
    console.log("Bob joined Sales:", resp)
  );

  await sleep(500);

  // Alice sends message to Sales
  socketA.emit("message", { room: "Sales", text: "Olá equipe!" }, (ack) =>
    console.log("Alice send ack:", ack)
  );

  await sleep(500);

  // DM between Alice and Bob
  const pair = [a.user.id, b.user.id].sort();
  const dmRoom = `dm:${pair.join(":")}`;
  socketA.emit("join", { room: dmRoom, user: { id: a.user.id } }, (resp) =>
    console.log("Alice joined DM:", resp.ok)
  );
  socketB.emit("join", { room: dmRoom, user: { id: b.user.id } }, (resp) =>
    console.log("Bob joined DM:", resp.ok)
  );

  await sleep(500);

  socketA.emit(
    "message",
    { room: dmRoom, text: "Mensagem privada para Bob" },
    (ack) => console.log("Alice DM ack:", ack)
  );

  await sleep(1000);

  socketA.disconnect();
  socketB.disconnect();

  console.log("Test finished");
  process.exit(0);
})();
