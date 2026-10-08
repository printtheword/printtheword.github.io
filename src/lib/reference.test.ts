import { describe, expect, it } from 'vitest';
import { findBook } from './books.ts';
import { formatRange, parseReference, resolveRanges } from './reference.ts';
import type { TranslationIndex } from './types.ts';

const index: TranslationIndex = {
  id: 'test',
  books: [
    { id: 'GEN', name: '1. Mose', title: '', verses: [31, 25, 24, 26] },
    { id: 'GAL', name: 'Galater', title: '', verses: [24, 21, 29, 31, 26, 18] },
    { id: 'EPH', name: 'Epheser', title: '', verses: [23, 22, 21, 32, 33, 24] },
    { id: 'ROM', name: 'Römer', title: '', verses: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27] },
    { id: 'JHN', name: 'Johannes', title: '', verses: [51, 25, 36] },
  ],
};
const r = (s: string) => resolveRanges(parseReference(s), index);

describe('findBook', () => {
  it.each([
    ['Epheser', 'EPH'], ['Eph', 'EPH'], ['1. Mose', 'GEN'], ['1Mo', 'GEN'], ['1 mose', 'GEN'],
    ['Genesis', 'GEN'], ['Röm', 'ROM'], ['Roemer', 'ROM'], ['Romans', 'ROM'], ['1. Könige', '1KI'],
    ['1 Kings', '1KI'], ['I Kings', '1KI'], ['Joh', 'JHN'], ['1 Joh', '1JN'], ['John', 'JHN'],
    ['Phil', 'PHP'], ['Phile', 'PHM'], ['Psalm', 'PSA'], ['Ps', 'PSA'], ['Hoheslied', 'SNG'],
    ['Song of Songs', 'SNG'], ['Offb', 'REV'], ['Joel', 'JOL'], ['1. Samuel', '1SA'],
  ])('%s → %s', (name, id) => expect(findBook(name)).toBe(id));
  it('rejects unknown names', () => expect(findBook('Foo')).toBeUndefined());
});

describe('parse + resolve', () => {
  it('whole chapter', () => expect(r('Epheser 1')).toEqual([{ book: 'EPH', from: { c: 1, v: 1 }, to: { c: 1, v: 23 } }]));
  it('verse range with repeated chapter', () =>
    expect(r('Galater 1,12-1,17')).toEqual([{ book: 'GAL', from: { c: 1, v: 12 }, to: { c: 1, v: 17 } }]));
  it('short verse range', () => expect(r('Gal 1,12-17')).toEqual(r('Galater 1,12-1,17')));
  it('whole book', () => expect(r('Römer')).toEqual([{ book: 'ROM', from: { c: 1, v: 1 }, to: { c: 16, v: 27 } }]));
  it('chapter range', () => expect(r('1. Mose 2-3')).toEqual([{ book: 'GEN', from: { c: 2, v: 1 }, to: { c: 3, v: 24 } }]));
  it('cross chapter', () => expect(r('Gal 1,12-2,3')).toEqual([{ book: 'GAL', from: { c: 1, v: 12 }, to: { c: 2, v: 3 } }]));
  it('single verse', () => expect(r('Joh 3,16')).toEqual([{ book: 'JHN', from: { c: 3, v: 16 }, to: { c: 3, v: 16 } }]));
  it('english notation', () => expect(r('John 3:16-18')).toEqual([{ book: 'JHN', from: { c: 3, v: 16 }, to: { c: 3, v: 18 } }]));
  it('english verse list', () => expect(r('John 3:16,18').map((x) => x.from.v)).toEqual([16, 18]));
  it('german verse list', () => expect(r('Joh 3,16.18').map((x) => x.from.v)).toEqual([16, 18]));
  it('f / ff', () => {
    expect(r('Joh 3,16f')[0].to).toEqual({ c: 3, v: 17 });
    expect(r('Joh 3,16ff')[0].to).toEqual({ c: 3, v: 36 });
  });
  it('dashes and spaces', () => expect(r('Gal 1, 12 – 17')).toEqual(r('Gal 1,12-17')));
  it('multiple parts with continuation', () =>
    expect(r('Eph 1; 3; Gal 2').map((x) => `${x.book}${x.from.c}`)).toEqual(['EPH1', 'EPH3', 'GAL2']));
  it('errors', () => {
    expect(() => r('Galater 7')).toThrow('Galater hat nur 6 Kapitel.');
    expect(() => r('Galater 1,30')).toThrow('nur 24 Verse');
    expect(() => r('Foo 1')).toThrow('Unbekanntes Buch');
    expect(() => r('Gal 2,5-3')).toThrow('Ende liegt vor dem Anfang');
    expect(() => r('')).toThrow();
  });
});

describe('formatRange', () => {
  const f = (s: string) => {
    const x = r(s)[0];
    const b = index.books.find((b) => b.id === x.book)!;
    return formatRange(x, b.name, b.verses);
  };
  it.each([
    ['Römer', 'Römer'], ['Eph 1', 'Epheser 1'], ['1Mo 2-3', '1. Mose 2–3'],
    ['Gal 1,12-17', 'Galater 1,12–17'], ['Gal 1,12-2,3', 'Galater 1,12–2,3'], ['Joh 3,16', 'Johannes 3,16'],
  ])('%s → %s', (s, out) => expect(f(s)).toBe(out));
});
