import type { Block, BookData, HeadingKind, Inline, ParaKind } from './types.ts';

const HEADINGS: Record<string, HeadingKind> = {
  ms: 'ms', ms1: 'ms', ms2: 'ms', mr: 'r',
  s: 's1', s1: 's1', s2: 's2', s3: 's2',
  r: 'r', d: 'd', qa: 'qa', sp: 'sp',
};
const PARAS: Record<string, ParaKind> = {
  p: 'p', pmo: 'p', nb: 'm', m: 'm', mi: 'm',
  pi: 'pi', pi1: 'pi', pi2: 'pi', pc: 'pc',
  q: 'q1', q1: 'q1', q2: 'q2', q3: 'q3', qr: 'qr', qc: 'pc', qm1: 'q1', qm2: 'q2',
  li: 'li1', li1: 'li1', li2: 'li2',
  b: 'b',
};
const STYLES = new Set(['wj', 'nd', 'add', 'it', 'bd']);
/** paragraph-level markers whose content is dropped (introductions, metadata) */
const SKIP = new Set(['ide', 'rem', 'ip', 'ipr', 'ib', 'ili', 'ili1', 'ili2', 'is', 'is1', 'is2', 'iot', 'io1', 'io2', 'imt', 'imt1', 'ie', 'sts', 'cl', 'cp', 'cd']);

/**
 * Removes markup that only carries attributes or study data:
 * \w word|strong="…"\w* → word, cross references (\x … \x*) are dropped.
 */
function preprocess(src: string): string {
  return src
    .replace(/\\x\s.*?\\x\*/gs, '')
    .replace(/\\\+?w\s+([^|\\]*?)(?:\|[^\\]*)?\\\+?w\*/g, '$1')
    .replace(/\\\+?(?:wh|wg|wa)\s+([^|\\]*?)(?:\|[^\\]*)?\\\+?(?:wh|wg|wa)\*/g, '$1')
    .replace(/\\fig\s.*?\\fig\*/gs, '');
}

/** Converts footnote content ("\fr 1:3 \ft Greek Aram …") to plain text. */
function footnoteText(raw: string): string {
  return raw
    .replace(/^\s*[+\-*?a-z]\s+/, '')
    .replace(/\\fr\s+[^\\]*/g, '')
    .replace(/\\f(?:q|qa|k|l|w|p|v|dc)\*?/g, ' ')
    .replace(/\\\+?[a-z0-9]+\*?/g, ' ')
    .replace(/\\ft/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parses inline content: verse markers, character styles, footnotes. */
function parseInline(text: string, out: Inline[], onVerse: (v: number) => void) {
  const re = /\\v\s+(\d+)[a-z\-0-9]*\s*|\\f\s(.*?)\\f\*|\\(\+?)([a-z]+\d*)(?:(\*)|\s?)/gs;
  const styles: string[] = [];
  let last = 0;
  const push = (t: string) => {
    if (!t) return;
    const style = styles.findLast((s) => STYLES.has(s)) as 'wj' | 'nd' | 'add' | 'it' | 'bd' | undefined;
    const prev = out[out.length - 1];
    if (!style) {
      if (typeof prev === 'string') out[out.length - 1] = prev + t;
      else out.push(t);
    } else if (prev && typeof prev === 'object' && 's' in prev && prev.s === style) prev.t += t;
    else out.push({ s: style, t });
  };
  for (let m; (m = re.exec(text)); ) {
    push(text.slice(last, m.index));
    last = re.lastIndex;
    if (m[1]) {
      const v = +m[1];
      onVerse(v);
      out.push({ v });
    } else if (m[2] !== undefined) {
      const f = footnoteText(m[2]);
      if (f) out.push({ f });
    } else {
      const marker = m[4];
      if (m[5]) {
        const i = styles.lastIndexOf(marker);
        if (i >= 0) styles.splice(i, 1);
      } else styles.push(marker);
    }
  }
  push(text.slice(last));
}

function normalize(c: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const x of c) {
    if (typeof x === 'string') {
      const t = x.replace(/\s+/g, ' ');
      if (typeof out[out.length - 1] === 'string') out[out.length - 1] += t;
      else out.push(t);
    } else if ('t' in x) out.push({ ...x, t: x.t.replace(/\s+/g, ' ') });
    else out.push(x);
  }
  // trim around verse markers / block edges
  for (let i = 0; i < out.length; i++) {
    const x = out[i];
    if (typeof x !== 'string') continue;
    let t = x;
    if (i === 0 || (typeof out[i - 1] === 'object' && 'v' in (out[i - 1] as object))) t = t.trimStart();
    if (i === out.length - 1) t = t.trimEnd();
    out[i] = t;
  }
  return out.filter((x) => x !== '' && !(typeof x === 'object' && 't' in x && x.t === ''));
}

export function parseUsfm(src: string): BookData {
  const book: BookData = { id: '', name: '', title: '', chapters: [] };
  let block: Block | undefined;
  let skipping = false;
  const lines = preprocess(src).split(/\r?\n(?=\\)/);
  let pendingMainTitle: string[] = [];

  const chapter = () => book.chapters[book.chapters.length - 1];
  const close = () => {
    if (block) {
      block.c = normalize(block.c);
      if (block.c.length > 0 || ('p' in block && block.p === 'b')) chapter()?.blocks.push(block);
    }
    block = undefined;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const m = /^\\([a-z]+\d*)\s?(.*)$/.exec(line);
    if (!m) {
      // continuation text without marker
      if (block && !skipping) parseInline(' ' + line, block.c, () => {});
      continue;
    }
    const [, marker, rest] = m;
    if (marker === 'id') {
      book.id = rest.split(' ')[0];
      continue;
    }
    if (marker === 'h') {
      book.name = rest.trim();
      continue;
    }
    if (marker === 'toc2' && !book.name) {
      book.name = rest.trim();
      continue;
    }
    if (/^mt\d?$/.test(marker)) {
      pendingMainTitle.push(rest.trim());
      continue;
    }
    if (/^toc\d$/.test(marker) || marker === 'usfm' || marker === 'mte' || marker === 'mte1') continue;
    if (marker === 'c') {
      close();
      skipping = false;
      book.chapters.push({ n: parseInt(rest, 10), blocks: [] });
      continue;
    }
    if (SKIP.has(marker)) {
      close();
      skipping = true;
      continue;
    }
    if (marker in HEADINGS) {
      close();
      skipping = false;
      if (!chapter()) continue;
      block = { h: HEADINGS[marker], c: [] };
      parseInline(rest, block.c, () => {});
      close();
      continue;
    }
    if (marker in PARAS) {
      close();
      skipping = false;
      if (!chapter()) continue;
      block = { p: PARAS[marker], c: [] };
      if (rest) parseInline(rest, block.c, () => {});
      continue;
    }
    if (marker === 'v') {
      if (!chapter()) continue;
      skipping = false;
      if (!block || 'h' in block) {
        close();
        block = { p: 'p', c: [] };
      }
      parseInline(line, block.c, () => {});
      continue;
    }
    // unknown paragraph marker: treat its text as continuation of the current block
    if (block && !skipping) parseInline(rest, block.c, () => {});
  }
  close();
  book.title = pendingMainTitle.join(' ') || book.name;
  // drop trailing blank paragraphs
  for (const c of book.chapters) {
    while (c.blocks.length && 'p' in c.blocks[c.blocks.length - 1] && (c.blocks[c.blocks.length - 1] as { p: string }).p === 'b')
      c.blocks.pop();
  }
  return book;
}

/** Number of verses per chapter (highest verse number found). */
export function verseCounts(book: BookData): number[] {
  return book.chapters.map((c) => {
    let max = 0;
    for (const b of c.blocks) for (const x of b.c) if (typeof x === 'object' && 'v' in x) max = Math.max(max, x.v);
    return max;
  });
}
