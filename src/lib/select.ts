import type { Range } from './reference.ts';
import type { Block, BookData, Inline } from './types.ts';

export interface SelectedChapter {
  n: number;
  /** the selection starts with verse 1 of this chapter */
  fromStart: boolean;
  blocks: Block[];
}

const verseOf = (x: Inline) => (typeof x === 'object' && 'v' in x ? x.v : undefined);

/** Extracts the blocks of the chapters/verses covered by `range`. */
export function selectRange(book: BookData, range: Range): SelectedChapter[] {
  const out: SelectedChapter[] = [];
  for (let c = range.from.c; c <= range.to.c; c++) {
    const chapter = book.chapters.find((x) => x.n === c);
    if (!chapter) continue;
    const first = c === range.from.c ? range.from.v : 1;
    const last = c === range.to.c ? range.to.v : Infinity;
    const inRange = (v: number) => v >= first && v <= last;

    const blocks: Block[] = [];
    let cur = 0;
    chapter.blocks.forEach((block, i) => {
      if ('h' in block) {
        const next = nextVerse(chapter.blocks, i + 1);
        // a heading belongs to the verse that follows it
        if (next !== undefined && inRange(next) && (next > cur || cur === 0)) blocks.push(block);
        return;
      }
      const c: Inline[] = [];
      for (const x of block.c) {
        const v = verseOf(x);
        if (v !== undefined) cur = v;
        if (inRange(cur === 0 ? 1 : cur)) c.push(x);
      }
      if (block.p === 'b') {
        const next = nextVerse(chapter.blocks, i + 1);
        if (cur >= first && next !== undefined && inRange(next)) blocks.push(block);
      } else if (c.length) blocks.push({ p: block.p, c });
    });
    out.push({ n: c, fromStart: first === 1, blocks });
  }
  return out;
}

function nextVerse(blocks: Block[], from: number): number | undefined {
  for (let i = from; i < blocks.length; i++) {
    for (const x of blocks[i].c) {
      const v = verseOf(x);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}
