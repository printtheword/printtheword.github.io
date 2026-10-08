import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTypstCompiler, initOptions, type TypstCompiler } from '@myriaddreamin/typst.ts';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDocument, fileName, truncateDocument } from '../lib/document.ts';
import { parseReference, resolveRanges } from '../lib/reference.ts';
import { selectRange } from '../lib/select.ts';
import { DEFAULTS, LIGHT_COLORS, MARK_FRAMES, MARK_LINES, newMark, PRESETS, type LayoutSettings } from '../lib/settings.ts';
import type { BookData, Translation, TranslationIndex } from '../lib/types.ts';
import { esc, generateTypst } from './generate.ts';

const root = join(import.meta.dirname, '..', '..');
const bibles = join(root, 'public', 'bibles');
const json = <T,>(...p: string[]): T => JSON.parse(readFileSync(join(bibles, ...p), 'utf8'));
const translations = json<Translation[]>('translations.json');

function doc(id: string, ref: string, settings: Partial<LayoutSettings> = {}) {
  const t = translations.find((x) => x.id === id)!;
  const index = json<TranslationIndex>(id, 'index.json');
  const ranges = resolveRanges(parseReference(ref), index);
  const books = new Map(ranges.map((r) => [r.book, json<BookData>(id, `${r.book}.json`)]));
  const { translation: _t, reference: _r, ...layout } = DEFAULTS;
  return buildDocument(t, index, ranges, books, { ...layout, ...settings });
}

describe('selectRange', () => {
  const index = json<TranslationIndex>('engbsb', 'index.json');
  const mat = json<BookData>('engbsb', 'MAT.json');
  it('cuts verses and keeps the heading of the first verse', () => {
    const [range] = resolveRanges(parseReference('Matt 5:3-5'), index);
    const [ch] = selectRange(mat, range);
    const verses = ch.blocks.flatMap((b) => b.c.filter((x) => typeof x === 'object' && 'v' in x).map((x) => (x as { v: number }).v));
    expect(verses).toEqual([3, 4, 5]);
    expect(ch.fromStart).toBe(false);
  });
  it('includes section headings that precede selected verses', () => {
    const [range] = resolveRanges(parseReference('Matt 5'), index);
    const [ch] = selectRange(mat, range);
    expect(ch.blocks[0]).toMatchObject({ h: 's1' });
  });
});

describe('generateTypst', () => {
  it('escapes markup characters', () => {
    expect(esc('1. Mose [a] #x *y* a/b (c)')).toBe('1\\. Mose \\[a\\] \\#x \\*y\\* a\\/b \\(c\\)');
  });
  it('uses the full book title for whole books and the label otherwise', () => {
    expect(doc('deu1912', 'Römer').sections[0].title).toBe('Der Brief des Paulus an die Römer');
    expect(doc('deu1912', 'Gal 1,12-17').label).toBe('Galater 1,12–17');
    expect(doc('engwebp', 'John 3:16').label).toBe('John 3:16');
  });
  it('builds file names', () => {
    const t = translations.find((x) => x.id === 'deu1912')!;
    expect(fileName('Galater 1,12–17', t)).toBe('Galater_1_12-17_Luther_1912.pdf');
  });
  it('writes endnotes when requested', () => {
    const src = generateTypst(doc('engbsb', 'Matt 1', { footnotes: 'end' }));
    expect(src).toContain('#endnotes([Notes]');
    expect(src).not.toContain('#footnote[');
  });
  it('one verse per paragraph', () => {
    const src = generateTypst(doc('deu1912', 'Eph 1,1-3', { versePerLine: true, chapterStyle: 'none' }));
    expect(src.match(/^#vn\(\d+\);/gm)).toHaveLength(3);
  });
  it('marks the end of every verse for per-verse notes lines', () => {
    const settings = { versePerLine: true, chapterStyle: 'none' as const };
    const src = generateTypst(doc('deu1912', 'Eph 1,1-3', { ...settings, notesArea: 'verses' }));
    expect(src.match(/\)<vend>\]/g)).toHaveLength(3);
    expect(src).toContain('Christus!#box[#metadata((k: "0-1-2", n: 2))<vend>]');
    expect(src).toContain('query(<vend>)');
    expect(generateTypst(doc('deu1912', 'Eph 1,1-3', { ...settings, notesArea: 'lines' }))).not.toContain('<vend>');
  });
  it('gives every column its own notes area', () => {
    const src = generateTypst(doc('deu1912', 'Eph 1', { columns: 2, columnGap: 7, notesArea: 'blank', notesWidth: 30 }));
    expect(src).toContain('#set columns(gutter: 37mm)');
  });
  it('marks words and writes a legend', () => {
    const marks = [{ ...newMark(), terms: 'Gnade' }];
    const d = doc('deu1912', 'Eph 2', { marks });
    expect(d.markCounts).toEqual([3]);
    const src = generateTypst(d);
    expect(src).toContain('#mk0[Gnade];');
    expect(src).toContain('#box[#mk0[Gnade] #text(size: 0.85em, fill: luma(110))[(3×)]]');
    // the shortened preview keeps the count of the whole document
    expect(generateTypst(truncateDocument(d, 500).doc)).toContain('[(3×)]');
    expect(generateTypst(doc('deu1912', 'Eph 2', { marks, markCounts: false }))).not.toContain('(3×)');
    expect(src).not.toContain('#pagebreak(weak: true)\n#block(below');
    expect(generateTypst(doc('deu1912', 'Eph 2', { marks, markLegendPage: true }))).toMatch(/#pagebreak\(weak: true\)\n#block\(below: 1\.2em[^\n]*\[Legende\]/);
    expect(generateTypst(doc('deu1912', 'Eph 2', { marks, markLegend: false }))).not.toContain('Legende');
  });
  it('starts new pages per reference, per chapter or only when full', () => {
    const breaks = (ref: string, s: Partial<LayoutSettings>) => generateTypst(doc('deu1912', ref, s)).match(/#pagebreak\(weak: true\)/g)?.length;
    expect(breaks('Joh 1-3', {})).toBe(1);
    expect(breaks('Joh 1-3', { pageBreak: 'chapter' })).toBe(3);
    expect(breaks('Joh 3,16, Joh 12,7', {})).toBe(2);
    const src = generateTypst(doc('deu1912', 'Joh 3,16, Joh 12,7', { pageBreak: 'none' }));
    expect(src.match(/#pagebreak\(weak: true\)/g)).toHaveLength(1);
    expect(src).toMatch(/#booktitle\[[^\n]*\n[^]*#booktitlein\[/);
  });
  it('truncates long documents for the preview', () => {
    const d = doc('deu1912', 'Psalmen');
    const { doc: short, truncated } = truncateDocument(d, 5000);
    expect(truncated).toBe(true);
    expect(short.sections[0].chapters.length).toBeLessThan(10);
  });
});

describe('typst compilation (wasm)', () => {
  let compiler: TypstCompiler;
  beforeAll(async () => {
    const fontDir = join(root, 'public', 'fonts');
    const fonts = ['LibertinusSerif-Regular.otf', 'LibertinusSerif-Bold.otf', 'LibertinusSerif-Italic.otf', 'NotoSans-Regular.ttf', 'NotoSerif-Regular.ttf']
      .map((f) => new Uint8Array(readFileSync(join(fontDir, f))));
    compiler = createTypstCompiler();
    await compiler.init({
      getModule: () => readFileSync(join(root, 'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm')),
      beforeBuild: [initOptions.disableDefaultFontAssets(), initOptions.loadFonts(fonts)],
    });
  }, 60_000);

  const cases: [string, string, Partial<LayoutSettings>][] = [
    ['deu1912', 'Epheser 1', {}],
    ['deu1912', 'Gal 1,12-2,3', { chapterStyle: 'margin', verseStyle: 'bold' }],
    ['engbsb', 'Ps 22-23', { footnotes: 'end', versePerLine: true, chapterStyle: 'heading', chapterLabel: true }],
    ['engwebp', 'John 3; Rom 8:28-39', { wordsOfJesusRed: true, columns: 2, columnRule: true, twoSided: true }],
    ['eng-kjv2006', 'Gen 1', { versePerLine: true, notesArea: 'lines' }],
    ['deu1912', 'Joh 1', { versePerLine: true, notesArea: 'verses' }],
    ['deu1912', 'Ps 119', { columns: 2, notesArea: 'verses', notesWidth: 30, twoSided: true, columnRule: true }],
    ['engbsb', 'Matt 5', { columns: 2, notesArea: 'lines', notesWidth: 30, columnRule: true }],
    ['eng-asv', 'Phlm', { paper: 'custom', customWidth: 120, customHeight: 180, landscape: true }],
    ['deu1912', 'Röm 3', { marks: MARK_LINES.map((l, i) => ({
      ...newMark(i % 2 ? '' : LIGHT_COLORS[i]), terms: ['Glaube*', 'Gesetz*', 'Gott*', 'Sünde*', 'gerecht*', 'Werke*'][i],
      line: l.value, frame: MARK_FRAMES[i % MARK_FRAMES.length].value, bold: i === 1, italic: i === 2, color: i === 3 ? '#1565c0' : '',
    })) }],
    ['deu1912', 'Joh 1-2', { pageBreak: 'chapter', columns: 2 }],
    ['engwebp', 'John 3:16, Rom 8:28-39', { pageBreak: 'none', columns: 2, columnRule: true }],
    ['engwebp', 'John 8', { wordsOfJesusRed: true, columns: 3, markLegendPage: true, marks: [{ ...newMark(), terms: 'truth' }, { ...newMark(), terms: 'light, I am', line: 'wavy', frame: 'oval' }] }],
    ...PRESETS.map((p): [string, string, Partial<LayoutSettings>] => ['deutkw', 'Röm 1', p.settings]),
  ];
  it.each(cases)('%s %s %j', async (id, ref, settings) => {
    compiler.addSource('/main.typ', generateTypst(doc(id, ref, settings)));
    const r = await compiler.compile({ mainFilePath: '/main.typ', format: 1 as never, diagnostics: 'full' });
    expect(r.diagnostics?.filter((d) => (d as { severity: string }).severity.toLowerCase() === 'error') ?? []).toEqual([]);
    expect(r.result?.length).toBeGreaterThan(1000);
  }, 60_000);
});
