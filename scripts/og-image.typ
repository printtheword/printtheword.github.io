// Link preview image (Open Graph), 1200×630 px:
//   node scripts/render-cli.ts deu1912 "Johannes 1" og.pdf '{"columns":2,"fontSize":9.5,"marginTop":15,"marginBottom":17,"marginInner":15,"marginOuter":15,"columnRule":true,"lineSpacing":0.55,"paragraphSpacing":0.4}'
//   pdftoppm -r 200 -png -f 1 -l 1 -singlefile og.pdf .cache/og-page
//   typst compile --root . --ignore-system-fonts --font-path public/fonts --format png --ppi 144 scripts/og-image.typ public/og-image.png
#let accent = rgb("#17565e")
#let logo(size) = image(bytes(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'>
  <rect width='48' height='48' rx='11' fill='#17565e'/>
  <path d='M14 11h20a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H14z' fill='#ffffff' opacity='0.55'/>
  <path d='M12 12a3 3 0 0 1 3-3h18a2 2 0 0 1 2 2v23a2 2 0 0 1-2 2H15a3 3 0 0 0 0 6a3 3 0 0 1-3-3z' fill='#ffffff'/>
  <path d='M15 36h20v3H15a1.5 1.5 0 0 1 0-3z' fill='#ffffff' opacity='0.55'/>
  <path d='M23.5 14v15M18.5 19h10' stroke='#17565e' stroke-width='2.6' stroke-linecap='round'/>
  </svg>"), format: "svg", width: size)

#set page(width: 600pt, height: 315pt, margin: 0pt, fill: rgb("#eef2f2"))
#set text(font: "Libertinus Serif", fill: rgb("#172326"))

#place(top + left, dx: 36pt, dy: 0pt, box(height: 315pt, align(horizon, block(width: 330pt)[
  #grid(columns: 2, gutter: 12pt, align: horizon,
    logo(44pt),
    text(size: 36pt, weight: "bold", fill: accent)[Print the word])
  #v(14pt)
  #text(size: 21pt)[Bibeltexte nach eigenen Wünschen als PDF setzen und drucken]
  #v(10pt)
  #text(font: "Noto Sans", size: 11pt, fill: rgb("#56676b"))[Kostenlos · direkt im Browser · gemeinfreie Übersetzungen]
])))

// a real page of the app, slightly turned
#place(top + left, dx: 405pt, dy: 32pt, rotate(4deg, reflow: false,
  block(fill: white, stroke: 0.5pt + rgb("#c9d4d6"), radius: 2pt, clip: true,
    image("/.cache/og-page.png", width: 168pt))))
