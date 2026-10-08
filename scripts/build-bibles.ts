/**
 * Downloads public-domain Bible translations (USFM) from eBible.org and converts them
 * into per-book JSON files under public/bibles/<id>/.
 *
 *   npm run build:bibles            # all translations
 *   npm run build:bibles -- deu1912 # only selected ones
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { BOOK_IDS } from '../src/lib/books.ts';
import { parseUsfm, verseCounts } from '../src/lib/usfm.ts';
import type { Block, BookIndex, Translation, TranslationIndex } from '../src/lib/types.ts';

type Source = Omit<Translation, 'features'>;

const TRANSLATIONS: Source[] = [
  {
    id: 'deu1951', name: 'Schlachter-Bibel 1951', short: 'Schlachter 1951', lang: 'de', year: '1951',
    license: 'Copyright © 1951 Genfer Bibelgesellschaft, Lizenz CC BY 4.0 (creativecommons.org/licenses/by/4.0)',
    source: 'https://ebible.org/find/details.php?id=deu1951',
    attribution: 'Schlachter-Bibel 1951, © 1951 Genfer Bibelgesellschaft, CC BY 4.0, Quelle: eBible.org',
  },
  {
    id: 'deu1912', name: 'Lutherbibel 1912', short: 'Luther 1912', lang: 'de', year: '1912',
    license: 'Gemeinfrei (Public Domain)', source: 'https://ebible.org/find/details.php?id=deu1912',
  },
  {
    id: 'deuelo', name: 'Unrevidierte Elberfelder 1905', short: 'Elberfelder 1905', lang: 'de', year: '1905',
    license: 'Gemeinfrei (Public Domain)', source: 'https://ebible.org/find/details.php?id=deuelo',
  },
  {
    id: 'deutkw', name: 'Textbibel von Kautzsch und Weizsäcker 1906', short: 'Textbibel 1906', lang: 'de', year: '1906',
    license: 'Gemeinfrei (Public Domain)', source: 'https://ebible.org/find/details.php?id=deutkw',
  },
  {
    id: 'engbsb', name: 'Berean Standard Bible', short: 'BSB', lang: 'en', year: '2020',
    license: 'Public Domain (dedicated to the public domain by the Berean Bible translation committee)',
    source: 'https://ebible.org/find/details.php?id=engbsb',
  },
  {
    id: 'engwebp', name: 'World English Bible', short: 'WEB', lang: 'en', year: '2020',
    license: 'Public Domain. "World English Bible" is a trademark of eBible.org.',
    source: 'https://ebible.org/find/details.php?id=engwebp',
  },
  {
    id: 'eng-kjv2006', name: 'King James Version', short: 'KJV', lang: 'en', year: '1769',
    license: 'Public Domain (outside the United Kingdom; in the UK the KJV is subject to Crown patent).',
    source: 'https://ebible.org/find/details.php?id=eng-kjv2006',
  },
  {
    id: 'eng-asv', name: 'American Standard Version', short: 'ASV', lang: 'en', year: '1901',
    license: 'Public Domain', source: 'https://ebible.org/find/details.php?id=eng-asv',
  },
];

/** typos in the source files */
const NAME_FIXES: Record<string, string> = { '1. Chonik': '1. Chronik' };

const ROOT = join(import.meta.dirname, '..');
const CACHE = join(ROOT, '.cache', 'usfm');
const OUT = join(ROOT, 'public', 'bibles');

async function download(id: string): Promise<Uint8Array> {
  const file = join(CACHE, `${id}_usfm.zip`);
  if (existsSync(file)) return new Uint8Array(await readFile(file));
  const url = `https://eBible.org/Scriptures/${id}_usfm.zip`;
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const data = new Uint8Array(await res.arrayBuffer());
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, data);
  return data;
}

const has = (blocks: Block[], pred: (b: Block) => boolean) => blocks.some(pred);

async function build(t: Source): Promise<Translation> {
  console.log(`${t.id}: ${t.name}`);
  const files = unzipSync(await download(t.id));
  const dir = join(OUT, t.id);
  await mkdir(dir, { recursive: true });
  const index: TranslationIndex = { id: t.id, books: [] };
  const features = { headings: false, footnotes: false, wordsOfJesus: false };

  const books = Object.entries(files)
    .filter(([name]) => name.endsWith('.usfm'))
    .map(([, data]) => parseUsfm(strFromU8(data)))
    .filter((b) => BOOK_IDS.includes(b.id))
    .sort((a, b) => BOOK_IDS.indexOf(a.id) - BOOK_IDS.indexOf(b.id));

  for (const book of books) {
    const blocks = book.chapters.flatMap((c) => c.blocks);
    features.headings ||= has(blocks, (b) => 'h' in b && b.h !== 'd');
    features.footnotes ||= has(blocks, (b) => b.c.some((x) => typeof x === 'object' && 'f' in x));
    features.wordsOfJesus ||= has(blocks, (b) => b.c.some((x) => typeof x === 'object' && 's' in x && x.s === 'wj'));
    book.name = NAME_FIXES[book.name] ?? book.name;
    const entry: BookIndex = { id: book.id, name: book.name, title: book.title, verses: verseCounts(book) };
    index.books.push(entry);
    await writeFile(join(dir, `${book.id}.json`), JSON.stringify(book));
  }
  await writeFile(join(dir, 'index.json'), JSON.stringify(index));
  const verses = index.books.reduce((n, b) => n + b.verses.reduce((a, x) => a + x, 0), 0);
  console.log(`  ${index.books.length} books, ${verses} verses`, features);
  return { ...t, features };
}

const only = process.argv.slice(2);
const listFile = join(OUT, 'translations.json');
const existing: Translation[] = existsSync(listFile) ? JSON.parse(await readFile(listFile, 'utf8')) : [];
const result: Translation[] = [];
for (const t of TRANSLATIONS) {
  if (only.length && !only.includes(t.id)) {
    const prev = existing.find((e) => e.id === t.id);
    if (prev) result.push(prev);
    continue;
  }
  result.push(await build(t));
}
await writeFile(listFile, JSON.stringify(result, null, 2) + '\n');
