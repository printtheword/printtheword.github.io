import { describe, expect, it } from 'vitest';
import { bibleserverUrl } from './bibleserver.ts';
import { parseReference, resolveRanges } from './reference.ts';
import type { Translation, TranslationIndex } from './types.ts';

const index: TranslationIndex = {
  id: 'test',
  books: [
    { id: 'GEN', name: '1. Mose', title: '', verses: [31, 25, 24, 26] },
    { id: 'GAL', name: 'Galater', title: '', verses: [24, 21, 29, 31, 26, 18] },
    { id: 'EPH', name: 'Epheser', title: '', verses: [23, 22, 21, 32, 33, 24] },
    { id: 'ROM', name: 'Römer', title: '', verses: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27] },
    { id: 'SNG', name: 'Hoheslied', title: '', verses: [17, 17, 11, 16, 16, 13, 13, 14] },
  ],
};

const translation = (id: string, lang: 'de' | 'en' = 'de') => ({ id, lang }) as Translation;

const url = (ref: string, t = translation('deuelo')) => {
  const [range] = resolveRanges(parseReference(ref), index);
  return bibleserverUrl(range, index.books.find((b) => b.id === range.book)!.verses, t);
};

describe('bibleserverUrl', () => {
  it.each([
    ['Epheser 1', 'ELB/Epheser1'],
    ['Galater 1,12-17', 'ELB/Galater1,12-17'],
    ['Gal 1,3', 'ELB/Galater1,3'],
    ['1. Mose 2-3', 'ELB/1.Mose2-3'],
    ['1. Mose 1,5-2,3', 'ELB/1.Mose1,5-2,3'],
    ['Römer', 'ELB/R%C3%B6mer1'],
  ])('%s → %s', (ref, path) => expect(url(ref)).toBe(`https://www.bibleserver.com/${path}`));

  it('maps translations and falls back by language', () => {
    expect(url('Eph 1', translation('deu1912'))).toBe('https://www.bibleserver.com/LUT/Epheser1');
    expect(url('Eph 1', translation('unknown'))).toBe('https://www.bibleserver.com/LUT/Epheser1');
    expect(url('Eph 1', translation('unknown', 'en'))).toBe('https://www.bibleserver.com/ESV/Ephesians1');
  });

  it('uses English book names for English translations', () => {
    expect(url('Eph 1,3', translation('eng-kjv2006', 'en'))).toBe('https://www.bibleserver.com/KJV/Ephesians1,3');
    expect(url('1. Mose 2', translation('engbsb', 'en'))).toBe('https://www.bibleserver.com/ESV/Genesis2');
    expect(url('Hoheslied 2', translation('eng-asv', 'en'))).toBe('https://www.bibleserver.com/KJV/Song2');
  });
});
