import { createStore, reconcile, unwrap } from 'solid-js/store';
import { createEffect, onCleanup } from 'solid-js';

export type Paper = 'a3' | 'a4' | 'a5' | 'a6' | 'us-letter' | 'custom';
export type ChapterStyle = 'dropcap' | 'margin' | 'heading' | 'none';
export type VerseStyle = 'super' | 'inline' | 'bold' | 'none';
export type FootnoteMode = 'none' | 'page' | 'end';
/** where a new page starts: at every reference, also at every chapter, or only when the page is full */
export type PageBreak = 'section' | 'chapter' | 'none';
export type MarkLine = 'none' | 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy';
export type MarkFrame = 'none' | 'box' | 'rounded' | 'dashed' | 'oval';

/** A rule that marks every occurrence of some words or phrases; the effects can be combined. */
export interface Mark {
  /** comma separated words or phrases; `*` at the start or end of a word matches any letters */
  terms: string;
  /** text in the legend (the terms if empty) */
  label: string;
  /** background colour, '' for none */
  background: string;
  /** text colour, '' to keep the normal one */
  color: string;
  bold: boolean;
  italic: boolean;
  line: MarkLine;
  lineColor: string;
  frame: MarkFrame;
  frameColor: string;
}

export const MARK_LINES: { value: MarkLine; label: string }[] = [
  { value: 'none', label: 'Keine' },
  { value: 'solid', label: 'Unterstrichen' },
  { value: 'double', label: 'Doppelt' },
  { value: 'dotted', label: 'Gepunktet' },
  { value: 'dashed', label: 'Gestrichelt' },
  { value: 'wavy', label: 'Wellenlinie' },
];
export const MARK_FRAMES: { value: MarkFrame; label: string }[] = [
  { value: 'none', label: 'Kein' },
  { value: 'box', label: 'Eckig' },
  { value: 'rounded', label: 'Abgerundet' },
  { value: 'oval', label: 'Oval' },
  { value: 'dashed', label: 'Gestrichelt' },
];
/** suggested light colours (background) and strong colours (text, lines, frames) */
export const LIGHT_COLORS = ['#fff176', '#c5e1a5', '#b3e5fc', '#f8bbd0', '#ffcc80', '#e1bee7', '#e0e0e0'];
export const STRONG_COLORS = ['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a', '#00838f', '#000000'];

export const newMark = (background = LIGHT_COLORS[0]): Mark => ({
  terms: '', label: '', background, color: '', bold: false, italic: false,
  line: 'none', lineColor: STRONG_COLORS[0], frame: 'none', frameColor: STRONG_COLORS[1],
});
export const MAX_MARKS = 12;

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
  pageBreak: PageBreak;
  runningHeader: boolean;
  pageNumbers: boolean;

  textColor: string;
  verseColor: string;
  chapterColor: string;
  headingColor: string;
  wjColor: string;

  /** 'verses': a line under every verse, in the notes column next to it */
  notesArea: 'none' | 'lines' | 'blank' | 'verses';
  notesWidth: number; // mm
  notesLineSpacing: number; // mm

  marks: Mark[];
  markLegend: boolean;
  /** number of occurrences in the legend */
  markCounts: boolean;
  /** legend on a page of its own, one rule per line */
  markLegendPage: boolean;
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
  pageBreak: 'section',
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

  marks: [],
  markLegend: true,
  markCounts: true,
  markLegendPage: false,
};

/** A fresh copy of the defaults (the store changes nested arrays in place). */
const defaults = (): Settings => ({ ...DEFAULTS, marks: [] });

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
  {
    name: 'Kompakt 2-spaltig',
    description: 'A4, zwei Spalten, kleine Schrift',
    settings: {
      columns: 2, fontSize: 9.5, marginTop: 15, marginBottom: 17, marginInner: 15, marginOuter: 15,
      columnRule: true, lineSpacing: 0.55, paragraphSpacing: 0.4,
    },
  },
  {
    name: 'Kommentar',
    description: 'A4 quer, ein Vers pro Zeile, Notizlinie unter jedem Vers',
    settings: {
      landscape: true, fontSize: 9.5, marginTop: 15, marginBottom: 17, marginInner: 15, marginOuter: 15, columnRule: true,
      lineSpacing: 0.55, paragraphSpacing: 0.9, versePerLine: true, notesArea: 'verses', notesWidth: 80,
    },
  },
  { name: 'Lesen', description: 'A4, einspaltig, klassisch', settings: {} },
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

/** Layout of a first visit (links still encode their settings relative to DEFAULTS). */
export const START_LAYOUT = PRESETS[0].settings;
const initial = (): Settings => ({ ...defaults(), ...START_LAYOUT });

const STORAGE_KEY = 'printtheword:settings:v1';

/** allowed values of the string settings that are not free text */
const CHOICES: Partial<Record<keyof Settings, readonly string[]>> = {
  paper: ['a3', 'a4', 'a5', 'a6', 'us-letter', 'custom'],
  chapterStyle: ['dropcap', 'margin', 'heading', 'none'],
  verseStyle: ['super', 'inline', 'bold', 'none'],
  footnotes: ['none', 'page', 'end'],
  pageBreak: ['section', 'chapter', 'none'],
  notesArea: ['none', 'lines', 'blank', 'verses'],
  font: FONTS.map((f) => f.name),
  headingFont: FONTS.map((f) => f.name),
};

/** short URL parameter names for the most common settings */
const PARAM: Partial<Record<keyof Settings, string>> = { translation: 't', reference: 'ref' };
const paramName = (key: keyof Settings) => PARAM[key] ?? key;

const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

const pick = <T extends string>(v: unknown, options: { value: T }[], fallback: T): T =>
  options.some((o) => o.value === v) ? (v as T) : fallback;
const optColor = (v: unknown) => (isColor(v) ? v : '');

/** Converts a rule of the first version (a single style and colour). */
function upgradeMark(m: Record<string, unknown>): Record<string, unknown> {
  if (typeof m.style !== 'string' || !isColor(m.color)) return m;
  const c = m.color;
  const line = { underline: 'solid', double: 'double', dotted: 'dotted', wavy: 'wavy' }[m.style];
  return {
    terms: m.terms, label: m.label,
    background: m.style === 'highlight' ? c : '',
    color: ['color', 'bold', 'italic'].includes(m.style) ? c : '',
    bold: m.style === 'bold', italic: m.style === 'italic',
    line: line ?? 'none', lineColor: line ? c : undefined,
  };
}

/** Validates mark rules from storage (array) or a link (JSON string). */
function coerceMarks(value: unknown): Mark[] | undefined {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(value)) return undefined;
  const def = newMark('');
  return value
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object' && typeof m.terms === 'string')
    .slice(0, MAX_MARKS)
    .map(upgradeMark)
    .map((m) => ({
      terms: m.terms as string,
      label: typeof m.label === 'string' ? m.label : '',
      background: optColor(m.background),
      color: optColor(m.color),
      bold: m.bold === true,
      italic: m.italic === true,
      line: pick(m.line, MARK_LINES, 'none'),
      lineColor: isColor(m.lineColor) ? m.lineColor : def.lineColor,
      frame: pick(m.frame, MARK_FRAMES, 'none'),
      frameColor: isColor(m.frameColor) ? m.frameColor : def.frameColor,
    }));
}

/** Checks and converts a stored or shared value; returns undefined if it is not valid. */
function coerce<K extends keyof Settings>(key: K, value: unknown): Settings[K] | undefined {
  if (key === 'marks') return coerceMarks(value) as Settings[K] | undefined;
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
  if (key.endsWith('Color')) return isColor(value) ? (value as Settings[K]) : undefined;
  const choices = CHOICES[key];
  if (choices && !choices.includes(value)) return undefined;
  return value as Settings[K];
}

function merge(values: Record<string, unknown>): Settings {
  const merged = defaults();
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = coerce(key, values[key]);
    if (v !== undefined) (merged as unknown as Record<string, unknown>)[key] = v;
  }
  return merged;
}

/** Encodes all settings that differ from the defaults (translation and reference always). */
export function settingsToQuery(s: Settings): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = s[key];
    if (Array.isArray(v)) {
      if (v.length) params.set(paramName(key), JSON.stringify(v));
      continue;
    }
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
    /* storage unavailable or corrupt – use the start layout */
  }
  return initial();
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
    setSettings(reconcile(settingsFromQuery(location.search) ?? initial()));
  };
  window.addEventListener('popstate', onPop);
  onCleanup(() => window.removeEventListener('popstate', onPop));

  // presets change the layout only – the text and the marks stay
  const applyPreset = (preset: Partial<LayoutSettings>) => {
    const { translation, reference, marks, markLegend, markCounts, markLegendPage } = unwrap(settings);
    setSettings(reconcile({ ...defaults(), ...preset, translation, reference, marks, markLegend, markCounts, markLegendPage }));
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
