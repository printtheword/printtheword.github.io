/** Inline content of a paragraph or heading. */
export type Inline =
  | string
  /** verse marker – the following inlines belong to this verse */
  | { v: number }
  /** styled text: wj = words of Jesus, nd = divine name (small caps), add = added words (italic) */
  | { s: 'wj' | 'nd' | 'add' | 'it' | 'bd'; t: string }
  /** footnote */
  | { f: string };

export type HeadingKind = 'ms' | 's1' | 's2' | 'r' | 'd' | 'qa' | 'sp';
export type ParaKind = 'p' | 'm' | 'pi' | 'pc' | 'q1' | 'q2' | 'q3' | 'qr' | 'li1' | 'li2' | 'b';

export type Block = { h: HeadingKind; c: Inline[] } | { p: ParaKind; c: Inline[] };

export interface Chapter {
  n: number;
  blocks: Block[];
}

export interface BookData {
  id: string;
  name: string;
  title: string;
  chapters: Chapter[];
}

export interface BookIndex {
  id: string;
  /** short name as used by the translation, e.g. "1. Mose" */
  name: string;
  /** long title, e.g. "Das 1. Buch Mose (Genesis)" */
  title: string;
  /** number of verses per chapter */
  verses: number[];
}

export interface TranslationIndex {
  id: string;
  books: BookIndex[];
}

export interface Translation {
  id: string;
  name: string;
  short: string;
  lang: 'de' | 'en';
  year: string;
  license: string;
  source: string;
  features: { headings: boolean; footnotes: boolean; wordsOfJesus: boolean };
}
