#!/usr/bin/env node
const fs = require("fs").promises;
const path = require("path");

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: node export.js <room> [outfile] [sinceTimestamp]");
    process.exit(1);
  }

  const room = args[0];
  const outFile = args[1];
  const since = args[2] ? parseInt(args[2], 10) : 0;

  const DATA_FILE = path.join(__dirname, "..", "data", "messages.json");

  try {
    const content = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(content || "{}");
    const msgs = (parsed[room] || []).filter((m) => m.ts >= since);

    const json = JSON.stringify(msgs, null, 2);
    if (outFile) {
      await fs.writeFile(outFile, json, "utf8");
      console.log(
        `Exported ${msgs.length} messages from room '${room}' to ${outFile}`
      );
    } else {
      console.log(json);
    }
  } catch (err) {
    console.error("Error exporting messages:", err.message || err);
    process.exit(1);
  }
}

main();
