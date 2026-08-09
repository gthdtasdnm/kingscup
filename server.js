// KINGS CUP – Deno-Server. Ein gemeinsames Deck, reihum wird eine Karte
// gezogen, und der Server sagt allen dieselbe Regel dazu.
//
// Voreingestellt ist die trinkfreie Fassung – siehe regeln.js.

import { REGELN, neuesDeck } from "./regeln.js";
import { darfRaumOeffnen, raumVermerkt } from "./bremse.js";
import { cleanName, raumverwaltung, shuffle } from "./raum.js";
import { starte } from "./statisch.js";

const PORT = Number(Deno.env.get("PORT") ?? 8064);
const HOST = Deno.env.get("HOST") ?? "0.0.0.0";
const PUBLIC = new URL("./public/", import.meta.url);

const MAX_PLAYERS = 10;
const MIN_PLAYERS = 2;

const {
  rooms, browsing,
  createRoom, clearTimers, anwesende,
  send, raw, broadcast,
  roomList, pushState, pushRoomList,
  makePlayer, attach, dropPlayer,
} = raumverwaltung({
  maxPlayers: MAX_PLAYERS,
  minPlayers: MIN_PLAYERS,
  einstellungen: { modus: "frei" },   // frei | trink
  raumfelder: () => ({
    deck: [], reihe: [], amZug: null, karte: null, koenige: 0, gezogen: 0,
  }),
  beimBeitritt: (room) => { if (room.phase === "playing") pushRunde(room); },
  nachVerlassen: (room, player) => {
    if (room.phase === "playing" && room.amZug === player.id) weiterWennWeg(room);
  },
  beimPlatzfrei: (room, id) => {
    if (room.phase !== "playing") return;
    const i = room.reihe.indexOf(id);
    if (i >= 0) room.reihe.splice(i, 1);
    if (!room.reihe.length) return finishGame(room);
    if (room.amZug === id) weiterWennWeg(room);
    pushRunde(room);
  },
  zurueckZurLobby: (room) => backToLobby(room),
});

function startGame(room) {
  clearTimers(room);
  room.phase = "playing";
  room.rundeNr = 1;
  room.deck = shuffle(neuesDeck());
  room.reihe = anwesende(room).map((p) => p.id);
  room.amZug = room.reihe[0];
  room.karte = null;
  room.koenige = 0;
  room.gezogen = 0;
  for (const p of room.players.values()) p.ready = false;
  pushState(room);
  pushRunde(room);
  pushRoomList();
}

function naechster(room, von) {
  if (!room.reihe.length) return null;
  const i = room.reihe.indexOf(von);
  return room.reihe[(i < 0 ? 0 : i + 1) % room.reihe.length];
}

function weiterWennWeg(room) {
  const p = room.players.get(room.amZug);
  if (p?.connected) return;
  room.amZug = naechster(room, room.amZug);
  pushRunde(room);
}

function pushRunde(room) {
  if (room.phase !== "playing") return;
  const k = room.karte;
  const regel = k ? REGELN[k.r] : null;
  broadcast(room, {
    t: "runde",
    amZug: room.amZug,
    amZugName: room.players.get(room.amZug)?.name ?? "?",
    karte: k,
    titel: regel?.titel ?? null,
    text: regel ? (room.settings.modus === "trink" ? regel.trink : regel.frei) : null,
    rest: room.deck.length,
    koenige: room.koenige,
    gezogen: room.gezogen,
    modus: room.settings.modus,
    spieler: room.reihe.map((id) => ({
      id, name: room.players.get(id)?.name ?? "?", weg: !room.players.get(id)?.connected,
    })),
  });
}

function finishGame(room) {
  clearTimers(room);
  room.phase = "final";
  for (const p of room.players.values()) p.ready = false;
  broadcast(room, {
    t: "final",
    tabelle: room.reihe.map((id) => ({
      name: room.players.get(id)?.name ?? "?", wert: "dabei gewesen",
    })),
    untertitel: room.koenige >= 4
      ? "Der vierte König ist gefallen – Schluss."
      : `${room.gezogen} Karten gezogen.`,
  });
  pushState(room);
  pushRoomList();
}

function backToLobby(room) {
  clearTimers(room);
  room.phase = "lobby";
  room.rundeNr = 0;
  room.deck = [];
  room.reihe = [];
  room.karte = null;
  room.koenige = 0;
  room.gezogen = 0;
  for (const p of room.players.values()) p.ready = false;
  pushState(room);
}

function handle(ws, msg) {
  const room = ws._room;
  const player = ws._player;

  if (msg.t === "ping") return raw(ws, { t: "pong", c: msg.c, s: Date.now() });

  if (msg.t === "browse") {
    if (!ws._room) {
      browsing.add(ws);
      raw(ws, { t: "rooms", rooms: roomList() });
    }
    return;
  }

  if (msg.t === "create") {
    if (room) return;
    if (!darfRaumOeffnen(ws._ip)) {
      return raw(ws, { t: "error", msg: "Zu viele Räume in kurzer Zeit. Warte kurz." });
    }
    raumVermerkt(ws._ip);
    const r = createRoom(msg.isPublic);
    const p = makePlayer(msg.name, true);
    r.hostId = p.id;
    r.players.set(p.id, p);
    attach(ws, r, p);
    pushState(r);
    pushRoomList();
    return;
  }

  if (msg.t === "join") {
    if (room) return;
    const r = rooms.get(String(msg.code ?? "").toUpperCase().trim());
    if (!r) return raw(ws, { t: "error", msg: "Diesen Raum gibt es nicht" });
    if (msg.token) {
      const back = [...r.players.values()].find((p) => p.token === msg.token);
      if (back) {
        if (back.ws && back.ws !== ws && back.ws.readyState === WebSocket.OPEN) {
          try { back.ws.close(4001, "woanders geöffnet"); } catch { /* egal */ }
        }
        attach(ws, r, back);
        pushState(r);
        return;
      }
    }
    if (r.players.size >= MAX_PLAYERS) {
      return raw(ws, { t: "error", msg: `Der Raum ist voll (${MAX_PLAYERS} Spieler)` });
    }
    if (r.phase !== "lobby") return raw(ws, { t: "error", msg: "Die Runde läuft schon" });
    const p = makePlayer(msg.name, false);
    r.players.set(p.id, p);
    attach(ws, r, p);
    pushState(r);
    return;
  }

  if (!room || !player) return;
  room.lastActivity = Date.now();

  switch (msg.t) {
    case "name":
      player.name = cleanName(msg.name);
      pushState(room);
      pushRunde(room);
      break;

    case "ready":
      player.ready = !!msg.value;
      pushState(room);
      break;

    case "settings":
      if (player.id !== room.hostId) break;
      if (msg.modus === "frei" || msg.modus === "trink") room.settings.modus = msg.modus;
      if (typeof msg.isPublic === "boolean") room.isPublic = msg.isPublic;
      pushState(room);
      if (room.phase === "playing") pushRunde(room);
      pushRoomList();
      break;

    case "start": {
      if (player.id !== room.hostId || room.phase !== "lobby") break;
      const da = anwesende(room);
      if (da.length < MIN_PLAYERS) break;
      if (!da.every((p) => p.ready || p.id === room.hostId)) break;
      startGame(room);
      break;
    }

    case "ziehen": {
      if (room.phase !== "playing" || room.amZug !== player.id) break;
      // Liegt schon eine Karte offen, wird nicht noch eine gezogen. Sonst
      // verschluckt ein Doppeltipp oder ein hängender Knopf eine Regel, die
      // niemand gesehen hat – und beim vierten König sogar das Spielende.
      if (room.karte) break;
      if (!room.deck.length) return finishGame(room);
      room.karte = room.deck.pop();
      room.gezogen++;
      if (room.karte.r === "K") room.koenige++;
      pushRunde(room);
      break;
    }

    case "weiter": {
      if (room.phase !== "playing" || room.amZug !== player.id || !room.karte) break;
      if (room.koenige >= 4 || !room.deck.length) return finishGame(room);
      room.karte = null;
      room.amZug = naechster(room, player.id);
      pushRunde(room);
      break;
    }

    case "ende":
      if (player.id !== room.hostId || room.phase !== "playing") break;
      finishGame(room);
      break;

    case "again":
      if (player.id !== room.hostId || room.phase !== "final") break;
      backToLobby(room);
      break;

    case "leave":
      dropPlayer(ws, { immediate: true });
      break;
  }
}

starte({ port: PORT, host: HOST, publicDir: PUBLIC, titel: "KINGS CUP", handle, dropPlayer });
