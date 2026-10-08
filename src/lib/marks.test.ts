import { describe, expect, it } from 'vitest';
import { applyMarks, compileMarks } from './marks.ts';
import { newMark } from './settings.ts';
import type { Inline } from './types.ts';

const rule = (terms: string) => ({ ...newMark(), terms });
const marked = (c: Inline[], marks: ReturnType<typeof rule>[]) =>
  applyMarks(c, compileMarks(marks)).flatMap((x) => (typeof x === 'object' && 'm' in x && x.m !== undefined ? [[x.m, x.t]] : []));

describe('applyMarks', () => {
  it('matches whole words only, also with umlauts', () => {
    expect(marked(['Der Herr ist Herrlichkeit, Herrn.'], [rule('Herr')])).toEqual([[0, 'Herr']]);
    expect(marked(['für Gläubige, gläubig'], [rule('gläubig')])).toEqual([[0, 'gläubig']]);
  });
  it('supports * as a wildcard', () => {
    expect(marked(['Glaube, Glauben und sie glaubten nicht; Unglaube'], [rule('glaub*')])).toEqual([
      [0, 'Glaube'],
      [0, 'Glauben'],
      [0, 'glaubten'],
    ]);
    expect(marked(['Unglaube und Aberglaube'], [rule('*glaube')])).toEqual([
      [0, 'Unglaube'],
      [0, 'Aberglaube'],
    ]);
  });
  it('ignores case and accepts several comma separated words', () => {
    expect(marked(['Gott und gott'], [rule('Gott')])).toHaveLength(2);
    expect(marked(['das Pfand unseres Erbes, das Erbe'], [rule('Pfand, Erbe')])).toEqual([
      [0, 'Pfand'],
      [0, 'Erbe'],
    ]);
  });
  it('finds phrases across verse numbers and line breaks', () => {
    const c: Inline[] = ['wir sind gerecht ', { v: 2 }, 'geworden durch\nden Glauben'];
    expect(marked(c, [rule('gerecht geworden, durch den Glauben')])).toEqual([
      [0, 'gerecht '],
      [0, 'geworden'],
      [0, 'durch\nden Glauben'],
    ]);
    // the verse number stays where it was
    expect(applyMarks(c, compileMarks([rule('gerecht geworden')]))[2]).toEqual({ v: 2 });
  });
  it('splits styled text and keeps its style', () => {
    const out = applyMarks([{ s: 'wj', t: 'Ich bin das Licht der Welt' }], compileMarks([rule('Licht')]));
    expect(out).toEqual([{ s: 'wj', t: 'Ich bin das ' }, { s: 'wj', t: 'Licht', m: 0 }, { s: 'wj', t: ' der Welt' }]);
  });
  it('lets earlier rules win on overlaps and handles several rules', () => {
    expect(marked(['im Herrn Jesus'], [rule('im Herrn'), rule('Herrn'), rule('Jesus')])).toEqual([
      [0, 'im Herrn'],
      [2, 'Jesus'],
    ]);
  });
  it('treats regex characters literally and skips empty rules', () => {
    expect(marked(['a (b) c.d cxd'], [rule('(b), c.d'), rule(' , * ')])).toEqual([
      [0, '(b)'],
      [0, 'c.d'],
    ]);
    expect(compileMarks([rule(''), rule('*')])).toEqual([undefined, undefined]);
  });
});
