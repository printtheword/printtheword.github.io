import { createStore, reconcile, unwrap } from 'solid-js/store';
import { createEffect, onCleanup } from 'solid-js';

export type Paper = 'a3' | 'a4' | 'a5' | 'a6' | 'us-letter' | 'custom';
export type ChapterStyle = 'dropcap' | 'margin' | 'heading' | 'none';
export type VerseStyle = 'super' | 'inline' | 'bold' | 'none';
export type FootnoteMode = 'none' | 'page' | 'end';

export interface Settings {
  translation: string;
  reference: string;

  paper: Paper;
  customWidth: number; // mm
  customHeight: number; // mm
  landscape: boolean;
  marginTop: number; // mm
  marginBottom: number;
  marginInner: number;
  marginOuter: number;
  twoSided: boolean;

  columns: number;
  columnGap: number; // mm
  columnRule: boolean;

  font: string;
  headingFont: string;
  fontSize: number; // pt
  lineSpacing: number; // em between lines
  paragraphSpacing: number; // em
  justify: boolean;
  hyphenate: boolean;

  showBookTitle: boolean;
  chapterStyle: ChapterStyle;
  chapterLabel: boolean; // "Kapitel 3" instead of "3" for heading style
  showHeadings: boolean;
  verseStyle: VerseStyle;
  footnotes: FootnoteMode;
  wordsOfJesusRed: boolean;
  /** start every verse on a new line (otherwise the paragraphs of the translation) */
  versePerLine: boolean;
  runningHeader: boolean;
  pageNumbers: boolean;

  textColor: string;
  verseColor: string;
  chapterColor: string;
  headingColor: string;
  wjColor: string;

  notesArea: 'none' | 'lines' | 'blank';
  notesWidth: number; // mm
  notesLineSpacing: number; // mm
}

export const DEFAULTS: Settings = {
  translation: 'deu1912',
  reference: 'Johannes 1',

  paper: 'a4',
  customWidth: 148,
  customHeight: 210,
  landscape: false,
  marginTop: 20,
  marginBottom: 22,
  marginInner: 20,
  marginOuter: 20,
  twoSided: false,

  columns: 1,
  columnGap: 7,
  columnRule: false,

  font: 'Libertinus Serif',
  headingFont: 'Libertinus Serif',
  fontSize: 11,
  lineSpacing: 0.65,
  paragraphSpacing: 0.65,
  justify: true,
  hyphenate: true,

  showBookTitle: true,
  chapterStyle: 'dropcap',
  chapterLabel: false,
  showHeadings: true,
  verseStyle: 'super',
  footnotes: 'page',
  wordsOfJesusRed: false,
  versePerLine: false,
  runningHeader: true,
  pageNumbers: true,

  textColor: '#1a1a1a',
  verseColor: '#9a7b2f',
  chapterColor: '#17565e',
  headingColor: '#1a1a1a',
  wjColor: '#b22222',

  notesArea: 'none',
  notesWidth: 50,
  notesLineSpacing: 8,
};

export const FONTS: { name: string; files: string[]; note?: string }[] = [
  {
    name: 'Libertinus Serif',
    files: ['LibertinusSerif-Regular.otf', 'LibertinusSerif-Bold.otf', 'LibertinusSerif-Italic.otf', 'LibertinusSerif-BoldItalic.otf'],
  },
  {
    name: 'EB Garamond',
    files: ['EBGaramond-Regular.otf', 'EBGaramond-Bold.otf', 'EBGaramond-Italic.otf', 'EBGaramond-BoldItalic.otf'],
  },
  {
    name: 'Source Serif 4',
    files: ['SourceSerif4-Regular.otf', 'SourceSerif4-Bold.otf', 'SourceSerif4-It.otf', 'SourceSerif4-BoldIt.otf'],
  },
  {
    name: 'Noto Serif',
    files: ['NotoSerif-Regular.ttf', 'NotoSerif-Bold.ttf', 'NotoSerif-Italic.ttf', 'NotoSerif-BoldItalic.ttf'],
  },
  {
    name: 'Noto Sans',
    files: ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'NotoSans-Italic.ttf', 'NotoSans-BoldItalic.ttf'],
  },
];

export const MAX_COLUMNS = 6;

export type LayoutSettings = Omit<Settings, 'translation' | 'reference'>;

export const PRESETS: { name: string; description: string; settings: Partial<LayoutSettings> }[] = [
  { name: 'Lesen', description: 'A4, einspaltig, klassisch', settings: {} },
  {
    name: 'Journaling A5',
    description: 'A5 mit linierter Notizspalte',
    settings: {
      paper: 'a5', fontSize: 10, marginInner: 15, marginOuter: 12, marginTop: 15, marginBottom: 18,
      notesArea: 'lines', notesWidth: 42, chapterStyle: 'heading', footnotes: 'none', runningHeader: false,
    },
  },
  {
    name: 'Kompakt 2-spaltig',
    description: 'A4, zwei Spalten, kleine Schrift',
    settings: {
      columns: 2, fontSize: 9.5, marginTop: 15, marginBottom: 17, marginInner: 15, marginOuter: 15,
      columnRule: true, lineSpacing: 0.55, paragraphSpacing: 0.4,
    },
  },
  {
    name: 'Großdruck',
    description: 'Große Schrift, ein Vers pro Zeile',
    settings: {
      fontSize: 15, lineSpacing: 0.8, font: 'Noto Serif', headingFont: 'Noto Sans', versePerLine: true,
      verseStyle: 'bold', footnotes: 'none', justify: false, hyphenate: false,
    },
  },
  {
    name: 'Übersicht A3',
    description: 'A3 quer, vier Spalten, ganze Bücher auf wenigen Seiten',
    settings: {
      paper: 'a3', landscape: true, columns: 4, columnGap: 8, columnRule: true, fontSize: 9.5,
      marginTop: 15, marginBottom: 17, marginInner: 15, marginOuter: 15, lineSpacing: 0.55, paragraphSpacing: 0.4,
      footnotes: 'none',
    },
  },
];

const STORAGE_KEY = 'printtheword:settings:v1';

/** allowed values of the string settings that are not free text */
const CHOICES: Partial<Record<keyof Settings, readonly string[]>> = {
  paper: ['a3', 'a4', 'a5', 'a6', 'us-letter', 'custom'],
  chapterStyle: ['dropcap', 'margin', 'heading', 'none'],
  verseStyle: ['super', 'inline', 'bold', 'none'],
  footnotes: ['none', 'page', 'end'],
  notesArea: ['none', 'lines', 'blank'],
  font: FONTS.map((f) => f.name),
  headingFont: FONTS.map((f) => f.name),
};

/** short URL parameter names for the most common settings */
const PARAM: Partial<Record<keyof Settings, string>> = { translation: 't', reference: 'ref' };
const paramName = (key: keyof Settings) => PARAM[key] ?? key;

/** Checks and converts a stored or shared value; returns undefined if it is not valid. */
function coerce<K extends keyof Settings>(key: K, value: unknown): Settings[K] | undefined {
  const def = DEFAULTS[key];
  if (typeof def === 'number') {
    const n = typeof value === 'string' ? Number(value) : value;
    return typeof n === 'number' && Number.isFinite(n) ? (n as Settings[K]) : undefined;
  }
  if (typeof def === 'boolean') {
    if (typeof value === 'boolean') return value as Settings[K];
    if (value === '1' || value === 'true') return true as Settings[K];
    if (value === '0' || value === 'false') return false as Settings[K];
    return undefined;
  }
  if (typeof value !== 'string') return undefined;
  if (key.endsWith('Color')) return /^#[0-9a-f]{6}$/i.test(value) ? (value as Settings[K]) : undefined;
  const choices = CHOICES[key];
  if (choices && !choices.includes(value)) return undefined;
  return value as Settings[K];
}

function merge(values: Record<string, unknown>): Settings {
  const merged = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = coerce(key, values[key]);
    if (v !== undefined) (merged as Record<string, unknown>)[key] = v;
  }
  return merged;
}

/** Encodes all settings that differ from the defaults (translation and reference always). */
export function settingsToQuery(s: Settings): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = s[key];
    if (v === DEFAULTS[key] && key !== 'translation' && key !== 'reference') continue;
    params.set(paramName(key), typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return '?' + params.toString();
}

/** Decodes settings from a query string; returns undefined if it contains none. */
export function settingsFromQuery(search: string): Settings | undefined {
  const params = new URLSearchParams(search);
  const values: Record<string, string> = {};
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = params.get(paramName(key));
    if (v !== null) values[key] = v;
  }
  return Object.keys(values).length ? merge(values) : undefined;
}

function loadStored(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // merge so that new settings added later get their defaults
    if (raw) return merge(JSON.parse(raw));
  } catch {
    /* storage unavailable or corrupt – use defaults */
  }
  return { ...DEFAULTS };
}

/** Changes within this time are combined into one history entry (e.g. typing a reference). */
const HISTORY_GROUP_MS = 1200;

export function createSettings() {
  // a shared link wins over the settings stored in this browser
  const [settings, setSettings] = createStore<Settings>(settingsFromQuery(location.search) ?? loadStored());

  createEffect(() => {
    const json = JSON.stringify(settings);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* ignore */
    }
  });

  // keep the URL in sync, so that back/forward and sharing work
  let lastChange = 0;
  createEffect(() => {
    const query = settingsToQuery(settings);
    if (query === location.search) return;
    const now = Date.now();
    const url = location.pathname + query + location.hash;
    if (lastChange === 0 || now - lastChange < HISTORY_GROUP_MS) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    lastChange = now;
  });
  const onPop = () => {
    lastChange = 0;
    setSettings(reconcile(settingsFromQuery(location.search) ?? { ...DEFAULTS }));
  };
  window.addEventListener('popstate', onPop);
  onCleanup(() => window.removeEventListener('popstate', onPop));

  const applyPreset = (preset: Partial<LayoutSettings>) => {
    const { translation, reference } = unwrap(settings);
    setSettings(reconcile({ ...DEFAULTS, ...preset, translation, reference }));
  };
  return { settings, setSettings, applyPreset };
}

const RECENT_KEY = 'printtheword:recent:v1';
const RECENT_MAX = 12;

export function loadRecent(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

/** Puts `reference` at the top of the list (case/space-insensitive de-duplication). */
export function addRecent(list: string[], reference: string): string[] {
  const norm = (x: string) => x.trim().replace(/\s+/g, ' ').toLowerCase();
  const ref = reference.trim().replace(/\s+/g, ' ');
  return [ref, ...list.filter((x) => norm(x) !== norm(ref))].slice(0, RECENT_MAX);
}
