<div align="center">

# 🪐 Planeten-Quiz

### Teste dein Wissen über unser Sonnensystem – das interaktive Quiz des AstroClubs Frankfurt.

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) ![License](https://img.shields.io/badge/License-GPL%20v3-blue?style=for-the-badge)

[**🔗 Live Demo**](https://professorquantumuniverse.github.io/AstroClub-Planetenquiz/)

</div>

---

Ein verspieltes Astronomie-Quiz für Veranstaltungen des AstroClubs der Physikalischen Gesellschaft in und um Frankfurt. Erkunde das Universum und finde heraus, wie gut du die Planeten kennst!

## ✨ Features

- 🌍 Fragen rund um Planeten & Weltraum – erst allgemeine Fragen, dann die
  Sortieraufgabe, danach eine Frage zu jedem einzelnen Planeten
- 🎯 Live-Punktezählung mit motivierender Rückmeldung je nach Ergebnis
- 🇩🇪 🇬🇧 Komplett zweisprachig (Deutsch / Englisch)
- 📴 Läuft auch ohne Internet – als einzelne HTML-Datei
- 🎨 Stimmungsvolles Weltraum-Design
- 🗂️ Fragen einfach über `quizData.json` erweiterbar

## 📴 Offline-Version

Für Veranstaltungen ohne Internet gibt es das komplette Quiz als **eine einzige HTML-Datei**:

[**⬇️ Zum Download**](https://professorquantumuniverse.github.io/AstroClub-Planetenquiz/) – der
Button *„Quiz als einzelne Datei herunterladen“* steht unten auf der Quizseite. Wer lieber direkt
verlinkt: [Planetenquiz-offline.html](https://professorquantumuniverse.github.io/AstroClub-Planetenquiz/Planetenquiz-offline.html)
öffnet das Quiz im Browser, von dort speichert `Strg`+`S` die Datei.

Datei speichern, auf den Zielrechner kopieren (USB-Stick, Mail, Chat) und doppelklicken – sie
öffnet sich im Standardbrowser und läuft vollständig ohne Netz. Es wird nichts installiert,
kein Server gebraucht und keine Daten verlassen den Rechner. Getestet unter Windows mit Edge,
Chrome und Firefox.

Alles steckt in der Datei: Stylesheet, Skript, Bilder und Schriften als `data:`-URIs, die Fragen
als eingebetteter JSON-Block. Letzteres ist nötig, weil Browser `fetch()` auf `file://`-Seiten
blockieren – die Online-Version lädt `quizData.json` weiterhin ganz normal nach.

### Selbst bauen

```bash
node build-offline.mjs
```

Erzeugt `Planetenquiz-offline.html` aus den Quelldateien (benötigt Node.js 18+, sonst nichts).
Die Google Fonts werden einmalig geladen und in `.fontcache/` abgelegt, damit spätere Builds
auch ohne Internet funktionieren. Mit `--no-fonts` wird darauf verzichtet und das Quiz nutzt
die Systemschriften.

Ein GitHub-Workflow baut die Datei bei jeder Änderung im Repository automatisch neu und
prüft dabei, dass wirklich keine externen Verweise übrig sind – der Download-Link zeigt also
immer auf einen aktuellen und funktionierenden Stand.

## 🛠️ Tech-Stack

`HTML5` · `CSS3` · `JavaScript`


---

<div align="center">

Teil meiner Projektsammlung · [**Alle Projekte ansehen →**](https://professorquantumuniverse.github.io/My-Projects/)

Made with ☕ & curiosity by **Lorenzo Bay-Müller** ([@ProfessorQuantumUniverse](https://github.com/ProfessorQuantumUniverse))

</div>
