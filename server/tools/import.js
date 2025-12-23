#!/usr/bin/env node
const fs = require("fs").promises;
const path = require("path");

function sanitizeText(str) {
  return String(str || "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node import.js <room> <infile>");
    process.exit(1);
  }

  const room = args[0];
  const inFile = args[1];

  const DATA_FILE = path.join(__dirname, "..", "data", "messages.json");
  const MESSAGE_TTL = 24 * 60 * 60 * 1000;

  try {
    const [dataContent, importContent] = await Promise.all([
      fs.readFile(DATA_FILE, "utf8").catch(() => "{}"),
      fs.readFile(inFile, "utf8"),
    ]);

    const data = JSON.parse(dataContent || "{}");
    const payload = JSON.parse(importContent || "[]");

    data[room] = data[room] || [];
    const existingIds = new Set(data[room].map((m) => m.id));
    const now = Date.now();

    let added = 0;
    let skippedInvalid = 0;
    for (const m of payload) {
      if (!m || typeof m !== "object") {
        skippedInvalid++;
        continue;
      }

      // basic required fields: text and user (name or email)
      const textRaw = String(m.text || "");
      const text = sanitizeText(textRaw);
      const userObj = m.user;
      if (!text || !userObj || (!userObj.name && !userObj.email)) {
        skippedInvalid++;
        continue;
      }

      const id =
        m.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (existingIds.has(id)) {
        skippedInvalid++;
        continue;
      }

      const msg = {
        id,
        user: {
          name: userObj.name || userObj.email || "Usuário",
          email: userObj.email,
          admin: !!userObj.admin,
        },
        text,
        ts: typeof m.ts === "number" ? m.ts : now,
      };

      if (now - msg.ts <= MESSAGE_TTL) {
        data[room].push(msg);
        added++;
      } else {
        skippedInvalid++;
      }
    }

    await fs.mkdir(path.join(__dirname, "..", "data"), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");

    console.log(
      `Imported ${added} messages into room '${room}', skipped ${skippedInvalid} invalid/duplicate/out-of-window items`
    );
  } catch (err) {
    console.error("Error importing messages:", err.message || err);
    process.exit(1);
  }
}

main();
