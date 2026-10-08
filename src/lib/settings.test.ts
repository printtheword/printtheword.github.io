import { describe, expect, it } from 'vitest';
import { addRecent, DEFAULTS, newMark, settingsFromQuery, settingsToQuery } from './settings.ts';

describe('URL query', () => {
  it('round-trips changed settings', () => {
    const s = { ...DEFAULTS, reference: 'Galater 1,12-17', columns: 2, justify: false, verseColor: '#123456', paper: 'a5' as const };
    const q = settingsToQuery(s);
    expect(q).toContain('ref=Galater+1%2C12-17');
    expect(q).toContain('columns=2');
    expect(q).toContain('justify=0');
    expect(q).not.toContain('fontSize');
    expect(settingsFromQuery(q)).toEqual(s);
  });
  it('ignores invalid values', () => {
    const s = settingsFromQuery('?t=engwebp&paper=foo&columns=abc&verseColor=red&font=Comic')!;
    expect(s.translation).toBe('engwebp');
    expect(s.paper).toBe(DEFAULTS.paper);
    expect(s.columns).toBe(DEFAULTS.columns);
    expect(s.verseColor).toBe(DEFAULTS.verseColor);
    expect(s.font).toBe(DEFAULTS.font);
  });
  it('accepts per-verse notes lines', () => {
    expect(settingsFromQuery('?notesArea=verses')!.notesArea).toBe('verses');
  });
  it('round-trips mark rules and drops invalid ones', () => {
    const marks = [{ ...newMark(), terms: 'Glaube, glaub*', label: 'Glaube', bold: true, line: 'wavy' as const, frame: 'oval' as const }];
    const s = { ...DEFAULTS, marks, markLegend: false };
    expect(settingsFromQuery(settingsToQuery(s))).toEqual(s);
    expect(settingsToQuery(DEFAULTS)).not.toContain('marks');
    const bad = JSON.stringify([...marks, { terms: 1 }, 'x']);
    expect(settingsFromQuery('?marks=' + encodeURIComponent(bad))!.marks).toEqual(marks);
    // invalid fields fall back to defaults
    const fixed = settingsFromQuery('?marks=' + encodeURIComponent(JSON.stringify([{ terms: 'x', line: 'blink', background: 'red', bold: 'yes' }])))!;
    expect(fixed.marks).toEqual([{ ...newMark(''), terms: 'x' }]);
    expect(settingsFromQuery('?t=deu1912&marks=nojson')!.marks).toEqual([]);
  });
  it('upgrades rules with a single style', () => {
    const old = [{ terms: 'Gesetz', style: 'wavy', color: '#c62828', label: '' }, { terms: 'Glaube', style: 'highlight', color: '#fff176', label: 'G' }];
    const [a, b] = settingsFromQuery('?marks=' + encodeURIComponent(JSON.stringify(old)))!.marks;
    expect(a).toMatchObject({ terms: 'Gesetz', line: 'wavy', lineColor: '#c62828', background: '' });
    expect(b).toMatchObject({ terms: 'Glaube', label: 'G', background: '#fff176', line: 'none' });
  });
  it('returns undefined without parameters', () => {
    expect(settingsFromQuery('')).toBeUndefined();
    expect(settingsFromQuery('?utm_source=x')).toBeUndefined();
  });
});

describe('recent references', () => {
  it('moves duplicates to the top', () => {
    expect(addRecent(['Röm 8', 'Eph 1'], ' eph  1 ')).toEqual(['eph 1', 'Röm 8']);
  });
});
