/// <reference lib="webworker" />
import { createTypstCompiler, createTypstRenderer, initOptions, type TypstCompiler, type TypstRenderer } from '@myriaddreamin/typst.ts';
import compilerWasm from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import rendererWasm from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

const fontCache = new Map<string, Promise<Uint8Array>>();
function fetchFont(url: string): Promise<Uint8Array> {
  let p = fontCache.get(url);
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`Schrift konnte nicht geladen werden: ${url}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    fontCache.set(url, p);
  }
  return p;
}

// The compiler's font set is fixed at init time, so keep one compiler per font set.
let compiler: { key: string; instance: Promise<TypstCompiler> } | undefined;
function getCompiler(fonts: string[]): Promise<TypstCompiler> {
  const key = [...fonts].sort().join('|');
  if (compiler?.key !== key) {
    const instance = (async () => {
      const data = await Promise.all(fonts.map(fetchFont));
      const c = createTypstCompiler();
      await c.init({
        getModule: () => compilerWasm,
        beforeBuild: [initOptions.disableDefaultFontAssets(), initOptions.loadFonts(data)],
      });
      return c;
    })();
    instance.catch(() => (compiler = undefined));
    compiler = { key, instance };
  }
  return compiler.instance;
}

let renderer: Promise<TypstRenderer> | undefined;
function getRenderer(): Promise<TypstRenderer> {
  renderer ??= (async () => {
    const r = createTypstRenderer();
    await r.init({ getModule: () => rendererWasm });
    return r;
  })();
  return renderer;
}

const PAGE_RE = /<g class="typst-page" transform="translate\(0, ([\d.]+)\)"[^>]*data-page-width="([\d.]+)" data-page-height="([\d.]+)">/g;
const GAP = 16; // pt between preview pages

const countPages = (svg: string) => svg.match(/<g class="typst-page"/g)?.length ?? 0;

/** Moves the pages apart and gives each one a white sheet, so the preview looks like paper. */
function spreadPages(svg: string): string {
  let i = 0;
  let width = 0;
  let height = 0;
  const out = svg.replace(PAGE_RE, (m, y: string, w: string, h: string) => {
    const top = +y + i++ * GAP;
    width = Math.max(width, +w);
    height = top + +h;
    return `<rect class="sheet" x="0" y="${top}" width="${w}" height="${h}" fill="#fff"/>` + m.replace(`translate(0, ${y})`, `translate(0, ${top})`);
  });
  if (!i) return svg;
  return out.replace(/^<svg([^>]*?) viewBox="[^"]*" width="[^"]*" height="[^"]*"/, `<svg$1 viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`);
}

// values of CompileFormatEnum (not exported as a runtime value)
const FORMAT_VECTOR = 0;
const FORMAT_PDF = 1;

type Diagnostic = { message: string; severity: string; range?: string };
function errorText(diagnostics: unknown): string {
  const list = (diagnostics ?? []) as Diagnostic[];
  const errors = list.filter((d) => d.severity?.toLowerCase() === 'error');
  return (errors.length ? errors : list).map((d) => `${d.message}${d.range ? ` (${d.range})` : ''}`).join('\n') || 'Unbekannter Fehler beim Setzen';
}

async function handle(req: WorkerRequest): Promise<WorkerResponse> {
  const c = await getCompiler(req.fonts);
  c.addSource('/main.typ', req.source);
  if (req.format === 'pdf') {
    const r = await c.compile({ mainFilePath: '/main.typ', format: FORMAT_PDF, diagnostics: 'full' });
    if (!r.result) return { id: req.id, ok: false, error: errorText(r.diagnostics) };
    return { id: req.id, ok: true, pdf: r.result };
  }
  const rd = await getRenderer();
  const r = await c.compile({ mainFilePath: '/main.typ', format: FORMAT_VECTOR, diagnostics: 'full' });
  if (!r.result) return { id: req.id, ok: false, error: errorText(r.diagnostics) };
  const vector = r.result;
  const svg = await rd.runWithSession(async (session) => {
    rd.manipulateData({ renderSession: session, action: 'reset', data: vector });
    return rd.renderSvg({ renderSession: session, data_selection: { body: true, defs: true, css: true, js: false } });
  });
  let pages = countPages(svg);
  if (req.countSource) {
    // the preview was shortened – lay out the full document to get the real page count
    c.addSource('/main.typ', req.countSource);
    const full = await c.compile({ mainFilePath: '/main.typ', format: FORMAT_VECTOR, diagnostics: 'none' });
    if (full.result) {
      const data = full.result;
      pages = await rd.runWithSession(async (session) => {
        rd.manipulateData({ renderSession: session, action: 'reset', data });
        return session.retrievePagesInfo().length;
      });
    }
  }
  return { id: req.id, ok: true, svg: spreadPages(svg), pages };
}

// process requests one after another – the compiler holds a single main file
let queue: Promise<void> = Promise.resolve();
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  queue = queue.then(() => processMessage(e));
};

async function processMessage(e: MessageEvent<WorkerRequest>) {
  let res: WorkerResponse;
  try {
    res = await handle(e.data);
  } catch (err) {
    res = { id: e.data.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const transfer = res.ok && res.pdf ? [res.pdf.buffer as ArrayBuffer] : [];
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(res, transfer);
}
