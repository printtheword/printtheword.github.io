import type { SelectedChapter } from '../lib/select.ts';
import { MAX_COLUMNS, type LayoutSettings, type Mark } from '../lib/settings.ts';
import type { Inline, Translation } from '../lib/types.ts';
import { chapterHeading, chapterStyleFor, LABELS, reflowVerses, visibleBlocks } from '../lib/content.ts';
import { compileMarks, markBlocks, markLabel, type MarkRules } from '../lib/marks.ts';

export interface Section {
  bookId: string;
  /** short book name, e.g. "Römer" (running header) */
  bookName: string;
  /** title printed above the text: full book title or the reference label */
  title: string;
  chapters: SelectedChapter[];
}

export interface DocumentInput {
  translation: Pick<Translation, 'name' | 'short' | 'lang' | 'license'>;
  /** combined label of all ranges, used as document title */
  label: string;
  sections: Section[];
  settings: LayoutSettings;
  /** occurrences of every mark rule in the complete document (also when the text is shortened) */
  markCounts: number[];
}

const PAPER_MM: Record<string, [number, number]> = {
  a3: [297, 420],
  a4: [210, 297],
  a5: [148, 210],
  a6: [105, 148],
  'us-letter': [215.9, 279.4],
};

const MARKUP = /[\\#$*_`<>@[\]~=+\-/.:()]/g;
/** Escapes text for Typst markup mode. */
export const esc = (s: string) => s.replace(MARKUP, '\\$&');
/** Escapes text for a Typst string literal. */
export const str = (s: string) => `"${s.replace(/[\\"]/g, '\\$&').replace(/\n/g, '\\n')}"`;
const mm = (n: number) => `${+n.toFixed(2)}mm`;
const color = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? `rgb("${c}")` : 'black');
const num = (n: number, fallback: number) => (Number.isFinite(n) ? +n : fallback);

export function pageSize(s: LayoutSettings): [number, number] {
  const [w, h] = s.paper === 'custom' ? [s.customWidth, s.customHeight] : PAPER_MM[s.paper];
  return s.landscape ? [Math.max(w, h), Math.min(w, h)] : [Math.min(w, h), Math.max(w, h)];
}

/** Builds the complete Typst document. */
export function generateTypst(input: DocumentInput): string {
  const s = input.settings;
  const lang = input.translation.lang;
  const out: string[] = [preamble(input)];
  const rules = compileMarks(s.marks);
  for (const section of input.sections) out.push(new SectionWriter(section, s, lang, rules).write());
  if (s.markLegend) out.push(legend(input, rules));
  return out.join('\n');
}

/** Typst function that applies the effects of a mark rule to its body. */
function markFunction(m: Mark): string {
  let body = 'body';
  const text = [
    ...(m.color ? [`fill: ${color(m.color)}`] : []),
    ...(m.bold ? ['weight: "bold"'] : []),
    ...(m.italic ? ['style: "italic"'] : []),
  ];
  if (text.length) body = `text(${text.join(', ')}, ${body})`;
  if (m.background || m.frame !== 'none') {
    const fc = color(m.frameColor);
    const stroke = { none: 'none', box: `0.6pt + ${fc}`, rounded: `0.6pt + ${fc}`, oval: `0.6pt + ${fc}`, dashed: `(paint: ${fc}, thickness: 0.6pt, dash: "dashed")` }[m.frame];
    const radius = { none: '0pt', box: '0pt', dashed: '0pt', rounded: '2.5pt', oval: '0.6em' }[m.frame];
    // highlight (unlike box) breaks across lines; leave room for a line below the text
    const bottom = m.line !== 'none' ? ', bottom-edge: -0.5em' : '';
    const extent = m.frame === 'none' ? '0.5pt' : '1pt';
    body = `highlight(fill: ${m.background ? color(m.background) : 'none'}, stroke: ${stroke}, radius: ${radius}, extent: ${extent}${bottom}, ${body})`;
    // the frame reaches beyond the text – keep it off the neighbouring words
    if (m.frame !== 'none') body = `h(1.5pt) + ${body} + h(1.5pt)`;
  }
  // the line goes outside, otherwise the background would cover it
  const lc = color(m.lineColor);
  switch (m.line) {
    case 'solid':
      return `underline(stroke: 0.7pt + ${lc}, offset: 2pt, ${body})`;
    case 'double':
      return `underline(stroke: 0.5pt + ${lc}, offset: 1.6pt, underline(stroke: 0.5pt + ${lc}, offset: 3pt, ${body}))`;
    case 'dotted':
      return `underline(stroke: (paint: ${lc}, thickness: 0.9pt, dash: "dotted"), offset: 2pt, ${body})`;
    case 'dashed':
      return `underline(stroke: (paint: ${lc}, thickness: 0.7pt, dash: "dashed"), offset: 2pt, ${body})`;
    case 'wavy':
      // a thick underline painted with a wave pattern – unlike a drawn curve it breaks across lines
      return `underline(stroke: (paint: wave(${lc}), thickness: 2.4pt), offset: 2.4pt, evade: false, ${body})`;
    case 'none':
      return body;
  }
}

/** Legend of the mark rules at the end of the document. */
function legend({ settings: s, markCounts, translation }: DocumentInput, rules: MarkRules): string {
  const items = s.marks.flatMap((m, i) => {
    if (!rules[i]) return [];
    const count = s.markCounts ? ` #text(size: 0.85em, fill: luma(110))[(${markCounts[i] ?? 0}×)]` : '';
    return [`#box[#mk${i}[${esc(markLabel(m))}]${count}]`];
  });
  if (!items.length) return '';
  const title = LABELS[translation.lang].legend;
  if (s.markLegendPage) {
    return `#pagebreak(weak: true)
#block(below: 1.2em, text(font: hfont, size: 1.4em, weight: "bold", fill: ${color(s.headingColor)}, [${title}]))
#block[
  #set par(justify: false, leading: 1em)
  ${items.join(' #linebreak()\n  ')}
]
`;
  }
  return `#block(above: 1.6em, breakable: false)[
  #text(font: hfont, weight: "bold", [${title}])
  #parbreak()
  #set par(justify: false)
  ${items.join(' #h(1.4em) ')}
]
`;
}

function preamble({ settings: s, translation, label }: DocumentInput): string {
  const [w, h] = pageSize(s);
  const notes = s.notesArea !== 'none' ? num(s.notesWidth, 50) : 0;
  const top = num(s.marginTop, 20);
  const bottom = num(s.marginBottom, 20);
  const inner = num(s.marginInner, 20);
  const outer = num(s.marginOuter, 20) + notes;
  const cols = Math.max(1, Math.min(MAX_COLUMNS, Math.round(num(s.columns, 1))));
  const gap = num(s.columnGap, 7);
  const margin = s.twoSided
    ? `(inside: ${mm(inner)}, outside: ${mm(outer)}, top: ${mm(top)}, bottom: ${mm(bottom)})`
    : `(left: ${mm(inner)}, right: ${mm(outer)}, top: ${mm(top)}, bottom: ${mm(bottom)})`;
  const font = `(${str(s.font)}, "Libertinus Serif")`;
  const headingFont = `(${str(s.headingFont)}, "Libertinus Serif")`;
  const lead = num(s.lineSpacing, 0.65);

  // left margin of odd / even pages (even pages are mirrored in two-sided mode)
  const leftOdd = inner;
  const leftEven = s.twoSided ? outer : inner;
  const textWidth = w - inner - outer;
  const colWidth = (textWidth - (cols - 1) * gap) / cols;
  const ruleXs = (left: number) =>
    Array.from({ length: cols - 1 }, (_, k) => mm(left + (k + 1) * colWidth + k * gap + gap / 2));

  const background: string[] = [];
  if (s.columnRule && cols > 1) {
    background.push(`
  let xs = if calc.odd(here().page()) or not ${s.twoSided} { (${ruleXs(leftOdd).join(', ')},) } else { (${ruleXs(leftEven).join(', ')},) }
  // start below a book title spanning all columns
  let titles = query(<booktitle-end>).filter(m => m.location().page() == here().page())
  let y0 = if titles.len() > 0 { titles.first().location().position().y + 1.2em } else { ${mm(top)} }
  for x in xs { place(top + left, dx: x, dy: y0, line(length: ${mm(h - bottom)} - y0, angle: 90deg, stroke: 0.4pt + luma(170))) }`);
  }
  if (s.notesArea === 'lines') {
    const spacing = Math.max(4, num(s.notesLineSpacing, 8));
    const n = Math.floor((h - top - bottom) / spacing);
    const len = notes - 5;
    // notes column sits at the outer edge of the text area
    const xOdd = w - outer + 5;
    const xEven = s.twoSided ? num(s.marginOuter, 20) : xOdd;
    background.push(`
  let nx = if calc.odd(here().page()) or not ${s.twoSided} { ${mm(xOdd)} } else { ${mm(xEven)} }
  for i in range(1, ${n + 1}) { place(top + left, dx: nx, dy: ${mm(top)} + i * ${mm(spacing)}, line(length: ${mm(len)}, stroke: 0.4pt + luma(190))) }`);
  }

  const header = s.runningHeader
    ? `context {
    let p = here().page()
    let marks = query(<chapmark>)
    let on = marks.filter(m => m.location().page() == p)
    let before = marks.filter(m => m.location().page() < p)
    let m = if on.len() > 0 { on.first() } else if before.len() > 0 { before.last() } else { none }
    if m != none and p > 1 {
      set text(size: 0.8em, fill: luma(110), font: ${headingFont})
      let t = m.value
      if ${s.twoSided} and calc.even(p) { align(left, t) } else { align(right, t) }
    }
  }`
    : 'none';
  const footer = s.pageNumbers
    ? `context {
    set text(size: 0.8em, fill: luma(110))
    let p = counter(page).display()
    if ${s.twoSided} { if calc.even(here().page()) { align(left, p) } else { align(right, p) } } else { align(center, p) }
  }`
    : 'none';

  const verseFill = color(s.verseColor);
  const verse = {
    super: `box(text(size: 0.6em, baseline: -0.45em, fill: ${verseFill}, number-type: "lining")[#n]) + sym.space.nobreak.narrow`,
    inline: `box(text(size: 0.78em, weight: "bold", fill: ${verseFill})[#n]) + sym.space.nobreak`,
    bold: `box(text(weight: "bold", fill: ${verseFill})[#n]) + sym.space.nobreak`,
    none: `[]`,
  }[s.verseStyle];
  const chapFill = color(s.chapterColor);
  const headFill = color(s.headingColor);
  const sp = num(s.paragraphSpacing, 0.65);

  return `// generated by Print the word
#set document(title: ${str(label)})
#set page(
  width: ${mm(w)}, height: ${mm(h)},
  margin: ${margin},
  columns: ${cols},
  header: ${header},
  footer: ${footer},
  background: ${background.length ? `context {${background.join('\n')}\n}` : 'none'},
)
#set columns(gutter: ${mm(gap)})
#set text(font: ${font}, size: ${num(s.fontSize, 11)}pt, lang: "${translation.lang}", fill: ${color(s.textColor)}, hyphenate: ${s.hyphenate})
#set par(justify: ${s.justify}, leading: ${lead}em, spacing: ${sp}em, first-line-indent: 0pt)
#set footnote(numbering: "a")
#set footnote.entry(separator: line(length: 25%, stroke: 0.4pt + luma(150)))
#show footnote.entry: set text(size: 0.8em)
#show footnote.entry: set par(justify: false)

#let hfont = ${headingFont}
#let wave(c) = tiling(size: (5pt, 2.4pt), curve(stroke: 0.7pt + c,
  curve.move((0pt, 1.2pt)), curve.cubic((1.25pt, -0.4pt), (1.25pt, -0.4pt), (2.5pt, 1.2pt)),
  curve.cubic((3.75pt, 2.8pt), (3.75pt, 2.8pt), (5pt, 1.2pt))))
${s.marks.map((m, i) => `#let mk${i}(body) = ${markFunction(m)}`).join('\n')}
#let vn(n) = ${verse}
#let wj(body) = ${s.wordsOfJesusRed ? `text(fill: ${color(s.wjColor)}, body)` : 'body'}
#let nd(body) = smallcaps(body)
#let add(body) = emph(body)
#let fnm(n) = super(text(fill: ${verseFill}, numbering("a", n)))
#let chapcap(n) = box(text(font: ${headingFont}, size: 2.6em, weight: "bold", fill: ${chapFill}, top-edge: "cap-height", bottom-edge: "baseline", n)) + h(0.35em)
#let chapmargin(n) = box(width: 0pt, place(right, dx: -0.6em, text(font: ${headingFont}, size: 1.5em, weight: "bold", fill: ${chapFill}, n)))
#let chaphead(t) = block(above: 1.4em, below: 0.7em, sticky: true, text(font: ${headingFont}, size: 1.2em, weight: "bold", fill: ${chapFill}, t))
#let booktitle(t) = place(top + center, float: true, scope: "parent", clearance: 1.5em,
  [#text(font: ${headingFont}, size: 1.9em, weight: "bold", fill: ${headFill}, t)#metadata(none) <booktitle-end>])
#let hd(kind, body) = {
  if kind == "ms" { block(above: 1.6em, below: 0.8em, sticky: true, align(center, text(font: ${headingFont}, size: 1.15em, weight: "bold", fill: ${headFill}, body))) }
  else if kind == "s1" { block(above: 1.3em, below: 0.6em, sticky: true, text(font: ${headingFont}, weight: "bold", fill: ${headFill}, body)) }
  else if kind == "s2" { block(above: 1em, below: 0.5em, sticky: true, text(font: ${headingFont}, style: "italic", fill: ${headFill}, body)) }
  else if kind == "r" { block(above: 0.3em, below: 0.6em, sticky: true, text(size: 0.85em, style: "italic", fill: luma(100), body)) }
  else if kind == "d" { block(above: 0.6em, below: 0.6em, sticky: true, text(size: 0.9em, style: "italic", body)) }
  else if kind == "qa" { block(above: 0.8em, below: 0.4em, sticky: true, smallcaps(text(fill: ${headFill}, body))) }
  else { block(above: 0.6em, below: 0.3em, sticky: true, text(style: "italic", body)) }
}
#let q(level, body) = block(above: ${lead}em, below: ${lead}em, inset: (left: level * 1.2em),
  par(justify: false, first-line-indent: 0pt, hanging-indent: 1.2em, body))
#let endnotes(title, items) = {
  block(above: 1.6em, below: 0.6em, sticky: true, text(font: ${headingFont}, weight: "bold", fill: ${headFill}, title))
  set text(size: 0.85em)
  set par(justify: false, spacing: 0.4em)
  for (n, ref, body) in items { [#fnm(n) #text(weight: "bold", ref) #body \\ ] }
}
`;
}

class SectionWriter {
  private lines: string[] = [];
  private endnotes: string[] = [];
  private noteCount = 0;
  private chapter = 0;
  private verse = 0;
  private labels: (typeof LABELS)['de'];
  private lang: 'de' | 'en';
  private section: Section;
  private s: LayoutSettings;
  private rules: MarkRules;

  constructor(section: Section, s: LayoutSettings, lang: 'de' | 'en', rules: MarkRules) {
    this.section = section;
    this.s = s;
    this.lang = lang;
    this.rules = rules;
    this.labels = LABELS[lang];
  }

  write(): string {
    const { section, s } = this;
    this.lines.push('#pagebreak(weak: true)');
    if (s.showBookTitle) this.lines.push(`#booktitle[${esc(section.title)}]`);
    for (const ch of section.chapters) this.writeChapter(ch);
    if (this.endnotes.length) {
      this.lines.push(`#endnotes([${this.labels.notes}], (\n${this.endnotes.join(',\n')},\n))`);
    }
    return this.lines.join('\n\n') + '\n';
  }

  private writeChapter(ch: SelectedChapter) {
    const { s, section } = this;
    this.chapter = ch.n;
    this.lines.push(`#metadata(${str(`${section.bookName} ${ch.n}`)}) <chapmark>`);

    const style = chapterStyleFor(section, ch, s);
    if (style === 'heading') this.lines.push(`#chaphead[${esc(chapterHeading(section, ch.n, s, this.lang))}]`);

    const blocks = markBlocks(reflowVerses(visibleBlocks(ch.blocks, s), s), this.rules);

    let pendingCap = style === 'dropcap' || style === 'margin' ? ch.n : undefined;
    for (const b of blocks) {
      if ('h' in b) {
        this.lines.push(`#hd("${b.h}")[${this.inlines(b.c, false)}]`);
        continue;
      }
      if (b.p === 'b') {
        this.lines.push(`#v(${num(s.lineSpacing, 0.65)}em)`);
        continue;
      }
      let prefix = '';
      let suppressFirstVerse = false;
      if (pendingCap !== undefined) {
        prefix = style === 'dropcap' ? `#chapcap[${pendingCap}];` : `#chapmargin[${pendingCap}];`;
        suppressFirstVerse = style === 'dropcap' && ch.fromStart;
        pendingCap = undefined;
      }
      const body = prefix + this.inlines(b.c, suppressFirstVerse);
      this.lines.push(this.paragraph(b.p, body));
    }
  }

  private paragraph(kind: string, body: string): string {
    switch (kind) {
      case 'q1':
      case 'li1':
        return `#q(0)[${body}]`;
      case 'q2':
      case 'li2':
        return `#q(1)[${body}]`;
      case 'q3':
        return `#q(2)[${body}]`;
      case 'qr':
        return `#align(right)[${body}]`;
      case 'pc':
        return `#align(center)[${body}]`;
      case 'pi':
        return `#pad(left: 1.2em)[${body}]`;
      default:
        return body;
    }
  }

  private inlines(c: Inline[], suppressFirstVerse: boolean): string {
    let out = '';
    let first = true;
    for (const x of c) {
      if (typeof x === 'string') out += esc(x);
      else if ('v' in x) {
        this.verse = x.v;
        if (out && !/\s$/.test(out)) out += ' ';
        if (!(first && suppressFirstVerse) && this.s.verseStyle !== 'none') out += `#vn(${x.v});`;
        first = false;
      } else if ('s' in x) {
        const t = esc(x.t);
        const styled = x.s === 'bd' ? `#strong[${t}]` : x.s === 'it' ? `#emph[${t}]` : `#${x.s}[${t}]`;
        out += x.m === undefined ? `${styled};` : `#mk${x.m}[${styled}];`;
      } else if ('m' in x) {
        out += `#mk${x.m}[${esc(x.t)}];`;
      } else if ('f' in x) {
        out += this.note(x.f);
      }
    }
    return out.trim();
  }

  private note(text: string): string {
    const mode = this.s.footnotes;
    if (mode === 'none') return '';
    if (mode === 'page') return `#footnote[${esc(text)}];`;
    const n = ++this.noteCount;
    const ref = `${this.chapter}${this.labels.sep}${this.verse}`;
    this.endnotes.push(`  (${n}, ${str(ref)}, [${esc(text)}])`);
    return `#fnm(${n});`;
  }
}
