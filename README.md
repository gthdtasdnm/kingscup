# Kings Cup 👑

Ein Deck, reihum eine Karte, und der Server sagt allen dieselbe Regel dazu.
Niemand muss die Regeln auswendig können, und niemand muss vorlesen, was er
nicht lesen kann – jeder sieht die Karte samt Text auf seinem eigenen Handy.

**Voreingestellt ist die trinkfreie Fassung.** Dieselben Karten, statt
Schlucken kleine Aufgaben. Der Trinkmodus ist ein Schalter, den der Host
bewusst umlegt. Damit ist das Spiel auch für Runden ohne Alkohol brauchbar –
und die Seite braucht keine Altersschranke, die ohnehin keine wäre.

Läuft auf **Deno**, ohne eine einzige externe Abhängigkeit. Kein Build-Schritt,
kein `node_modules`, ein Prozess.

---

## Starten

```bash
deno task dev          # http://localhost:8064/
PORT=9000 deno task dev
deno task check        # Typprüfung
deno task probe        # spielt bis zum vierten König (Server muss laufen)
ZUG_MS=3000 deno task dev    # kurze Bedenkzeit zum Ausprobieren
```

Zum Ausprobieren allein: die Seite in **mehreren Browserfenstern** öffnen.

## An den Tisch kommen

Name eintippen, **Raum eröffnen** oder über die Liste bzw. den vierstelligen
**Code** beitreten. **Zwei bis zehn** Leute.

## Ablauf

Wer dran ist, zieht eine Karte. Alle sehen sie und die Regel dazu. Dann gibt er
weiter. **Beim vierten König ist Schluss.**

Dreizehn Ränge, dreizehn Regeln, jede in zwei Fassungen – `regeln.js`. Bube,
Dame und Ass machen Regeln, die weiterlaufen: eigene Regel, Fragemeister,
Wasserfall.

Alle Texte sind selbst geschrieben, aus keiner Anleitung abgetippt. Regeln sind
frei, fremde Formulierungen nicht.

## Bedenkzeit

**90 Sekunden je Zug.** Wer dran ist und das Handy weglegt, hielt vorher die
ganze Runde an – und am Tisch sieht niemand, woran es liegt; es sieht aus, als
sei das Spiel kaputt. Läuft die Frist ab, wird weitergegeben (wenn eine Karte
offen liegt) oder der Zug übersprungen (wenn nicht). Ab dreißig Sekunden steht
der Rest sichtbar oben, sonst wirkt der Wechsel wie ein Fehler statt wie eine
Regel.

`ZUG_MS` lässt sich über die Umgebung stellen. Das ist kein Selbstzweck: die
Probe startet damit einen eigenen Server mit anderthalb Sekunden Frist und
sieht dem Ablauf wirklich zu, statt anderthalb Minuten zu warten.

## Was `probe.js` prüft

Der erste Teil läuft ganz ohne Server und liest die **Regeltexte** selbst: 13
Ränge, jeder mit Titel und beiden Fassungen, keine zwei mit demselben Titel,
kein Titel zu lang für die Karte – und in keinem trinkfreien Text ein Schluck.
Das ist hier kein Beiwerk: die trinkfreie Fassung ist die Voreinstellung, und
ein Wort, das sich dort einschleicht, fällt sonst niemandem auf.

Danach eine ganze Partie: keine Karte zweimal, der Rest zählt herunter, Titel
und Text passen zu jeder gezogenen Karte, der Modus lässt sich nur vom Host
umlegen, zweimal Ziehen zieht nicht zweimal.

## Wenn jemand geht

- Wer die Verbindung verliert, behält seinen Platz eine Minute lang.
- Verlässt jemand den Raum, während er am Zug ist, rückt der Zug weiter.
- Ist niemand mehr da, endet die Partie.

## Dateien

| Datei | Was |
|---|---|
| `server.js` | Deck, Zugreihenfolge, Bedenkzeit, Königszähler |
| `regeln.js` | 13 Karten × zwei Fassungen, Blatt |
| `probe.js` | liest die Regeltexte, dann eine Partie mit drei Clients |
| `bremse.js`, `raum.js`, `statisch.js` | gemeinsam, **wortgleich in allen Spielen** |
| `public/index.html` | alle vier Bildschirme plus die Hilfe |
| `public/schale.js` | gemeinsame Client-Schale (Verbindung, Lobby) |
| `public/style.css` | Lobby-Basis, gemeinsamer Rahmen, darunter das Eigene |
| `public/app.js` | Karte, Regeltext, Weiter-Knopf, Uhr |

## Betrieb

Port **8064**, gebunden auf `127.0.0.1`, davor Apache als Reverse Proxy unter
`/kingscup/`. Dienst: `kingscup.service` (systemd, läuft als `www-data`).

```bash
systemctl status kingscup
journalctl -u kingscup -f
```

Der Zustand liegt vollständig im RAM. Ein Neustart wirft alle laufenden Partien
weg – das ist gewollt, es gibt nichts zu sichern.
