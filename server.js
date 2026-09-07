/*
 * Lightweight room server for Splendor — Gem District.
 * Uses only Node's built-in modules, so `node server.js` is all that is needed.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const rooms = new Map();
const mime = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".ico":"image/x-icon" };

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function bodyOf(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (part) => {
      body += part;
      if (body.length > 1_000_000) request.destroy();
    });
    request.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("ข้อมูลไม่ถูกต้อง")); } });
    request.on("error", reject);
  });
}

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  do result = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(""); while (rooms.has(result));
  return result;
}

function token() { return crypto.randomBytes(24).toString("hex"); }
function publicRoom(room) { return { state: room.state, version: room.version, ready: room.ready }; }
function ownerOf(room, suppliedToken) { return Object.entries(room.tokens).find(([, value]) => value === suppliedToken)?.[0]; }

function cleanGame(game) {
  if (!game || typeof game !== "object" || !game.market || !game.bank || !game.human || !game.bot) return null;
  delete game.localPlayerId;
  delete game.roomCode;
  delete game.roomToken;
  delete game.remoteVersion;
  delete game.selected;
  delete game.waitingForNoble;
  delete game.discarding;
  game.mode = "online";
  game.roomReady = true;
  return game;
}

async function api(request, response, url) {
  const pieces = url.pathname.split("/").filter(Boolean);
  if (request.method === "POST" && url.pathname === "/api/rooms") {
    const data = await bodyOf(request);
    const game = cleanGame(data.state);
    if (!game) return send(response, 400, { error: "ไม่พบข้อมูลเกม" });
    const roomCode = code();
    const hostToken = token();
    game.human.name = String(data.name || game.human.name || "พ่อค้า").slice(0, 18);
    game.bot.name = "กำลังรอคู่แข่ง";
    game.roomReady = false;
    rooms.set(roomCode, { state: game, version: 1, ready: false, tokens: { human: hostToken }, touchedAt: Date.now() });
    return send(response, 201, { code: roomCode, token: hostToken, version: 1 });
  }
  if (pieces[0] !== "api" || pieces[1] !== "rooms" || !pieces[2]) return send(response, 404, { error: "ไม่พบห้อง" });
  const roomCode = pieces[2].toUpperCase();
  const room = rooms.get(roomCode);
  if (!room) return send(response, 404, { error: "ไม่พบห้องนี้ หรือห้องหมดอายุแล้ว" });
  room.touchedAt = Date.now();

  if (request.method === "POST" && pieces[3] === "join") {
    if (room.ready) return send(response, 409, { error: "ห้องนี้มีผู้เล่นครบแล้ว" });
    const data = await bodyOf(request);
    const guestToken = token();
    room.tokens.bot = guestToken;
    room.state.bot.name = String(data.name || "พ่อค้า").slice(0, 18);
    room.state.roomReady = true;
    room.ready = true;
    room.version += 1;
    return send(response, 200, { code: roomCode, token: guestToken, version: room.version, state: room.state });
  }

  const suppliedToken = request.method === "GET" ? url.searchParams.get("token") : (await bodyOf(request)).token;
  const player = ownerOf(room, suppliedToken);
  if (!player) return send(response, 403, { error: "ไม่มีสิทธิ์เข้าถึงห้องนี้" });

  if (request.method === "GET") return send(response, 200, publicRoom(room));
  if (request.method === "POST" && pieces[3] === "state") {
    // Read a fresh body after token extraction above by retaining it through a local parse.
    return send(response, 400, { error: "รูปแบบการส่งตาไม่ถูกต้อง" });
  }
  return send(response, 405, { error: "ไม่รองรับคำขอนี้" });
}

async function handleApi(request, response, url) {
  // State updates need their JSON parsed once, unlike a read-only room request.
  if (request.method === "POST" && /^\/api\/rooms\/[^/]+\/state$/.test(url.pathname)) {
    const roomCode = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) return send(response, 404, { error: "ไม่พบห้องนี้ หรือห้องหมดอายุแล้ว" });
    const data = await bodyOf(request);
    const player = ownerOf(room, data.token);
    if (!player) return send(response, 403, { error: "ไม่มีสิทธิ์เข้าถึงห้องนี้" });
    if (player !== data.actor || room.state.turn !== data.actor) return send(response, 409, { error: "ไม่ใช่ตาของผู้เล่นนี้", ...publicRoom(room) });
    if (Number(data.version) !== room.version) return send(response, 409, { error: "กระดานมีการเปลี่ยนแปลง", ...publicRoom(room) });
    const game = cleanGame(data.state);
    if (!game) return send(response, 400, { error: "ข้อมูลกระดานไม่ถูกต้อง" });
    // Player names and room state belong to the room, not to a browser payload.
    game.human.name = room.state.human.name;
    game.bot.name = room.state.bot.name;
    game.roomReady = true;
    room.state = game;
    room.version += 1;
    room.touchedAt = Date.now();
    return send(response, 200, { version: room.version });
  }
  return api(request, response, url);
}

function serveStatic(request, response, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); return response.end("Not found"); }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(request, response, url);
    return serveStatic(request, response, url);
  } catch (error) {
    return send(response, 500, { error: error.message || "เกิดข้อผิดพลาดในเซิร์ฟเวอร์" });
  }
});

setInterval(() => {
  const expiry = Date.now() - 1000 * 60 * 90;
  for (const [roomCode, room] of rooms) if (room.touchedAt < expiry) rooms.delete(roomCode);
}, 1000 * 60 * 10).unref();

server.listen(port, () => console.log(`Splendor is ready at http://localhost:${port}`));
