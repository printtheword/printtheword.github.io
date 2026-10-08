/**
 * Dev helper: renders a reference with the local Typst CLI (if installed).
 *   node scripts/render-cli.ts deu1912 "Epheser 1" out.pdf ['{"columns":2}']
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { buildDocument } from '../src/lib/document.ts';
import { parseReference, resolveRanges } from '../src/lib/reference.ts';
import { DEFAULTS } from '../src/lib/settings.ts';
import type { BookData, Translation, TranslationIndex } from '../src/lib/types.ts';
import { generateTypst } from '../src/typst/generate.ts';

const [id, ref, outFile = 'out.pdf', overrides = '{}'] = process.argv.slice(2);
const root = join(import.meta.dirname, '..');
const dir = join(root, 'public', 'bibles');
const translations: Translation[] = JSON.parse(await readFile(join(dir, 'translations.json'), 'utf8'));
const translation = translations.find((t) => t.id === id)!;
const index: TranslationIndex = JSON.parse(await readFile(join(dir, id, 'index.json'), 'utf8'));
const ranges = resolveRanges(parseReference(ref), index);
const books = new Map<string, BookData>();
for (const r of ranges) books.set(r.book, JSON.parse(await readFile(join(dir, id, `${r.book}.json`), 'utf8')));
const doc = buildDocument(translation, index, ranges, books, { ...DEFAULTS, ...JSON.parse(overrides) });
const typFile = outFile.replace(/\.\w+$/, '.typ');
await writeFile(typFile, generateTypst(doc));
execFileSync('typst', ['compile', '--ignore-system-fonts', '--font-path', join(root, 'public', 'fonts'), typFile, outFile], { stdio: 'inherit' });
console.log(`wrote ${outFile}`);
