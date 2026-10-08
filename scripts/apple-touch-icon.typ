// Home screen icon, 180×180 px (iOS rounds the corners itself):
//   typst compile --format png --ppi 144 scripts/apple-touch-icon.typ public/apple-touch-icon.png
#set page(width: 90pt, height: 90pt, margin: 0pt, fill: rgb("#17565e"))
#image(bytes(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'>
  <path d='M14 11h20a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H14z' fill='#ffffff' opacity='0.55'/>
  <path d='M12 12a3 3 0 0 1 3-3h18a2 2 0 0 1 2 2v23a2 2 0 0 1-2 2H15a3 3 0 0 0 0 6a3 3 0 0 1-3-3z' fill='#ffffff'/>
  <path d='M15 36h20v3H15a1.5 1.5 0 0 1 0-3z' fill='#ffffff' opacity='0.55'/>
  <path d='M23.5 14v15M18.5 19h10' stroke='#17565e' stroke-width='2.6' stroke-linecap='round'/>
  </svg>"), format: "svg", width: 90pt)
