import { BOOK_BY_ID } from './books.ts';
import { formatRange, type Range } from './reference.ts';
import { selectRange, type SelectedChapter } from './select.ts';
import type { Block, BookData, Translation, TranslationIndex } from './types.ts';
import type { LayoutSettings } from './settings.ts';
import { pageSize, type DocumentInput, type Section } from '../typst/generate.ts';

/** Combines ranges, book data and settings into the input of the Typst generator. */
export function buildDocument(
  translation: Translation,
  index: TranslationIndex,
  ranges: Range[],
  books: Map<string, BookData>,
  settings: LayoutSettings,
): DocumentInput {
  const sep = translation.lang === 'de' ? ',' : ':';
  const labels: string[] = [];
  const sections: Section[] = ranges.map((range) => {
    const book = books.get(range.book)!;
    const info = index.books.find((b) => b.id === range.book)!;
    const name = book.name || BOOK_BY_ID.get(range.book)![translation.lang];
    // "Psalm 23" rather than "Psalmen 23" for a single psalm
    const single = range.from.c === range.to.c && range.book === 'PSA';
    const label = formatRange(range, single ? BOOK_BY_ID.get('PSA')![translation.lang].replace(/s$/, '') : name, info.verses, sep);
    labels.push(label);
    const wholeBook = label === name;
    return { bookId: range.book, bookName: name, title: wholeBook ? book.title || name : label, chapters: selectRange(book, range) };
  });
  return { translation, label: labels.join('; '), sections, settings };
}

/** File name for the PDF, e.g. "Galater_1_12-17_Luther_1912.pdf". */
export function fileName(label: string, translation: Translation): string {
  const clean = (s: string) =>
    s.replace(/[–—]/g, '-').replace(/[,:;.\s]+/g, '_').replace(/[^\p{L}\p{N}_-]/gu, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `${clean(label)}_${clean(translation.short)}.pdf`;
}

const blockChars = (b: Block) => b.c.reduce((n, x) => n + (typeof x === 'string' ? x.length : 't' in x ? x.t.length : 3), 0);

/** Rough number of characters that fit on one page with the given layout. */
export function charsPerPage(s: LayoutSettings): number {
  const [w, h] = pageSize(s);
  const notes = s.notesArea !== 'none' ? s.notesWidth : 0;
  const textW = Math.max(20, w - s.marginInner - s.marginOuter - notes - (s.columns - 1) * s.columnGap);
  const textH = Math.max(20, h - s.marginTop - s.marginBottom);
  const em = s.fontSize * 0.3528; // pt → mm
  return (textW / (0.48 * em)) * (textH / ((1 + s.lineSpacing) * em));
}

/** Shortens the document to roughly `maxChars` characters (for a fast preview). */
export function truncateDocument(doc: DocumentInput, maxChars: number): { doc: DocumentInput; truncated: boolean } {
  let budget = maxChars;
  const sections: Section[] = [];
  for (const section of doc.sections) {
    if (budget <= 0) return { doc: { ...doc, sections }, truncated: true };
    const chapters: SelectedChapter[] = [];
    for (const ch of section.chapters) {
      if (budget <= 0) break;
      const blocks: Block[] = [];
      for (const b of ch.blocks) {
        if (budget <= 0) break;
        blocks.push(b);
        budget -= blockChars(b);
      }
      chapters.push({ ...ch, blocks });
    }
    sections.push({ ...section, chapters });
  }
  return { doc: { ...doc, sections }, truncated: budget <= 0 };
}
