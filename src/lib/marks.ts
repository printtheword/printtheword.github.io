import { reflowVerses, visibleBlocks } from './content.ts';
import type { Mark } from './settings.ts';
import type { Block, Inline } from './types.ts';
import type { DocumentInput } from '../typst/generate.ts';

/** Marks the user's words and phrases in the text. Shared by the PDF (Typst) and ODT generators. */

/** One regular expression per mark rule (same index); undefined if the rule has no terms. */
export type MarkRules = (RegExp | undefined)[];

const WORD = '[\\p{L}\\p{N}]';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Splits the comma separated terms of a rule. */
export const markTerms = (terms: string) =>
  terms
    .split(',')
    .map((t) => t.trim().replace(/\s+/g, ' '))
    .filter((t) => t.replace(/\*/g, '').trim() !== '');

/** Text of a rule in the legend: its label, or else its terms ("glaub*" → "glaub…"). */
export const markLabel = (m: Mark) => m.label.trim() || markTerms(m.terms).map((t) => t.replace(/\*/g, '…')).join(', ');

function termPattern(term: string): string {
  return term
    .split(' ')
    .map((word) => {
      const m = /^(\*?)(.*?)(\*?)$/.exec(word)!;
      return (m[1] ? `${WORD}*` : '') + escapeRe(m[2].replace(/\*/g, '')) + (m[3] ? `${WORD}*` : '');
    })
    .join('\\s+');
}

export function compileMarks(marks: Mark[]): MarkRules {
  return marks.map((mark) => {
    // longer terms first, so that "im Herrn" wins over "Herr*"
    const terms = markTerms(mark.terms).sort((a, b) => b.length - a.length);
    if (!terms.length) return undefined;
    return new RegExp(`(?<!${WORD})(?:${terms.map(termPattern).join('|')})(?!${WORD})`, 'giu');
  });
}

interface Match {
  start: number;
  end: number;
  rule: number;
}

/** Non-overlapping matches sorted by position; earlier rules win over later ones. */
function findMatches(text: string, rules: MarkRules): Match[] {
  const taken: Match[] = [];
  rules.forEach((re, rule) => {
    if (!re) return;
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (end > start && !taken.some((t) => start < t.end && end > t.start)) taken.push({ start, end, rule });
    }
  });
  return taken.sort((a, b) => a.start - b.start);
}

const textOf = (x: Inline): string | undefined => (typeof x === 'string' ? x : 't' in x ? x.t : undefined);

/** The text of a block for matching, with the offset of every inline (verse numbers count as a space). */
function blockText(c: Inline[]): { text: string; starts: number[] } {
  let text = '';
  const starts: number[] = [];
  for (const x of c) {
    if (typeof x === 'object' && 'v' in x && text && !/\s$/.test(text)) text += ' ';
    starts.push(text.length);
    text += textOf(x) ?? '';
  }
  return { text, starts };
}

/** Splits the text inlines at the matches and tags the matched parts with their rule. */
export function applyMarks(c: Inline[], rules: MarkRules): Inline[] {
  if (!rules.some(Boolean)) return c;
  const { text, starts } = blockText(c);
  const matches = findMatches(text, rules);
  if (!matches.length) return c;
  const out: Inline[] = [];
  c.forEach((x, i) => {
    const t = textOf(x);
    if (t === undefined) return void out.push(x);
    const a = starts[i];
    const b = a + t.length;
    let pos = a;
    const push = (from: number, to: number, rule?: number) => {
      if (to <= from) return;
      const part = t.slice(from - a, to - a);
      if (typeof x === 'string') out.push(rule === undefined ? part : { m: rule, t: part });
      else if ('s' in x) out.push(rule === undefined ? { s: x.s, t: part } : { s: x.s, t: part, m: rule });
      else out.push({ m: rule ?? (x as { m: number }).m, t: part });
    };
    for (const m of matches) {
      if (m.end <= pos || m.start >= b) continue;
      push(pos, Math.max(pos, m.start));
      push(Math.max(pos, m.start), Math.min(b, m.end), m.rule);
      pos = Math.min(b, m.end);
    }
    push(pos, b);
  });
  return out;
}

export function markBlocks(blocks: Block[], rules: MarkRules): Block[] {
  if (!rules.some(Boolean)) return blocks;
  return blocks.map((b) => ({ ...b, c: applyMarks(b.c, rules) }));
}

/** Number of matches of every rule in the (complete) document. */
export function countMarks(doc: DocumentInput): number[] {
  const s = doc.settings;
  const rules = compileMarks(s.marks);
  const counts = rules.map(() => 0);
  if (!rules.some(Boolean)) return counts;
  for (const section of doc.sections) {
    for (const ch of section.chapters) {
      for (const b of reflowVerses(visibleBlocks(ch.blocks, s), s)) {
        for (const m of findMatches(blockText(b.c).text, rules)) counts[m.rule]++;
      }
    }
  }
  return counts;
}
