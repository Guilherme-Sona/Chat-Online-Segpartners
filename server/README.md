Servidor de chat (Node + Socket.io)

Como usar (local):

1. Instale dependências:
   npm install

2. Inicie o servidor:
   npm start

O servidor escuta na porta 3000 por padrão. Eventos Socket.io:

- join {room, user} -> callback {ok, messages}
- message {room, user, text} -> callback {ok}

Mensagens são mantidas em memória por 24h e também persistidas em disco em `server/data/messages.json` (para protótipo).

Export / Import (REST)

- Export sala (download JSON):
  GET /rooms/:room/export

  - Optional query param: `?since=<timestamp>` to export only messages since given epoch ms
  - Example: curl -o vendas.json "http://localhost:3000/rooms/Vendas/export"

- Import sala (upload JSON array of messages):
  POST /rooms/:room/import
  - Body: JSON array of messages with shape [{id?, user:{name?, email?, admin?}, text, ts?}, ...]
  - Example: curl -H "Content-Type: application/json" -d @vendas.json http://localhost:3000/rooms/Vendas/import

Notes: import skips duplicated IDs and ignores messages older than TTL (24h).

CLI tools

- Export: `node tools/export.js <room> [outfile] [sinceTimestamp]` — example: `node tools/export.js Vendas vendas.json 0`
- Import: `node tools/import.js <room> <infile>` — example: `node tools/import.js Vendas vendas.json`

The tools operate directly on `server/data/messages.json` so stop the server before running import if you want to avoid concurrent write races.
