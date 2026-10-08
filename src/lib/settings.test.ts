import { describe, expect, it } from 'vitest';
import { addRecent, DEFAULTS, settingsFromQuery, settingsToQuery } from './settings.ts';

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
