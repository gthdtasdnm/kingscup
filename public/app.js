// KINGS CUP – Client. Alle sehen dieselbe Karte und denselben Text.
import { $, el, S, schicke, starteSchale, zeige } from "./schale.js";

const HILFE = [
  "<b>Ein Deck, reihum eine Karte.</b> Jede Karte hat eine Regel, und die gilt für die ganze Runde.",
  "<b>Trinkfrei ist voreingestellt</b> – dieselben Karten, statt Schlucken kleine Aufgaben. Der Trinkmodus ist ein Schalter, den der Host bewusst umlegt.",
  "<b>Alle sehen dieselbe Karte</b> auf ihrem eigenen Handy; niemand muss vorlesen, was er nicht lesen kann.",
  "<b>Bube, Dame, Ass</b> machen Regeln, die weiterlaufen: eigene Regel, Fragemeister, Wasserfall.",
  "<b>Beim vierten König ist Schluss.</b>",
];

const rot = (k) => k.f === "♥" || k.f === "♦";

function zeichneSpiel(m) {
  zeige("game");
  $("tbLinks").innerHTML = `Karten <strong>${m.rest}</strong>`;
  $("tbTag").textContent = m.modus === "trink" ? "Trinkmodus" : "trinkfrei";

  const b = $("buehne");
  b.innerHTML = "";

  const koenige = el("div", "koenige");
  for (let i = 0; i < 4; i++) koenige.append(el("span", "kk" + (i < m.koenige ? " an" : ""), "👑"));
  b.append(koenige);

  const box = el("div", "kkarte");
  if (m.karte) {
    box.append(el("div", "kk-gross" + (rot(m.karte) ? " rot" : ""), `${m.karte.r}${m.karte.f}`));
    box.append(el("h2", "kk-titel", m.titel));
    box.append(el("p", "kk-text", m.text));
  } else {
    box.append(el("div", "kk-gross ruecken", "🂠"));
    box.append(el("h2", "kk-titel", `${m.amZugName} ist dran`));
    box.append(el("p", "kk-text", "Eine Karte ziehen."));
  }
  b.append(box);

  const reihe = el("div", "kreihe");
  for (const p of m.spieler) {
    reihe.append(el("span", "kp" + (p.id === m.amZug ? " zug" : "") + (p.weg ? " off" : ""), p.name));
  }
  b.append(reihe);

  const akt = $("aktionen");
  akt.innerHTML = "";
  if (m.amZug === S.me) {
    if (!m.karte) {
      const z = el("button", "btn primary big", "Karte ziehen");
      z.onclick = () => schicke({ t: "ziehen" });
      akt.append(z);
    } else {
      const w = el("button", "btn primary big", m.koenige >= 4 ? "Runde beenden" : "Erledigt – weiter");
      w.onclick = () => schicke({ t: "weiter" });
      akt.append(w);
    }
    $("rundenHint").textContent = "";
  } else {
    $("rundenHint").textContent = `${m.amZugName} ist dran.`;
  }
}

$("helpList").innerHTML = HILFE.map((h) => `<li>${h}</li>`).join("");

const extra = $("hostExtra");
extra.innerHTML = `<div class="setting"><span class="setting-label">Fassung</span>
  <div class="segmented">
    <button class="seg sel" data-m="frei">Trinkfrei</button>
    <button class="seg" data-m="trink">Mit Schlucken</button>
  </div></div>
  <p class="hintline">Trinkfrei heißt: dieselben Karten, statt Schlucken kleine Aufgaben.</p>`;
for (const b of extra.querySelectorAll("[data-m]")) {
  b.onclick = () => schicke({ t: "settings", modus: b.dataset.m });
}

starteSchale({
  key: "kingscup",
  zeichneSpiel,
  zeichneRaum: (r) => {
    for (const b of extra.querySelectorAll("[data-m]")) {
      b.classList.toggle("sel", b.dataset.m === r.settings.modus);
    }
  },
});
