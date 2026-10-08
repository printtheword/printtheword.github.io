# Print the word

Eine statische One-Page-Webseite, mit der man Bibeltexte nach eigenen Wünschen als PDF setzen und drucken kann. Alles läuft im Browser: Die Texte liegen als JSON-Dateien neben der Seite, das PDF wird lokal mit [Typst](https://typst.app) (WASM über [typst.ts](https://github.com/Myriad-Dreamin/typst.ts)) erzeugt. Es gibt keinen Server, keine Anmeldung und kein Tracking. Die Einstellungen werden im `localStorage` gespeichert.

## Funktionen

- **Übersetzungen** (alle gemeinfrei, Quelle [eBible.org](https://ebible.org)): Lutherbibel 1912, Unrevidierte Elberfelder 1905, Textbibel Kautzsch/Weizsäcker 1906, Berean Standard Bible, World English Bible, King James Version, American Standard Version
- **Stellenangaben**: `Epheser 1`, `Galater 1,12-1,17`, `Gal 1,12-17`, `Römer`, `1. Mose 2-3`, `Joh 3,16f`, `Joh 3,16ff`, `Joh 3,16.18`, `John 3:16-18`, mehrere Stellen mit `;` (z. B. `Ps 23; Joh 10,1-18`)
- **Layout**: Papierformat (A3/A4/A5/A6/Letter/eigenes), Ausrichtung, Ränder, doppelseitig, 1–6 Spalten mit Trennlinie, Schriftart und -größe, Zeilen- und Absatzabstand, Blocksatz, Silbentrennung
- **Inhalt**: Buchtitel, Kapitelnummern (groß, als Zeile, am Rand, aus), Versnummern (hochgestellt, klein, fett, aus), Zwischenüberschriften, Fußnoten (Seitenende, am Schluss, aus), Worte Jesu farbig, Kopfzeile, Seitenzahlen
- **Absätze**: wie in der Übersetzung oder jeder Vers in neuer Zeile
- **Farben** sowie eine **Notizspalte** (liniert oder frei)
- **Vorlagen**: Lesen, Journaling A5, Kompakt 2-spaltig, Großdruck, Übersicht A3 (4-spaltig)
- Live-Vorschau und Download als PDF, außerdem Export als bearbeitbares ODT-Dokument für Word/LibreOffice (wird erst beim Klick nachgeladen; Schriften werden nur benannt, nicht eingebettet; die Linien der Notizspalte gibt es nur im PDF)
- Alle Einstellungen stehen in der URL (`?t=deu1912&ref=Galater+1,12-17&columns=2`): Vor/Zurück im Browser funktioniert, und „Link teilen“ kopiert einen Link mit Bibelstelle und Layout
- Zuletzt verwendete Bibelstellen erscheinen in der Aufklappliste des Eingabefelds

## Entwicklung

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # Parser-, Generator- und Typst-Kompilier-Tests
npm run build        # statische Seite in dist/
```

Die Bibeldaten in `public/bibles/` sind eingecheckt. Neu erzeugen lassen sie sich mit:

```sh
npm run build:bibles            # alle Übersetzungen (lädt USFM von eBible.org, Cache in .cache/)
npm run build:bibles -- deu1912 # nur eine
```

Mit installierter Typst-CLI kann man ein PDF auch ohne Browser erzeugen:

```sh
node scripts/render-cli.ts deu1912 "Römer 8" out.pdf '{"columns":2}'
```

## Aufbau

| Pfad | Inhalt |
|---|---|
| `scripts/build-bibles.ts` | lädt USFM und schreibt `public/bibles/<id>/<BUCH>.json` + `index.json` |
| `src/lib/usfm.ts` | schlanker USFM-Parser (Absätze, Poesie, Überschriften, Fußnoten, Worte Jesu) |
| `src/lib/books.ts`, `src/lib/reference.ts` | Buchnamen/Abkürzungen (de/en) und Parser für Stellenangaben |
| `src/lib/select.ts`, `src/lib/document.ts` | Auswahl der Verse und Aufbau des Dokuments |
| `src/typst/generate.ts` | erzeugt den Typst-Quelltext aus Text und Einstellungen |
| `src/lib/content.ts` | gemeinsame Inhaltsregeln für PDF und ODT (Kapitelstil, Vers pro Zeile, Überschriften) |
| `src/odt/generate.ts` | ODT-Export (OpenDocument-XML + ZIP mit fflate), wird bei Bedarf geladen |
| `src/typst/worker.ts` | Typst-Compiler/Renderer im Web Worker (SVG-Vorschau, PDF) |
| `src/App.tsx` | Oberfläche (SolidJS) |

## Deployment

Die Seite liegt unter <https://printtheword.github.io/> (Repository [`printtheword/printtheword.github.io`](https://github.com/printtheword/printtheword.github.io)). `.github/workflows/deploy.yml` baut sie bei jedem Push auf `main` und veröffentlicht sie auf GitHub Pages; im Repository ist dazu unter *Settings → Pages* die Quelle „GitHub Actions“ gewählt. Der Basispfad wird über `BASE_PATH` gesetzt (hier `/`).

## Lizenzen

- Bibeltexte: gemeinfrei (Public Domain), siehe `public/bibles/translations.json`. Die KJV ist im Vereinigten Königreich durch das Crown Patent geschützt. „World English Bible“ ist eine Marke von eBible.org.
- Schriften (Libertinus Serif, EB Garamond, Source Serif 4, Noto Serif, Noto Sans): SIL Open Font License, siehe `public/fonts/OFL-*.txt`
- typst.ts: Apache-2.0
