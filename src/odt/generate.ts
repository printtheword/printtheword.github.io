import { strToU8, zipSync } from 'fflate';
import { chapterHeading, chapterStyleFor, LABELS, reflowVerses, visibleBlocks } from '../lib/content.ts';
import type { SelectedChapter } from '../lib/select.ts';
import { compileMarks, markBlocks, markLabel, type MarkRules } from '../lib/marks.ts';
import { MAX_COLUMNS, type LayoutSettings, type Mark } from '../lib/settings.ts';
import type { HeadingKind, Inline } from '../lib/types.ts';
import { pageSize, type DocumentInput, type Section } from '../typst/generate.ts';

/**
 * Writes the document as OpenDocument text (.odt) for Word and LibreOffice.
 * Loaded on demand. Mirrors the Typst layout as far as ODF styles allow; the lined notes
 * column is left out (its space stays free).
 */
export function generateOdt(input: DocumentInput): Uint8Array {
  const content = new ContentWriter(input);
  for (const [i, section] of input.sections.entries()) content.section(section, i);
  if (input.settings.markLegend) content.legend();
  return zipSync({
    // must be the first entry and stored uncompressed
    mimetype: [strToU8(MIME), { level: 0 }],
    'content.xml': strToU8(content.xml()),
    'styles.xml': strToU8(stylesXml(input)),
    'meta.xml': strToU8(metaXml(input)),
    'META-INF/manifest.xml': strToU8(MANIFEST),
  });
}

export const MIME = 'application/vnd.oasis.opendocument.text';

/** Escapes text for XML content and attributes (and drops characters XML doesn't allow). */
export const xml = (t: string) =>
  t
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const color = (c: string, fallback = '#000000') => (/^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : fallback);
const num = (n: number, fallback: number) => (Number.isFinite(n) ? +n : fallback);
const mm = (n: number) => `${+n.toFixed(2)}mm`;
const pt = (n: number) => `${+n.toFixed(2)}pt`;
/** footnote marks like Typst's numbering("a"): a … z, aa, ab … */
const alpha = (n: number): string => (n > 26 ? alpha(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(97 + ((n - 1) % 26));

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"',
  'office:version="1.3"',
].join(' ');
const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

const MANIFEST = `${HEAD}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
 <manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME}"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>
`;

function metaXml({ label, translation }: DocumentInput): string {
  return `${HEAD}<office:document-meta ${NS}><office:meta>
 <meta:generator>Print the word</meta:generator>
 <dc:title>${xml(`${label} (${translation.short})`)}</dc:title>
 <dc:language>${translation.lang}</dc:language>
</office:meta></office:document-meta>
`;
}

/** Text properties of a mark rule. */
function markText(m: Mark): string {
  const props: string[] = [];
  if (m.background) props.push(`fo:background-color="${color(m.background)}"`);
  if (m.color) props.push(`fo:color="${color(m.color)}"`);
  if (m.bold) props.push('fo:font-weight="bold"');
  if (m.italic) props.push('fo:font-style="italic"');
  if (m.line !== 'none') {
    const style = { solid: 'solid', double: 'solid', dotted: 'dotted', dashed: 'dash', wavy: 'wave' }[m.line];
    // LibreOffice draws an "auto" wave hardly visible
    props.push(
      `style:text-underline-style="${style}" style:text-underline-width="${m.line === 'wavy' ? 'bold' : 'auto'}" style:text-underline-color="${color(m.lineColor)}"`,
    );
    if (m.line === 'double') props.push('style:text-underline-type="double"');
  }
  // character borders can't be rounded – rounded and oval frames become plain ones
  if (m.frame !== 'none') {
    props.push(`fo:border="0.6pt ${m.frame === 'dashed' ? 'dashed' : 'solid'} ${color(m.frameColor)}" fo:padding="0.3mm"`);
  }
  return props.join(' ');
}

const columnCount = (s: LayoutSettings) => Math.max(1, Math.min(MAX_COLUMNS, Math.round(num(s.columns, 1))));

/** Vertical space taken by header/footer inside the page margin (mm). */
const HF_HEIGHT = 4;
const HF_GAP = 4;

function stylesXml({ settings: s, translation, sections }: DocumentInput): string {
  const fs = num(s.fontSize, 11);
  const em = (n: number) => pt(n * fs);
  const lead = num(s.lineSpacing, 0.65);
  const head = color(s.headingColor);
  const chap = color(s.chapterColor);
  const verse = color(s.verseColor);
  const [lang, country] = translation.lang === 'de' ? ['de', 'DE'] : ['en', 'US'];
  const generic = (f: string) => (/sans/i.test(f) ? 'swiss' : 'roman');
  const fonts = [...new Set([s.font, s.headingFont, 'Libertinus Serif'])];

  // page layouts: with and without a running header
  const [w, h] = pageSize(s);
  const notes = s.notesArea !== 'none' ? num(s.notesWidth, 50) : 0;
  const top = num(s.marginTop, 20);
  const bottom = num(s.marginBottom, 20);
  const hf = HF_HEIGHT + HF_GAP;
  const layout = (name: string, header: boolean) => `<style:page-layout style:name="${name}"${s.twoSided ? ' style:page-usage="mirrored"' : ''}>
   <style:page-layout-properties fo:page-width="${mm(w)}" fo:page-height="${mm(h)}" style:print-orientation="${w > h ? 'landscape' : 'portrait'}"
    fo:margin-top="${mm(header ? Math.max(5, top - hf) : top)}" fo:margin-bottom="${mm(s.pageNumbers ? Math.max(5, bottom - hf) : bottom)}"
    fo:margin-left="${mm(num(s.marginInner, 20))}" fo:margin-right="${mm(num(s.marginOuter, 20) + notes)}"/>
   <style:header-style>${header ? `<style:header-footer-properties fo:min-height="${mm(HF_HEIGHT)}" fo:margin-bottom="${mm(HF_GAP)}"/>` : ''}</style:header-style>
   <style:footer-style>${s.pageNumbers ? `<style:header-footer-properties fo:min-height="${mm(HF_HEIGHT)}" fo:margin-top="${mm(HF_GAP)}"/>` : ''}</style:footer-style>
  </style:page-layout>`;

  // one master page per section (switching masters starts a new page and changes the running header)
  const hfPara = (style: string, body: string) => `<text:p text:style-name="${style}">${body}</text:p>`;
  const footer = s.pageNumbers
    ? s.twoSided
      ? `<style:footer>${hfPara('PTW_hf_r', '<text:page-number text:select-page="current"/>')}</style:footer><style:footer-left>${hfPara('PTW_hf_l', '<text:page-number text:select-page="current"/>')}</style:footer-left>`
      : `<style:footer>${hfPara('PTW_hf_c', '<text:page-number text:select-page="current"/>')}</style:footer>`
    : '';
  const header = (name: string) =>
    s.twoSided
      ? `<style:header>${hfPara('PTW_hf_r', xml(name))}</style:header><style:header-left>${hfPara('PTW_hf_l', xml(name))}</style:header-left>`
      : `<style:header>${hfPara('PTW_hf_r', xml(name))}</style:header>`;
  const masters = sections.map((sec, i) => {
    const running = s.runningHeader ? header(sec.bookName) : '';
    const master = `<style:master-page style:name="PTW_book_${i}" style:page-layout-name="${s.runningHeader ? 'PTW_pm_h' : 'PTW_pm'}">${running}${footer}</style:master-page>`;
    // like the PDF, the very first page has no running header
    if (i > 0 || !s.runningHeader) return master;
    return `<style:master-page style:name="PTW_first" style:page-layout-name="PTW_pm" style:next-style-name="PTW_book_0">${footer}</style:master-page>\n  ${master}`;
  });

  const para = (name: string, display: string, text: string, paragraph: string, extra = '') =>
    `<style:style style:name="${name}" style:display-name="${display}" style:family="paragraph" style:parent-style-name="PTW_text"${extra}>
   <style:paragraph-properties ${paragraph}/>
   <style:text-properties ${text}/>
  </style:style>`;
  const span = (name: string, display: string, text: string) =>
    `<style:style style:name="${name}" style:display-name="${display}" style:family="text"><style:text-properties ${text}/></style:style>`;
  const block = (above: number, below: number, align = 'start') =>
    `fo:margin-top="${em(above)}" fo:margin-bottom="${em(below)}" fo:keep-with-next="always" fo:text-align="${align}"`;
  const hfont = `style:font-name="${xml(s.headingFont)}"`;
  const indent = (level: number) => `fo:margin-left="${em((level + 1) * 1.2)}" fo:text-indent="${em(-1.2)}" fo:text-align="start"`;

  // LibreOffice only applies its built-in names to note marks
  const noteMarks = [
    ['Footnote_20_Symbol', 'Footnote Symbol'],
    ['Footnote_20_anchor', 'Footnote anchor'],
    ['Endnote_20_Symbol', 'Endnote Symbol'],
    ['Endnote_20_anchor', 'Endnote anchor'],
  ];
  const verseText = {
    super: `style:text-position="super 58%" fo:color="${verse}"`,
    inline: `fo:font-size="78%" fo:font-weight="bold" fo:color="${verse}"`,
    bold: `fo:font-weight="bold" fo:color="${verse}"`,
    none: '',
  }[s.verseStyle];

  return `${HEAD}<office:document-styles ${NS}>
 <office:font-face-decls>
  ${fonts.map((f) => `<style:font-face style:name="${xml(f)}" svg:font-family="'${xml(f)}'" style:font-family-generic="${generic(f)}" style:font-pitch="variable"/>`).join('\n  ')}
 </office:font-face-decls>
 <office:styles>
  <style:default-style style:family="paragraph">
   <style:paragraph-properties fo:hyphenation-ladder-count="no-limit" style:writing-mode="lr-tb"/>
   <style:text-properties style:font-name="${xml(s.font)}" fo:font-size="${pt(fs)}" fo:color="${color(s.textColor)}"
    fo:language="${lang}" fo:country="${country}" fo:hyphenate="${s.hyphenate}" fo:hyphenation-remain-char-count="2" fo:hyphenation-push-char-count="2"/>
  </style:default-style>
  <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
  ${para(
    'PTW_text',
    'Bibeltext',
    '',
    // Typst's leading is the gap between lines (measured from cap height); ~0.7em is the line itself
    `style:line-height-at-least="${em(0.7 + lead)}" fo:margin-top="0pt" fo:margin-bottom="${em(num(s.paragraphSpacing, 0.65))}" fo:text-indent="0pt"` +
      ` fo:text-align="${s.justify ? 'justify' : 'start'}" style:justify-single-word="false" fo:orphans="2" fo:widows="2"`,
  ).replace(' style:parent-style-name="PTW_text"', ' style:parent-style-name="Standard" style:class="text"')}
  ${para('Heading_20_1', 'Heading 1', `${hfont} fo:font-size="190%" fo:font-weight="bold" fo:color="${head}" fo:hyphenate="false"`, block(0, 1.5, 'center'), ' style:default-outline-level="1" style:class="text"')}
  ${para('Heading_20_2', 'Heading 2', `${hfont} fo:font-size="120%" fo:font-weight="bold" fo:color="${chap}" fo:hyphenate="false"`, block(1.4, 0.7), ' style:default-outline-level="2" style:class="text"')}
  ${para('PTW_ms', 'Hauptüberschrift', `${hfont} fo:font-size="115%" fo:font-weight="bold" fo:color="${head}"`, block(1.6, 0.8, 'center'))}
  ${para('PTW_s1', 'Zwischenüberschrift', `${hfont} fo:font-weight="bold" fo:color="${head}"`, block(1.3, 0.6))}
  ${para('PTW_s2', 'Zwischenüberschrift 2', `${hfont} fo:font-style="italic" fo:color="${head}"`, block(1, 0.5))}
  ${para('PTW_r', 'Parallelstellen', 'fo:font-size="85%" fo:font-style="italic" fo:color="#646464"', block(0.3, 0.6))}
  ${para('PTW_d', 'Psalmüberschrift', 'fo:font-size="90%" fo:font-style="italic"', block(0.6, 0.6))}
  ${para('PTW_qa', 'Akrostichon', `fo:font-variant="small-caps" fo:color="${head}"`, block(0.8, 0.4))}
  ${para('PTW_sp', 'Sprecher', 'fo:font-style="italic"', block(0.6, 0.3))}
  ${para('PTW_q1', 'Poesie 1', '', `${indent(0)} fo:margin-bottom="${em(lead)}"`)}
  ${para('PTW_q2', 'Poesie 2', '', `${indent(1)} fo:margin-bottom="${em(lead)}"`)}
  ${para('PTW_q3', 'Poesie 3', '', `${indent(2)} fo:margin-bottom="${em(lead)}"`)}
  ${para('PTW_pi', 'Eingerückt', '', `fo:margin-left="${em(1.2)}"`)}
  ${para('PTW_pc', 'Zentriert', '', 'fo:text-align="center"')}
  ${para('PTW_qr', 'Rechtsbündig', '', 'fo:text-align="end"')}
  ${para('PTW_legend', 'Legende', '', 'fo:text-align="start" fo:line-height="150%"')}
  ${para('PTW_legend_page', 'Legende auf eigener Seite', `${hfont} fo:font-size="140%" fo:font-weight="bold" fo:color="${head}"`, `${block(0, 1.2)} fo:break-before="page"`)}
  ${para('PTW_b', 'Leerzeile', 'fo:font-size="50%"', `fo:line-height="${em(lead)}" fo:margin-top="0pt" fo:margin-bottom="0pt"`)}
  ${para('Footnote', 'Footnote', 'fo:font-size="80%" fo:hyphenate="false"', `fo:text-align="start" fo:margin-bottom="${em(0.2)}" fo:margin-left="${em(0.8)}" fo:text-indent="${em(-0.8)}"`, ' style:class="extra"')}
  ${para('Endnote', 'Endnote', 'fo:font-size="85%" fo:hyphenate="false"', `fo:text-align="start" fo:margin-bottom="${em(0.3)}" fo:margin-left="${em(1)}" fo:text-indent="${em(-1)}"`, ' style:class="extra"')}
  ${para('PTW_hf_l', 'Kopf-/Fußzeile links', `${hfont} fo:font-size="80%" fo:color="#6e6e6e"`, 'fo:text-align="start" fo:margin-bottom="0pt"')}
  ${para('PTW_hf_c', 'Kopf-/Fußzeile mittig', `${hfont} fo:font-size="80%" fo:color="#6e6e6e"`, 'fo:text-align="center" fo:margin-bottom="0pt"')}
  ${para('PTW_hf_r', 'Kopf-/Fußzeile rechts', `${hfont} fo:font-size="80%" fo:color="#6e6e6e"`, 'fo:text-align="end" fo:margin-bottom="0pt"')}
  ${span('PTW_verse', 'Versnummer', verseText)}
  ${span('PTW_chapcap', 'Kapitelinitiale', `${hfont} fo:font-weight="bold" fo:color="${chap}"`)}
  ${span('PTW_chapnum', 'Kapitelnummer', `${hfont} fo:font-size="150%" fo:font-weight="bold" fo:color="${chap}"`)}
  ${span('PTW_wj', 'Worte Jesu', s.wordsOfJesusRed ? `fo:color="${color(s.wjColor)}"` : '')}
  ${span('PTW_nd', 'Gottesname', 'fo:font-variant="small-caps"')}
  ${span('PTW_add', 'Ergänzung', 'fo:font-style="italic"')}
  ${span('PTW_it', 'Kursiv', 'fo:font-style="italic"')}
  ${span('PTW_bd', 'Fett', 'fo:font-weight="bold"')}
  ${span('PTW_count', 'Anzahl', 'fo:font-size="85%" fo:color="#6e6e6e"')}
  ${s.marks.map((m, i) => span(`PTW_mk${i}`, `Markierung ${i + 1}`, markText(m))).join('\n  ')}
  ${noteMarks.map(([name, display]) => span(name, display, `style:text-position="super 58%" fo:color="${verse}"`)).join('\n  ')}
  <text:notes-configuration text:note-class="footnote" style:num-format="a" text:start-value="0" text:footnotes-position="page" text:start-numbering-at="document"
   text:default-style-name="Footnote" text:citation-style-name="Footnote_20_Symbol" text:citation-body-style-name="Footnote_20_anchor"/>
  <text:notes-configuration text:note-class="endnote" style:num-format="a" text:start-value="0"
   text:default-style-name="Endnote" text:citation-style-name="Endnote_20_Symbol" text:citation-body-style-name="Endnote_20_anchor"/>
 </office:styles>
 <office:automatic-styles>
  ${layout('PTW_pm', false)}
  ${layout('PTW_pm_h', s.runningHeader)}
 </office:automatic-styles>
 <office:master-styles>
  ${masters.join('\n  ')}
 </office:master-styles>
</office:document-styles>
`;
}

const HEADING_STYLE: Record<HeadingKind, string> = { ms: 'PTW_ms', s1: 'PTW_s1', s2: 'PTW_s2', r: 'PTW_r', d: 'PTW_d', qa: 'PTW_qa', sp: 'PTW_sp' };
const PARA_STYLE: Record<string, string> = {
  q1: 'PTW_q1', li1: 'PTW_q1', q2: 'PTW_q2', li2: 'PTW_q2', q3: 'PTW_q3', pi: 'PTW_pi', pc: 'PTW_pc', qr: 'PTW_qr',
};

class ContentWriter {
  private body: string[] = [];
  /** automatic paragraph styles, keyed by their definition */
  private auto = new Map<string, string>();
  private columnStyle?: string;
  private noteCount = 0;
  private sectionCount = 0;
  private input: DocumentInput;
  private s: LayoutSettings;
  private lang: 'de' | 'en';
  // state while writing a section
  private master?: string;
  private chapter = 0;
  private verse = 0;
  private rules: MarkRules;

  constructor(input: DocumentInput) {
    this.input = input;
    this.s = input.settings;
    this.rules = compileMarks(this.s.marks);
    this.lang = input.translation.lang;
    const cols = columnCount(this.s);
    if (cols > 1) {
      const gap = num(this.s.columnGap, 7);
      const sep = this.s.columnRule
        ? '<style:column-sep style:width="0.4pt" style:color="#aaaaaa" style:height="100%" style:vertical-align="top"/>'
        : '';
      this.columnStyle = 'PTW_cols';
      this.auto.set(
        'cols',
        `<style:style style:name="PTW_cols" style:family="section"><style:section-properties text:dont-balance-text-columns="false">
   <style:columns fo:column-count="${cols}" fo:column-gap="${mm(gap)}">${sep}</style:columns>
  </style:section-properties></style:style>`,
      );
    }
  }

  /** Name of an automatic style deriving from `parent` with a master page and/or a drop cap. */
  private styleFor(parent: string, master?: string, dropcap?: number): string {
    if (!master && !dropcap) return parent;
    const key = `${parent}|${master ?? ''}|${dropcap ?? ''}`;
    const existing = this.auto.get(key);
    if (existing) return existing.match(/style:name="([^"]+)"/)![1];
    const name = `P${this.auto.size + 1}`;
    const props = dropcap
      ? `<style:paragraph-properties><style:drop-cap style:length="${dropcap}" style:lines="2" style:distance="${pt(num(this.s.fontSize, 11) * 0.35)}" style:style-name="PTW_chapcap"/></style:paragraph-properties>`
      : '';
    this.auto.set(
      key,
      `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="${parent}"${master ? ` style:master-page-name="${master}"` : ''}>${props}</style:style>`,
    );
    return name;
  }

  /** Adds a paragraph; the first paragraph of a section switches to its master page. */
  private para(style: string, content: string, opts: { heading?: number; dropcap?: number } = {}) {
    const name = this.styleFor(style, this.master, opts.dropcap);
    this.master = undefined;
    if (opts.heading) this.body.push(`<text:h text:style-name="${name}" text:outline-level="${opts.heading}">${content}</text:h>`);
    else this.body.push(`<text:p text:style-name="${name}">${content}</text:p>`);
  }

  section(section: Section, i: number) {
    const { s } = this;
    this.master = i === 0 && s.runningHeader ? 'PTW_first' : `PTW_book_${i}`;
    if (s.showBookTitle) this.para('Heading_20_1', xml(section.title), { heading: 1 });
    const cols = this.columnStyle;
    if (cols) this.body.push(`<text:section text:style-name="${cols}" text:name="Text${++this.sectionCount}">`);
    for (const ch of section.chapters) this.chapterContent(section, ch);
    if (cols) {
      // an empty section can't hold the master page switch of the next book
      if (this.master) this.para('PTW_text', '');
      this.body.push('</text:section>');
    }
  }

  private chapterContent(section: Section, ch: SelectedChapter) {
    const { s } = this;
    this.chapter = ch.n;
    const style = chapterStyleFor(section, ch, s);
    if (style === 'heading') this.para('Heading_20_2', xml(chapterHeading(section, ch.n, s, this.lang)), { heading: 2 });

    let pendingCap = style === 'dropcap' || style === 'margin' ? ch.n : undefined;
    for (const b of markBlocks(reflowVerses(visibleBlocks(ch.blocks, s), s), this.rules)) {
      if ('h' in b) {
        this.para(HEADING_STYLE[b.h], this.inlines(b.c, false));
        continue;
      }
      if (b.p === 'b') {
        this.para('PTW_b', '');
        continue;
      }
      const paraStyle = PARA_STYLE[b.p] ?? 'PTW_text';
      if (pendingCap === undefined) {
        this.para(paraStyle, this.inlines(b.c, false));
        continue;
      }
      const n = String(pendingCap);
      pendingCap = undefined;
      if (style === 'dropcap') {
        this.para(paraStyle, n + this.inlines(b.c, ch.fromStart), { dropcap: n.length });
      } else {
        this.para(paraStyle, `<text:span text:style-name="PTW_chapnum">${n}</text:span> ` + this.inlines(b.c, false));
      }
    }
  }

  private inlines(c: Inline[], suppressFirstVerse: boolean): string {
    const { s } = this;
    let out = '';
    let first = true;
    for (const x of c) {
      if (typeof x === 'string') out += xml(x.replace(/\s+/g, ' '));
      else if ('v' in x) {
        this.verse = x.v;
        if (out && !/\s$/.test(out)) out += ' ';
        if (!(first && suppressFirstVerse) && s.verseStyle !== 'none') {
          out += `<text:span text:style-name="PTW_verse">${x.v}</text:span>${s.verseStyle === 'super' ? ' ' : ' '}`;
        }
        first = false;
      } else if ('s' in x) {
        const styled = `<text:span text:style-name="PTW_${x.s}">${xml(x.t)}</text:span>`;
        out += x.m === undefined ? styled : `<text:span text:style-name="PTW_mk${x.m}">${styled}</text:span>`;
      } else if ('m' in x) {
        out += `<text:span text:style-name="PTW_mk${x.m}">${xml(x.t.replace(/\s+/g, ' '))}</text:span>`;
      } else if ('f' in x) {
        out += this.note(x.f);
      }
    }
    return out.trim();
  }

  private note(text: string): string {
    const mode = this.s.footnotes;
    if (mode === 'none') return '';
    const n = ++this.noteCount;
    const cls = mode === 'page' ? 'footnote' : 'endnote';
    // endnotes are far from their verse: name it, as in the PDF
    const ref =
      mode === 'end'
        ? `<text:span text:style-name="PTW_bd">${xml(`${this.chapter}${LABELS[this.lang].sep}${this.verse}`)}</text:span> `
        : '';
    return `<text:note text:id="n${n}" text:note-class="${cls}"><text:note-citation>${alpha(n)}</text:note-citation><text:note-body><text:p text:style-name="${cls === 'footnote' ? 'Footnote' : 'Endnote'}">${ref}${xml(text)}</text:p></text:note-body></text:note>`;
  }

  /** Legend of the mark rules at the end of the document. */
  legend() {
    const counts = this.input.markCounts;
    const items = this.s.marks.flatMap((m, i) => {
      if (!this.rules[i]) return [];
      const count = this.s.markCounts ? ` <text:span text:style-name="PTW_count">(${counts[i] ?? 0}×)</text:span>` : '';
      return [`<text:span text:style-name="PTW_mk${i}">${xml(markLabel(m))}</text:span>${count}`];
    });
    if (!items.length) return;
    const title = xml(LABELS[this.lang].legend);
    if (this.s.markLegendPage) {
      this.para('PTW_legend_page', title);
      for (const item of items) this.para('PTW_legend', item);
      return;
    }
    this.para('PTW_s1', title);
    this.para('PTW_legend', items.join('<text:tab/>'));
  }

  xml(): string {
    return `${HEAD}<office:document-content ${NS}>
 <office:automatic-styles>
  ${[...this.auto.values()].join('\n  ')}
 </office:automatic-styles>
 <office:body><office:text>
${this.body.join('\n')}
 </office:text></office:body>
</office:document-content>
`;
  }
}
