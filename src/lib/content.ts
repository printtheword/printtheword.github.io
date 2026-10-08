import type { SelectedChapter } from './select.ts';
import type { ChapterStyle, LayoutSettings } from './settings.ts';
import type { Block, Inline } from './types.ts';
import type { Section } from '../typst/generate.ts';

/** Content decisions shared by the PDF (Typst) and ODT generators. */

export const LABELS = {
  de: { chapter: 'Kapitel', psalm: 'Psalm', notes: 'Anmerkungen', sep: ',' },
  en: { chapter: 'Chapter', psalm: 'Psalm', notes: 'Notes', sep: ':' },
};

/** Chapter number style for one chapter of a section. */
export function chapterStyleFor(section: Section, ch: SelectedChapter, s: LayoutSettings): ChapterStyle {
  // books with a single chapter don't need a chapter number
  if (section.chapters.length === 1 && /^(OBA|PHM|2JN|3JN|JUD)$/.test(section.bookId)) return 'none';
  // a selection starting mid-chapter already names the chapter in its title
  if (!ch.fromStart && s.showBookTitle) return 'none';
  return s.chapterStyle;
}

/** Text of a chapter heading line, e.g. "Kapitel 3", "Psalm 23" or "3". */
export function chapterHeading(section: Section, n: number, s: LayoutSettings, lang: 'de' | 'en'): string {
  const labels = LABELS[lang];
  return s.chapterLabel ? `${section.bookId === 'PSA' ? labels.psalm : labels.chapter} ${n}` : `${n}`;
}

/** Drops section headings when they are switched off (psalm titles are part of the text and always kept). */
export function visibleBlocks(blocks: Block[], s: LayoutSettings): Block[] {
  return blocks.filter((b) => ('h' in b ? b.h === 'd' || s.showHeadings : true));
}

type Para = { kind: Block extends infer B ? (B extends { p: infer K } ? K : never) : never; c: Inline[] };

/** Optionally starts a new paragraph with every verse (poetry lines of one verse are joined). */
export function reflowVerses(blocks: Block[], s: LayoutSettings): Block[] {
  if (!s.versePerLine) return blocks;
  const out: Block[] = [];
  let para: Para | undefined;
  const flush = () => {
    if (para && para.c.length) out.push({ p: para.kind, c: para.c });
    para = undefined;
  };
  for (const b of blocks) {
    if ('h' in b) {
      flush();
      out.push(b);
      continue;
    }
    if (b.p === 'b') continue;
    for (const x of b.c) {
      if (typeof x === 'object' && 'v' in x) flush();
      if (!para) para = { kind: 'm', c: [] };
      const prev = para.c[para.c.length - 1];
      if (para.c.length && typeof x === 'string' && typeof prev === 'string') para.c[para.c.length - 1] = prev + x;
      else para.c.push(x);
    }
    // poetry lines: keep a space between joined lines
    if (para) para.c.push(' ');
  }
  flush();
  return out;
}
