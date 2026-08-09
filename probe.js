// Spielt Kings Cup mit drei Clients bis zum vierten König durch: ziehen, die
// Regel zur Karte, weitergeben, Modus umschalten, Abgang mitten im Zug,
// Endstand, Neustart.
//
// Kein Testrahmen, keine Abhaengigkeit – das Skript wirft, wenn etwas nicht
// stimmt, und schreibt sonst mit, was passiert ist. Der Server muss dafuer
// laufen:
//
//   deno task dev            (in einer zweiten Sitzung)
//   deno task probe
// Gegen die Live-Fassung statt gegen den lokalen Server:
//   WS_URL=wss://inf-zeus.de/kingscup/ws deno task probe
//
// Der erste Teil laeuft ganz ohne Server und prueft die Regeltexte. Das ist
// hier kein Beiwerk: die trinkfreie Fassung ist die Voreinstellung, und wenn
// sich in einen ihrer Texte ein Schluck einschleicht, faellt das sonst
// niemandem auf.

import { FARBEN, neuesDeck, RAENGE, REGELN } from "./regeln.js";

const PORT = Deno.env.get("PORT") ?? "8064";
const URL_WS = Deno.env.get("WS_URL") ?? `ws://127.0.0.1:${PORT}/ws`;

const muss = (bedingung, text) => { if (!bedingung) throw new Error(text); };
const karte = (k) => k.f + k.r;

// --- Erst die Regeln, ohne Server -------------------------------------------

muss(RAENGE.length === 13, "Es fehlt ein Rang: " + RAENGE.join(","));
const deck = neuesDeck();
muss(deck.length === 52, "Ein volles Blatt hat 52 Karten, hier: " + deck.length);
muss(new Set(deck.map(karte)).size === 52, "Im Deck liegt eine Karte doppelt");
muss(deck.filter((k) => k.r === "K").length === 4, "Es sind nicht vier Könige im Deck");
muss(FARBEN.length === 4, "Es sind nicht vier Farben");

// Alkoholfrei heisst alkoholfrei: kein Schluck im „frei“-Text.
const NASS = /trink|schluck|alkohol|bier|shot|prost|becher/i;
for (const r of RAENGE) {
  const g = REGELN[r];
  muss(g && g.titel && g.frei && g.trink, `Die ${r} hat keine vollständige Regel`);
  muss(g.frei !== g.trink, `Die ${r} hat in beiden Fassungen denselben Text`);
  muss(!NASS.test(g.frei), `Die trinkfreie Fassung der ${r} redet vom Trinken: „${g.frei}“`);
  muss(g.titel.length <= 24, `Der Titel der ${r} ist zu lang für die Karte: „${g.titel}“`);
}
muss(new Set(RAENGE.map((r) => REGELN[r].titel)).size === 13, "Zwei Karten haben denselben Titel");
console.log("ok  13 Ränge, 52 Karten, vier Könige, jede Regel in beiden Fassungen");
console.log("ok  in keiner trinkfreien Regel steht ein Schluck");

// --- Jetzt der Server -------------------------------------------------------

function clientAn(url, name) {
  const c = {
    name, ws: new WebSocket(url), you: null, room: null, runde: null,
    final: null, fehler: [],
  };
  c.ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === "joined") c.you = m.you;
    if (m.t === "room") c.room = m;
    if (m.t === "runde") { c.runde = m; c.final = null; }
    if (m.t === "final") c.final = m;
    if (m.t === "error") c.fehler.push(m.msg);
  };
  c.send = (m) => c.ws.send(JSON.stringify(m));
  c.offen = new Promise((res) => { c.ws.onopen = res; });
  return c;
}

const client = (name) => clientAn(URL_WS, name);

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function bis(bedingung, was, ms = 5000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (bedingung()) return;
    await warte(20);
  }
  throw new Error("Zeitüberschreitung: " + was);
}

const A = client("Anna"), B = client("Ben"), C = client("Cem");
const alleC = [A, B, C];
await Promise.all(alleC.map((c) => c.offen));

// Nicht oeffentlich: die Probe laeuft auch gegen live, und dort soll kein
// Geisterraum in der Liste stehen.
A.send({ t: "create", name: "Anna", isPublic: false });
await bis(() => A.room, "Raum angelegt");
console.log("Raum:", A.room.code);

for (const c of [B, C]) c.send({ t: "join", code: A.room.code, name: c.name });
await bis(() => A.room.players.length === 3, "drei Spieler");

A.send({ t: "start" });
await warte(150);
muss(A.room.phase === "lobby", "Start ging ohne Bereit durch");
console.log("ok  Start blockiert, solange nicht alle bereit sind");

for (const c of [B, C]) c.send({ t: "ready", value: true });
await bis(() => A.room.players.every((p) => p.ready || p.host), "alle bereit");
A.send({ t: "start" });
await bis(() => A.runde?.spieler?.length === 3, "Partie läuft");

muss(A.runde.modus === "frei", "Voreingestellt müsste die trinkfreie Fassung sein");
muss(A.runde.rest === 52 && A.runde.gezogen === 0, "Das Deck ist nicht voll");
muss(A.runde.karte === null, "Vor dem ersten Zug liegt schon eine Karte offen");
console.log("ok  volles Deck, keine Karte offen, trinkfreie Fassung voreingestellt");

const amZug = () => alleC.find((c) => c.you === A.runde.amZug);

// --- Wer nicht dran ist, zieht nicht ----------------------------------------

{
  const fremd = alleC.find((c) => c !== amZug());
  fremd.send({ t: "ziehen" });
  amZug().send({ t: "weiter" });     // ohne Karte
  await warte(200);
  muss(A.runde.karte === null && A.runde.rest === 52, "Wer nicht dran ist, konnte ziehen");
  muss(A.runde.gezogen === 0, "Weitergeben ohne Karte hat etwas verändert");
  console.log("ok  wer nicht dran ist, zieht nicht – und ohne Karte gibt es kein Weiter");
}

// --- Ziehen, Regel lesen, weitergeben ---------------------------------------

let d = amZug();
d.send({ t: "ziehen" });
await bis(() => A.runde.karte, "erste Karte");
const erste = A.runde.karte;
muss(A.runde.rest === 51 && A.runde.gezogen === 1, "Der Rest stimmt nach der ersten Karte nicht");
muss(A.runde.titel === REGELN[erste.r].titel, "Der Titel passt nicht zur Karte");
muss(A.runde.text === REGELN[erste.r].frei, "Der Text ist nicht die trinkfreie Fassung");
for (const c of alleC) muss(c.runde.karte, `${c.name} sieht die gezogene Karte nicht`);
console.log(`ok  ${d.name} zieht ${karte(erste)} – „${A.runde.titel}“, alle sehen dieselbe Karte`);

// Doppelt tippen darf keine zweite Karte verbrennen.
d.send({ t: "ziehen" });
await warte(200);
muss(A.runde.rest === 51 && karte(A.runde.karte) === karte(erste),
  "Ein zweiter Druck auf Ziehen hat eine Karte verschluckt");
console.log("ok  zweimal ziehen zieht nicht zweimal");

// Modus umlegen: derselbe Kartentext, andere Fassung.
A.send({ t: "settings", modus: "trink" });
await bis(() => A.runde.modus === "trink", "Trinkmodus an");
muss(A.runde.text === REGELN[erste.r].trink, "Der Text wechselt nicht mit dem Modus");
B.send({ t: "settings", modus: "frei" });
await warte(200);
muss(A.runde.modus === "trink", "Ein Gast konnte den Modus umlegen");
A.send({ t: "settings", modus: "frei" });
await bis(() => A.runde.modus === "frei", "wieder trinkfrei");
console.log("ok  nur der Host legt den Modus um, und der Text wechselt mit");

const vorherId = d.you;
B.send({ t: "weiter" });
await warte(150);
muss(A.runde.amZug === vorherId, "Ein Gast konnte weitergeben");
d.send({ t: "weiter" });
await bis(() => A.runde.amZug !== vorherId, "weitergegeben");
muss(A.runde.karte === null, "Nach dem Weitergeben liegt die alte Karte noch da");
console.log("ok  nur wer dran ist, gibt weiter – danach liegt keine Karte mehr offen");

// --- Bis zum vierten König --------------------------------------------------

const gesehen = new Set([karte(erste)]);
let koenige = erste.r === "K" ? 1 : 0;

for (let zug = 0; zug < 60 && !A.final; zug++) {
  const dran = amZug();
  const restVor = A.runde.rest;
  dran.send({ t: "ziehen" });
  await bis(() => A.runde.karte || A.final, "gezogen");
  if (A.final) break;

  const k = A.runde.karte;
  muss(!gesehen.has(karte(k)), "Dieselbe Karte kam zweimal: " + karte(k));
  gesehen.add(karte(k));
  muss(A.runde.rest === restVor - 1, "Der Rest wurde nicht heruntergezählt");
  muss(A.runde.gezogen === gesehen.size, "Der Zähler passt nicht zu den gezogenen Karten");
  muss(A.runde.titel === REGELN[k.r].titel && A.runde.text === REGELN[k.r].frei,
    "Regeltext und Karte passen nicht zusammen: " + karte(k));
  if (k.r === "K") koenige++;
  muss(A.runde.koenige === koenige, `Der Server zählt ${A.runde.koenige} Könige, die Probe ${koenige}`);

  const wer = dran.you;
  dran.send({ t: "weiter" });
  await bis(() => A.runde.amZug !== wer || A.final, "weiter");
}

muss(A.final, "Nach 60 Zügen ist die Partie nicht zu Ende");
muss(koenige === 4, `Die Partie endete bei ${koenige} Königen`);
muss(/vierte König/.test(A.final.untertitel), "Falscher Untertitel: " + A.final.untertitel);
muss(A.final.tabelle.length === 3, "Im Endstand fehlt jemand");
console.log(`ok  ${gesehen.size} Karten gezogen, beim vierten König ist Schluss: ` +
  A.final.untertitel);

A.send({ t: "again" });
await bis(() => A.room.phase === "lobby", "zurück im Warteraum");
console.log("ok  Nochmal setzt alles zurück");

// --- Abgang mitten im Zug ---------------------------------------------------

for (const c of [B, C]) c.send({ t: "ready", value: true });
await bis(() => A.room.players.every((p) => p.ready || p.host), "wieder alle bereit");
A.runde = null;
A.send({ t: "start" });
await bis(() => A.runde?.spieler?.length === 3, "neue Partie");
muss(A.runde.rest === 52 && A.runde.koenige === 0, "Das Deck wurde nicht neu gemischt");

const geht = amZug();
const bleibt = alleC.filter((c) => c !== geht);
geht.send({ t: "leave" });
await bis(() => bleibt[0].runde.spieler.length === 2, "einer ist raus");
muss(bleibt[0].runde.amZug !== geht.you, `Der Zug hängt an ${geht.name} – weg, aber noch dran`);
console.log(`ok  ${geht.name} geht mitten im eigenen Zug – die Runde läuft weiter`);

// --- Die Bedenkzeit --------------------------------------------------------

// Wer am Zug ist und nichts tut, hielt die Runde frueher an. Jetzt laeuft eine
// Frist. Neunzig Sekunden mag hier niemand abwarten, deshalb startet die Probe
// dafuer einen eigenen Server mit kurzer Frist auf einem freien Port. Laeuft
// die Probe gegen live (WS_URL gesetzt), faellt der Teil aus - dort steht die
// Frist auf ihrem echten Wert.

if (Deno.env.get("WS_URL")) {
  console.log("    (Bedenkzeit nicht geprueft: gegen live laesst sie sich nicht kuerzen)");
} else {
  const kurz = 1500;
  const testPort = "9" + PORT.slice(1);
  const dienst = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "--allow-read", "--allow-env", "--allow-sys", "server.js"],
    env: { ...Deno.env.toObject(), PORT: testPort, ZUG_MS: String(kurz) },
    stdout: "null",
    stderr: "null",
  }).spawn();

  try {
    await warte(900);
    const url = `ws://127.0.0.1:${testPort}/ws`;
    const P = clientAn(url, "Pia"), Q = clientAn(url, "Quin");
    await Promise.all([P.offen, Q.offen]);

    P.send({ t: "create", name: "Pia", isPublic: false });
    await bis(() => P.room, "Testraum angelegt");
    Q.send({ t: "join", code: P.room.code, name: "Quin" });
    await bis(() => P.room.players.length === 2, "zwei im Testraum");
    Q.send({ t: "ready", value: true });
    await bis(() => P.room.players.every((p) => p.ready || p.host), "bereit im Testraum");
    P.send({ t: "start" });
    await bis(() => P.runde && !P.final, "Testpartie läuft");

    const frist = P.runde.frist;
    muss(frist > Date.now(), "Es läuft keine Bedenkzeit");
    muss(frist - Date.now() <= kurz + 500, "Die Bedenkzeit ist länger als eingestellt");

    const dranVor = P.runde.amZug;
    // Erst ohne Karte: der Zug wird uebersprungen.
    // Und jetzt tut niemand etwas.
    await bis(() => P.runde.amZug !== dranVor, "der Zug rückt nach Ablauf weiter", 6000);
    muss(P.runde.frist > Date.now(), "Nach dem Zugwechsel läuft keine neue Frist");
    muss(P.runde.karte === null, "Nach dem übersprungenen Zug liegt eine Karte offen");
    console.log("ok  wer nichts tut, gibt nach Ablauf der Bedenkzeit ab");

    P.ws.close();
    Q.ws.close();
  } finally {
    dienst.kill();
    await dienst.status;
  }
}

if (alleC.some((c) => c.fehler.length)) {
  throw new Error("Fehlermeldungen: " + JSON.stringify(alleC.map((c) => c.fehler)));
}
console.log("\nALLES GRÜN");
Deno.exit(0);
