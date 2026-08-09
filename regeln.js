// KINGS CUP – die Regel zu jeder Karte, in zwei Fassungen.
//
// „Trinkfrei" ist die Voreinstellung: dieselben Karten, statt Schlucken kleine
// Aufgaben. Den Trinkmodus muss der Host bewusst umlegen. Damit ist das Spiel
// auch für Runden ohne Alkohol brauchbar – und die Seite muss keine
// Altersschranke bauen, die ohnehin keine wäre.
//
// Eigene Texte, keine aus einer Anleitung abgetippt.

/** @type {Record<string, {titel: string, frei: string, trink: string}>} */
export const REGELN = {
  "2": {
    titel: "Du bestimmst",
    frei: "Such dir jemanden aus: diese Person macht die nächste Aufgabe für dich mit.",
    trink: "Such dir jemanden aus – diese Person trinkt einen Schluck.",
  },
  "3": {
    titel: "Selber schuld",
    frei: "Du selbst bist dran: erzähl der Runde etwas, das dir heute peinlich war.",
    trink: "Du selbst trinkst einen Schluck.",
  },
  "4": {
    titel: "Boden",
    frei: "Alle fassen den Boden an. Wer zuletzt unten ist, macht zehn Hampelmänner.",
    trink: "Alle fassen den Boden an. Der Letzte trinkt.",
  },
  "5": {
    titel: "Reihum zählen",
    frei: "Zählt reihum, aber jede Zahl mit 7 oder durch 7 teilbar wird geklatscht. Wer stolpert, macht die nächste Aufgabe doppelt.",
    trink: "Zählt reihum mit der Sieben-Regel. Wer stolpert, trinkt.",
  },
  "6": {
    titel: "Schnauze",
    frei: "Du darfst bis zur nächsten Karte nichts sagen. Wer dich zum Reden bringt, übernimmt die Stille.",
    trink: "Du sagst bis zur nächsten Karte nichts. Wer dich zum Reden bringt, trinkt.",
  },
  "7": {
    titel: "Himmel",
    frei: "Alle zeigen nach oben. Wer zuletzt zeigt, muss den nächsten Zug im Stehen machen.",
    trink: "Alle zeigen nach oben. Der Letzte trinkt.",
  },
  "8": {
    titel: "Partner",
    frei: "Such dir einen Partner. Ab jetzt macht ihr beide alles gemeinsam.",
    trink: "Such dir einen Partner. Ab jetzt trinkt ihr beide zusammen.",
  },
  "9": {
    titel: "Reim",
    frei: "Sag ein Wort. Reihum wird darauf gereimt. Wem nichts einfällt, erzählt eine wahre Geschichte in einem Satz.",
    trink: "Sag ein Wort, reihum wird gereimt. Wem nichts einfällt, trinkt.",
  },
  "10": {
    titel: "Kategorie",
    frei: "Nenne eine Kategorie. Reihum wird aufgezählt. Wer hängt, singt eine Zeile.",
    trink: "Nenne eine Kategorie. Wer hängt, trinkt.",
  },
  "B": {
    titel: "Regel",
    frei: "Erfinde eine Regel, die ab jetzt für alle gilt. Wer sie bricht, macht eine Aufgabe deiner Wahl.",
    trink: "Erfinde eine Regel für alle. Wer sie bricht, trinkt.",
  },
  "D": {
    titel: "Fragemeister",
    frei: "Du bist Fragemeister. Wer dir bis zur nächsten Dame antwortet, muss deine nächste Aufgabe übernehmen.",
    trink: "Du bist Fragemeister. Wer dir antwortet, trinkt.",
  },
  "K": {
    titel: "König",
    frei: "Du denkst dir eine Aufgabe für die ganze Runde aus. Beim vierten König ist Schluss.",
    trink: "Kipp einen Rest in den Becher in der Mitte. Wer den vierten König zieht, trinkt ihn aus.",
  },
  "A": {
    titel: "Wasserfall",
    frei: "Wasserfall: alle klatschen im Takt, du hörst als Erste auf, danach reihum.",
    trink: "Wasserfall: alle trinken, du hörst als Erste auf, danach reihum.",
  },
};

export const RAENGE = Object.keys(REGELN);
export const FARBEN = ["♠", "♥", "♦", "♣"];

export function neuesDeck() {
  return FARBEN.flatMap((f) => RAENGE.map((r) => ({ r, f })));
}
