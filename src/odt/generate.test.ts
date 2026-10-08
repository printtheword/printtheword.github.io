import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildDocument } from '../lib/document.ts';
import { parseReference, resolveRanges } from '../lib/reference.ts';
import { DEFAULTS, newMark, PRESETS, type LayoutSettings } from '../lib/settings.ts';
import type { BookData, Translation, TranslationIndex } from '../lib/types.ts';
import { generateOdt, MIME, xml } from './generate.ts';

const bibles = join(import.meta.dirname, '..', '..', 'public', 'bibles');
const json = <T,>(...p: string[]): T => JSON.parse(readFileSync(join(bibles, ...p), 'utf8'));
const translations = json<Translation[]>('translations.json');

function odt(id: string, ref: string, settings: Partial<LayoutSettings> = {}) {
  const t = translations.find((x) => x.id === id)!;
  const index = json<TranslationIndex>(id, 'index.json');
  const ranges = resolveRanges(parseReference(ref), index);
  const books = new Map(ranges.map((r) => [r.book, json<BookData>(id, `${r.book}.json`)]));
  const { translation: _t, reference: _r, ...layout } = DEFAULTS;
  return generateOdt(buildDocument(t, index, ranges, books, { ...layout, ...settings }));
}
const files = (data: Uint8Array) => Object.fromEntries(Object.entries(unzipSync(data)).map(([k, v]) => [k, strFromU8(v)]));

describe('generateOdt', () => {
  it('starts with an uncompressed mimetype entry', () => {
    const data = odt('deu1912', 'Joh 3,16');
    const view = new DataView(data.buffer, data.byteOffset);
    expect(view.getUint32(0, true)).toBe(0x04034b50); // local file header
    expect(view.getUint16(8, true)).toBe(0); // stored
    expect(strFromU8(data.subarray(30, 38))).toBe('mimetype');
    expect(strFromU8(data.subarray(38, 38 + MIME.length))).toBe(MIME);
    expect(Object.keys(files(data))).toEqual(['mimetype', 'content.xml', 'styles.xml', 'meta.xml', 'META-INF/manifest.xml']);
  });
  it('escapes XML', () => {
    expect(xml('a & <b> "c"\u0001')).toBe('a &amp; &lt;b&gt; &quot;c&quot;');
  });
  it('writes verses, headings and footnotes', () => {
    const { 'content.xml': content, 'styles.xml': styles } = files(odt('engbsb', 'Matt 1', { chapterStyle: 'heading', chapterLabel: true }));
    expect(content).toContain('<text:h text:style-name="P1" text:outline-level="1">');
    expect(content).toContain('<text:h text:style-name="Heading_20_2" text:outline-level="2">Chapter 1</text:h>');
    expect(content).toContain('<text:span text:style-name="PTW_verse">2</text:span>');
    expect(content).toContain('text:note-class="footnote"');
    expect(styles).toContain('<style:master-page style:name="PTW_first"');
  });
  it('writes endnotes with their verse', () => {
    const content = files(odt('engbsb', 'Matt 1', { footnotes: 'end' }))['content.xml'];
    expect(content).toContain('text:note-class="endnote"');
    expect(content).toMatch(/<text:span text:style-name="PTW_bd">1:\d+<\/text:span>/);
    expect(files(odt('engbsb', 'Matt 1', { footnotes: 'none' }))['content.xml']).not.toContain('<text:note ');
  });
  it('sets the chapter number as drop cap without the first verse number', () => {
    const content = files(odt('deu1912', 'Römer 8'))['content.xml'];
    expect(content).toContain('<style:drop-cap style:length="1" style:lines="2"');
    expect(content).toMatch(/<text:p text:style-name="P\d+">8So ist nun/);
  });
  it('puts multiple columns into a section and starts every book on its own master page', () => {
    const { 'content.xml': content, 'styles.xml': styles } = files(odt('engwebp', 'Ps 23; John 3', { columns: 2, columnRule: true }));
    expect(content).toContain('fo:column-count="2"');
    expect(content).toContain('<style:column-sep');
    expect(content.match(/<text:section /g)).toHaveLength(2);
    expect(content).toContain('style:master-page-name="PTW_book_1"');
    expect(styles).toContain('<style:master-page style:name="PTW_book_1"');
  });
  it('breaks the page before every chapter on request', () => {
    const { 'content.xml': content } = files(odt('deu1912', 'Joh 1-3', { pageBreak: 'chapter' }));
    expect(content.match(/fo:break-before="page"/g)?.length).toBeGreaterThan(0);
    expect(files(odt('deu1912', 'Joh 1-3'))['content.xml']).not.toContain('fo:break-before');
  });
  it('keeps all references on the first master page without page breaks', () => {
    const { 'content.xml': content, 'styles.xml': styles } = files(odt('deu1912', 'Joh 3,16, Röm 8,28', { pageBreak: 'none' }));
    expect(content).not.toContain('PTW_book_1');
    expect(styles).toMatch(/style:name="PTW_book_0"[^]*?Johannes \/ Römer/);
  });
  it('widens the column gap by the notes area of each column', () => {
    const content = files(odt('engwebp', 'Ps 23', { columns: 2, columnGap: 7, notesArea: 'verses', notesWidth: 30 }))['content.xml'];
    expect(content).toContain('fo:column-gap="37mm"');
  });
  it('starts a new paragraph with every verse', () => {
    const content = files(odt('deu1912', 'Ps 23', { versePerLine: true, verseStyle: 'bold' }))['content.xml'];
    expect(content.match(/<text:p [^>]*><text:span text:style-name="PTW_verse">/g)!.length).toBeGreaterThanOrEqual(5);
  });

  // opens every preset in LibreOffice, if installed – catches invalid XML
  const soffice = ['/usr/bin/soffice', '/usr/local/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'].find(existsSync);
  it.skipIf(!soffice)('can be converted by LibreOffice', { timeout: 120_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ptw-odt-'));
    try {
      const names = PRESETS.map((p, i) => {
        const name = join(dir, `preset${i}.odt`);
        writeFileSync(name, odt('engbsb', 'Matt 5; Phm', { ...p.settings, footnotes: i % 2 ? 'end' : 'page', twoSided: i === 1 }));
        return name;
      });
      execFileSync(soffice!, ['-env:UserInstallation=file://' + join(dir, 'profile'), '--headless', '--convert-to', 'pdf', '--outdir', dir, ...names], { stdio: 'pipe' });
      for (const name of names) expect(existsSync(name.replace(/odt$/, 'pdf'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('writes mark styles, spans and a legend', () => {
    const marks = [{ ...newMark(), terms: 'Gnade', label: 'Gnade Gottes', bold: true, line: 'wavy' as const, frame: 'dashed' as const }];
    const f = files(odt('deu1912', 'Eph 2', { marks }));
    expect(f['styles.xml']).toContain('style:name="PTW_mk0" style:display-name="Markierung 1"');
    expect(f['styles.xml']).toContain('style:text-underline-style="wave"');
    expect(f['content.xml']).toContain('<text:span text:style-name="PTW_mk0">Gnade</text:span>');
    expect(f['styles.xml']).toContain('fo:background-color="#fff176" fo:font-weight="bold"');
    expect(f['styles.xml']).toContain('fo:border="0.6pt dashed #1565c0"');
    expect(f['content.xml']).toContain('>Legende</text:p>');
    expect(f['content.xml']).toContain('Gnade Gottes</text:span> <text:span text:style-name="PTW_count">(3×)</text:span>');
    const page = files(odt('deu1912', 'Eph 2', { marks, markLegendPage: true }));
    expect(page['styles.xml']).toMatch(/style:name="PTW_legend_page"[^]*?fo:break-before="page"/);
    expect(page['content.xml']).toContain('<text:p text:style-name="PTW_legend_page">Legende</text:p>');
  });
});
