import { BOOK_BY_ID } from './books.ts';
import type { Range } from './reference.ts';
import type { Translation } from './types.ts';

/** Closest translation on bibleserver.com for each of ours. */
const TRANSLATIONS: Record<string, string> = {
  deu1912: 'LUT',
  deuelo: 'ELB',
  deutkw: 'LUT',
  deu1951: 'SLT',
  'eng-kjv2006': 'KJV',
  'eng-asv': 'KJV',
  engbsb: 'ESV',
  engwebp: 'ESV',
};

/** Book names bibleserver.com spells differently from ours. */
const NAMES: Record<string, string> = { SongofSongs: 'Song' };

/** Link to the range on bibleserver.com, e.g. "https://www.bibleserver.com/ELB/Galater1,12-17". */
export function bibleserverUrl(r: Range, verses: number[], translation: Translation): string {
  const version = TRANSLATIONS[translation.id] ?? (translation.lang === 'de' ? 'LUT' : 'ESV');
  // bibleserver only understands English book names for English translations
  const name = (BOOK_BY_ID.get(r.book)?.[translation.lang] ?? r.book).replace(/\s+/g, '');
  const book = NAMES[name] ?? name;
  const wholeFrom = r.from.v === 1;
  const wholeTo = r.to.v === verses[r.to.c - 1];
  let spec: string;
  if (wholeFrom && wholeTo) spec = r.from.c === r.to.c ? `${r.from.c}` : `${r.from.c}-${r.to.c}`;
  else if (r.from.c === r.to.c) spec = r.from.v === r.to.v ? `${r.from.c},${r.from.v}` : `${r.from.c},${r.from.v}-${r.to.v}`;
  else spec = `${r.from.c},${r.from.v}-${r.to.c},${r.to.v}`;
  // a whole book has no page of its own – show its first chapter
  if (wholeFrom && wholeTo && r.from.c === 1 && r.to.c === verses.length) spec = '1';
  return `https://www.bibleserver.com/${version}/${encodeURIComponent(book)}${spec}`;
}
