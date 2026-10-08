export interface BookInfo {
  id: string;
  de: string;
  en: string;
  /** additional names and abbreviations (any language) used for parsing */
  aliases: string[];
  testament: 'OT' | 'NT';
}

const b = (id: string, de: string, en: string, aliases: string[], testament: 'OT' | 'NT' = 'OT'): BookInfo => ({
  id,
  de,
  en,
  aliases,
  testament,
});

export const BOOKS: BookInfo[] = [
  b('GEN', '1. Mose', 'Genesis', ['1Mo', '1Mos', '1 Mose', 'Genesis', 'Gen', 'Gn']),
  b('EXO', '2. Mose', 'Exodus', ['2Mo', '2Mos', 'Exodus', 'Ex', 'Exo']),
  b('LEV', '3. Mose', 'Leviticus', ['3Mo', '3Mos', 'Levitikus', 'Lev', 'Lv']),
  b('NUM', '4. Mose', 'Numbers', ['4Mo', '4Mos', 'Numeri', 'Num', 'Nm']),
  b('DEU', '5. Mose', 'Deuteronomy', ['5Mo', '5Mos', 'Deuteronomium', 'Dtn', 'Deut', 'Dt']),
  b('JOS', 'Josua', 'Joshua', ['Jos', 'Josh']),
  b('JDG', 'Richter', 'Judges', ['Ri', 'Richt', 'Judg', 'Jdg']),
  b('RUT', 'Rut', 'Ruth', ['Rt', 'Ruth', 'Ru']),
  b('1SA', '1. Samuel', '1 Samuel', ['1Sam', '1Sa', '1Sm']),
  b('2SA', '2. Samuel', '2 Samuel', ['2Sam', '2Sa', '2Sm']),
  b('1KI', '1. Könige', '1 Kings', ['1Kön', '1Koe', '1Kon', '1Kö', '1Kgs', '1Ki', '1Kings']),
  b('2KI', '2. Könige', '2 Kings', ['2Kön', '2Koe', '2Kon', '2Kö', '2Kgs', '2Ki', '2Kings']),
  b('1CH', '1. Chronik', '1 Chronicles', ['1Chr', '1Ch', '1Chron', '1Chronika']),
  b('2CH', '2. Chronik', '2 Chronicles', ['2Chr', '2Ch', '2Chron', '2Chronika']),
  b('EZR', 'Esra', 'Ezra', ['Esr', 'Ezr']),
  b('NEH', 'Nehemia', 'Nehemiah', ['Neh']),
  b('EST', 'Ester', 'Esther', ['Est', 'Esth', 'Esther']),
  b('JOB', 'Hiob', 'Job', ['Hi', 'Hiob', 'Ijob', 'Job', 'Jb']),
  b('PSA', 'Psalm', 'Psalms', ['Ps', 'Psalmen', 'Psalm', 'Psa', 'Pss']),
  b('PRO', 'Sprüche', 'Proverbs', ['Spr', 'Sprueche', 'Prov', 'Pr', 'Prv']),
  b('ECC', 'Prediger', 'Ecclesiastes', ['Pred', 'Koh', 'Kohelet', 'Eccl', 'Ecc', 'Qoh']),
  b('SNG', 'Hoheslied', 'Song of Songs', ['Hld', 'Hohelied', 'Song', 'Song of Solomon', 'SoS', 'Cant']),
  b('ISA', 'Jesaja', 'Isaiah', ['Jes', 'Isa', 'Is']),
  b('JER', 'Jeremia', 'Jeremiah', ['Jer', 'Jr']),
  b('LAM', 'Klagelieder', 'Lamentations', ['Klgl', 'Klag', 'Lam', 'La']),
  b('EZK', 'Hesekiel', 'Ezekiel', ['Hes', 'Ez', 'Ezechiel', 'Ezek', 'Ezk']),
  b('DAN', 'Daniel', 'Daniel', ['Dan', 'Dn']),
  b('HOS', 'Hosea', 'Hosea', ['Hos', 'Hs']),
  b('JOL', 'Joel', 'Joel', ['Joe', 'Jl']),
  b('AMO', 'Amos', 'Amos', ['Am']),
  b('OBA', 'Obadja', 'Obadiah', ['Obd', 'Ob', 'Obad']),
  b('JON', 'Jona', 'Jonah', ['Jon', 'Jona']),
  b('MIC', 'Micha', 'Micah', ['Mi', 'Mic']),
  b('NAM', 'Nahum', 'Nahum', ['Nah', 'Na']),
  b('HAB', 'Habakuk', 'Habakkuk', ['Hab']),
  b('ZEP', 'Zefanja', 'Zephaniah', ['Zef', 'Zeph', 'Zephanja', 'Zep']),
  b('HAG', 'Haggai', 'Haggai', ['Hag', 'Hg']),
  b('ZEC', 'Sacharja', 'Zechariah', ['Sach', 'Zech', 'Zec']),
  b('MAL', 'Maleachi', 'Malachi', ['Mal']),
  b('MAT', 'Matthäus', 'Matthew', ['Mt', 'Matth', 'Matthaeus', 'Matt'], 'NT'),
  b('MRK', 'Markus', 'Mark', ['Mk', 'Mark', 'Mr', 'Mrk'], 'NT'),
  b('LUK', 'Lukas', 'Luke', ['Lk', 'Luk', 'Luke'], 'NT'),
  b('JHN', 'Johannes', 'John', ['Joh', 'Jn', 'Jhn', 'John'], 'NT'),
  b('ACT', 'Apostelgeschichte', 'Acts', ['Apg', 'Acts', 'Act'], 'NT'),
  b('ROM', 'Römer', 'Romans', ['Röm', 'Roem', 'Rom', 'Ro', 'Rm'], 'NT'),
  b('1CO', '1. Korinther', '1 Corinthians', ['1Kor', '1Ko', '1Cor', '1Co'], 'NT'),
  b('2CO', '2. Korinther', '2 Corinthians', ['2Kor', '2Ko', '2Cor', '2Co'], 'NT'),
  b('GAL', 'Galater', 'Galatians', ['Gal', 'Ga'], 'NT'),
  b('EPH', 'Epheser', 'Ephesians', ['Eph', 'Ep'], 'NT'),
  b('PHP', 'Philipper', 'Philippians', ['Phil', 'Php', 'Phlp'], 'NT'),
  b('COL', 'Kolosser', 'Colossians', ['Kol', 'Col'], 'NT'),
  b('1TH', '1. Thessalonicher', '1 Thessalonians', ['1Thess', '1Th', '1Ths'], 'NT'),
  b('2TH', '2. Thessalonicher', '2 Thessalonians', ['2Thess', '2Th', '2Ths'], 'NT'),
  b('1TI', '1. Timotheus', '1 Timothy', ['1Tim', '1Ti', '1Tm'], 'NT'),
  b('2TI', '2. Timotheus', '2 Timothy', ['2Tim', '2Ti', '2Tm'], 'NT'),
  b('TIT', 'Titus', 'Titus', ['Tit'], 'NT'),
  b('PHM', 'Philemon', 'Philemon', ['Phlm', 'Phm', 'Philem'], 'NT'),
  b('HEB', 'Hebräer', 'Hebrews', ['Hebr', 'Heb', 'Hbr'], 'NT'),
  b('JAS', 'Jakobus', 'James', ['Jak', 'Jas', 'Jm'], 'NT'),
  b('1PE', '1. Petrus', '1 Peter', ['1Petr', '1Pt', '1Pet', '1Pe'], 'NT'),
  b('2PE', '2. Petrus', '2 Peter', ['2Petr', '2Pt', '2Pet', '2Pe'], 'NT'),
  b('1JN', '1. Johannes', '1 John', ['1Joh', '1Jn', '1Jo'], 'NT'),
  b('2JN', '2. Johannes', '2 John', ['2Joh', '2Jn', '2Jo'], 'NT'),
  b('3JN', '3. Johannes', '3 John', ['3Joh', '3Jn', '3Jo'], 'NT'),
  b('JUD', 'Judas', 'Jude', ['Jud', 'Jd', 'Jude'], 'NT'),
  b('REV', 'Offenbarung', 'Revelation', ['Offb', 'Off', 'Apk', 'Rev', 'Rv', 'Apokalypse'], 'NT'),
];

export const BOOK_IDS = BOOKS.map((x) => x.id);
export const BOOK_BY_ID = new Map(BOOKS.map((x) => [x.id, x]));

const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3' };
const ORDINAL_WORDS: Record<string, string> = {
  erste: '1', ersten: '1', erstes: '1', first: '1',
  zweite: '2', zweiten: '2', zweites: '2', second: '2',
  dritte: '3', dritten: '3', drittes: '3', third: '3',
  vierte: '4', vierten: '4', fourth: '4',
  fünfte: '5', fünften: '5', fifth: '5',
};

/**
 * Normalizes a book name for lookup: lower case, no dots/spaces,
 * umlauts folded ("1. Könige" → "1konige", "I Kings" → "1kings").
 */
export function normalizeBookName(name: string): string {
  let s = name.trim().toLowerCase();
  s = s.replace(/^(i{1,3})[.\s]+(?=\p{L})/u, (_, r: string) => ROMAN[r] + ' ');
  s = s.replace(/^(\p{L}+)\s+/u, (m, w: string) => (ORDINAL_WORDS[w] ? ORDINAL_WORDS[w] + ' ' : m));
  s = s.replace(/^(\d)\s*(buch|book)\s+/u, '$1');
  s = s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
  s = s.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  return s.replace(/[\s.]+/g, '');
}

const LOOKUP = new Map<string, string>();
for (const book of BOOKS) {
  for (const n of [book.id, book.de, book.en, ...book.aliases]) {
    const key = normalizeBookName(n);
    if (!LOOKUP.has(key)) LOOKUP.set(key, book.id);
  }
}

/** Adds additional names (e.g. from a translation's index) to the lookup table. */
export function registerBookAlias(name: string, id: string) {
  const key = normalizeBookName(name);
  if (key && !LOOKUP.has(key)) LOOKUP.set(key, id);
}

/** Finds a book id by (abbreviated) name. Unique prefixes are accepted ("Phile" → PHM). */
export function findBook(name: string): string | undefined {
  const key = normalizeBookName(name);
  if (!key) return undefined;
  const exact = LOOKUP.get(key);
  if (exact) return exact;
  const candidates = new Set<string>();
  for (const [k, id] of LOOKUP) if (k.startsWith(key)) candidates.add(id);
  return candidates.size === 1 ? [...candidates][0] : undefined;
}

/** Suggestions for autocompletion. */
export function suggestBooks(prefix: string, lang: 'de' | 'en', limit = 8): BookInfo[] {
  const key = normalizeBookName(prefix);
  if (!key) return [];
  const hits: BookInfo[] = [];
  for (const book of BOOKS) {
    const names = [book[lang], book.de, book.en, ...book.aliases].map(normalizeBookName);
    if (names.some((n) => n.startsWith(key))) hits.push(book);
    if (hits.length >= limit) break;
  }
  return hits;
}
