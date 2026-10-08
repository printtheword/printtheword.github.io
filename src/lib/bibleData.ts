import { registerBookAlias } from './books.ts';
import type { BookData, Translation, TranslationIndex } from './types.ts';

const base = import.meta.env.BASE_URL;
const cache = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(base + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export const loadTranslations = () => getJson<Translation[]>('bibles/translations.json');

export async function loadIndex(id: string): Promise<TranslationIndex> {
  const index = await getJson<TranslationIndex>(`bibles/${id}/index.json`);
  // names used by this translation ("Psalmen", "Hohelied") are valid input as well
  for (const b of index.books) registerBookAlias(b.name, b.id);
  return index;
}

export const loadBook = (id: string, book: string) => getJson<BookData>(`bibles/${id}/${book}.json`);

export const fontUrl = (file: string) => new URL(`${base}fonts/${file}`, location.href).href;
