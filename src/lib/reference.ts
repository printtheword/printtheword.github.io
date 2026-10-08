import { BOOK_BY_ID, findBook } from './books.ts';
import type { TranslationIndex } from './types.ts';

export interface VerseRef {
  c: number;
  /** undefined = start (for `from`) or end (for `to`) of the chapter */
  v?: number;
}

export interface ParsedRange {
  book: string;
  /** undefined = whole book */
  from?: VerseRef;
  to?: VerseRef;
}

export interface Range {
  book: string;
  from: { c: number; v: number };
  to: { c: number; v: number };
}

export class ReferenceError extends Error {}

const SPEC =
  /^(\d+)(?::(\d+)(ff|f)?)?(?:-(\d+)(?::(\d+))?)?$/;

/**
 * Parses a reference string such as "Epheser 1", "Gal 1,12-17", "Galater 1,12-1,17",
 * "Römer", "1. Mose 2-3", "John 3:16-18", "Joh 3,16f" or several parts separated by ";".
 * A part without a book name continues the previous book ("Eph 1; 3").
 */
export function parseReference(input: string): ParsedRange[] {
  const parts = input
    .replace(/[–—]/g, '-')
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new ReferenceError('Bitte eine Bibelstelle eingeben.');

  const result: ParsedRange[] = [];
  let lastBook: string | undefined;
  for (const part of parts) {
    const m = /^((?:[1-5I]{1,3}\.?\s*)?\p{L}[\p{L}\s.]*?)\.?\s*(\d.*)?$/u.exec(part);
    let book: string | undefined;
    let spec: string;
    if (m && /\p{L}/u.test(m[1])) {
      book = findBook(m[1]);
      if (!book) throw new ReferenceError(`Unbekanntes Buch: „${m[1].trim()}“`);
      spec = m[2] ?? '';
    } else {
      book = lastBook;
      if (!book) throw new ReferenceError(`Buch fehlt in „${part}“`);
      spec = part;
    }
    lastBook = book;
    for (const s of splitSpec(spec)) result.push({ book, ...parseSpec(s, part) });
  }
  return result;
}

/** Splits "3:16-18, 20" (English) into separate specs; German commas are chapter/verse separators. */
function splitSpec(spec: string): string[] {
  const s = spec.replace(/\s+/g, '');
  if (!s) return [''];
  if (s.includes(':')) {
    // English notation: "," separates verse lists – "3:16,18" → "3:16", "3:18"
    const out: string[] = [];
    let chapter = '';
    for (const item of s.split(',')) {
      if (item.includes(':')) {
        chapter = item.split(':')[0];
        out.push(item);
      } else if (chapter) out.push(`${chapter}:${item}`);
      else out.push(item);
    }
    return out;
  }
  // German notation: "1,12-2,3"; "." separates verse lists – "3,16.18" → "3,16", "3,18"
  const [first, ...more] = s.split('.').filter(Boolean);
  const chapter = first.includes(',') ? first.split(',')[0] : undefined;
  const out = [first.replace(/,/g, ':')];
  for (const item of more) out.push(chapter ? `${chapter}:${item.replace(/,/g, ':')}` : item.replace(/,/g, ':'));
  return out;
}

function parseSpec(spec: string, part: string): Omit<ParsedRange, 'book'> {
  if (!spec) return {};
  const m = SPEC.exec(spec);
  if (!m) throw new ReferenceError(`Stellenangabe nicht verstanden: „${part}“`);
  const [, c1, v1, suffix, n2, v2] = m;
  const from: VerseRef = { c: +c1, v: v1 ? +v1 : undefined };
  if (suffix) {
    if (n2) throw new ReferenceError(`Stellenangabe nicht verstanden: „${part}“`);
    // "f" = following verse, "ff" = to the end of the chapter
    return { from, to: { c: +c1, v: suffix === 'f' ? +v1 + 1 : undefined } };
  }
  if (!n2) return { from, to: { c: +c1, v: v1 ? +v1 : undefined } };
  if (v2) return { from, to: { c: +n2, v: +v2 } };
  // "1,12-17" → verse range within chapter; "2-3" → chapter range
  if (v1) return { from, to: { c: +c1, v: +n2 } };
  return { from, to: { c: +n2 } };
}

/** Validates parsed ranges against the translation's index and fills in missing verses. */
export function resolveRanges(parsed: ParsedRange[], index: TranslationIndex): Range[] {
  return parsed.map((p) => {
    const book = index.books.find((b) => b.id === p.book);
    const name = BOOK_BY_ID.get(p.book)?.de ?? p.book;
    if (!book) throw new ReferenceError(`${name} ist in dieser Übersetzung nicht enthalten.`);
    const chapters = book.verses.length;
    const from = p.from ?? { c: 1 };
    const to = p.to ?? { c: chapters };
    for (const ref of [from, to]) {
      if (ref.c < 1 || ref.c > chapters)
        throw new ReferenceError(`${name} hat nur ${chapters} Kapitel.`);
    }
    const fromV = from.v ?? 1;
    const toV = Math.min(to.v ?? book.verses[to.c - 1], book.verses[to.c - 1]);
    if (fromV < 1 || fromV > book.verses[from.c - 1])
      throw new ReferenceError(`${name} ${from.c} hat nur ${book.verses[from.c - 1]} Verse.`);
    if (to.v !== undefined && to.v > book.verses[to.c - 1] && to.v !== fromV + 1)
      throw new ReferenceError(`${name} ${to.c} hat nur ${book.verses[to.c - 1]} Verse.`);
    if (to.c < from.c || (to.c === from.c && toV < fromV))
      throw new ReferenceError(`Das Ende liegt vor dem Anfang: ${name} ${from.c},${fromV}–${to.c},${toV}`);
    return { book: p.book, from: { c: from.c, v: fromV }, to: { c: to.c, v: toV } };
  });
}

/** Human readable label, e.g. "Galater 1,12–17", "Römer", "1. Mose 2–3". */
export function formatRange(r: Range, bookName: string, verses: number[], sep = ','): string {
  const wholeFrom = r.from.v === 1;
  const wholeTo = r.to.v === verses[r.to.c - 1];
  if (wholeFrom && wholeTo) {
    if (r.from.c === 1 && r.to.c === verses.length) return bookName;
    if (r.from.c === r.to.c) return `${bookName} ${r.from.c}`;
    return `${bookName} ${r.from.c}–${r.to.c}`;
  }
  if (r.from.c === r.to.c) {
    if (r.from.v === r.to.v) return `${bookName} ${r.from.c}${sep}${r.from.v}`;
    return `${bookName} ${r.from.c}${sep}${r.from.v}–${r.to.v}`;
  }
  return `${bookName} ${r.from.c}${sep}${r.from.v}–${r.to.c}${sep}${r.to.v}`;
}
