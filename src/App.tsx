import { createEffect, createMemo, createResource, createSignal, For, on, onCleanup, Show } from 'solid-js';
import { fontUrl, loadBook, loadIndex, loadTranslations } from './lib/bibleData.ts';
import { buildDocument, charsPerPage, fileName, truncateDocument } from './lib/document.ts';
import { parseReference, resolveRanges, type Range } from './lib/reference.ts';
import { addRecent, createSettings, DEFAULTS, FONTS, loadRecent, PRESETS, saveRecent, type LayoutSettings } from './lib/settings.ts';
import type { BookData } from './lib/types.ts';
import { compile } from './typst/client.ts';
import { generateTypst } from './typst/generate.ts';
import { ColorInput, Field, NumberInput, Section, Segmented, Select, Toggle } from './components/Fields.tsx';
import { Logo } from './components/Logo.tsx';
import { ReferenceInput } from './components/ReferenceInput.tsx';

const EXAMPLES = ['Epheser 1', 'Galater 1,12-17', 'Römer', '1. Mose 2-3', 'Psalm 23', 'Matthäus 5-7', 'Joh 3,16'];
const PREVIEW_PAGES = 12;

export default function App() {
  const { settings, setSettings, applyPreset } = createSettings();
  const set = <K extends keyof typeof settings>(key: K) => (value: (typeof settings)[K]) => setSettings(key, value as never);

  const [translations] = createResource(loadTranslations);
  const translation = createMemo(() => translations()?.find((t) => t.id === settings.translation) ?? translations()?.[0]);
  const [index] = createResource(() => translation()?.id, loadIndex);

  const parsed = createMemo<{ ranges?: Range[]; error?: string }>(() => {
    const idx = index();
    if (!idx) return {};
    try {
      return { ranges: resolveRanges(parseReference(settings.reference), idx) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

  const bookKey = createMemo(() => {
    const t = translation();
    const ranges = parsed().ranges;
    if (!t || !ranges) return undefined;
    return { id: t.id, books: [...new Set(ranges.map((r) => r.book))].join(',') };
  }, undefined, { equals: (a, b) => a?.id === b?.id && a?.books === b?.books });

  const [books] = createResource(bookKey, async ({ id, books }) => {
    const map = new Map<string, BookData>();
    await Promise.all(books.split(',').map(async (b) => map.set(b, await loadBook(id, b))));
    return map;
  });

  const layout = createMemo((): LayoutSettings => {
    const { translation: _t, reference: _r, ...rest } = settings;
    return { ...rest };
  });

  const source = createMemo(() => {
    const t = translation();
    const idx = index();
    const ranges = parsed().ranges;
    const b = books();
    if (!t || !idx || !ranges || !b || !ranges.every((r) => b.has(r.book))) return undefined;
    const settings = layout();
    const doc = buildDocument(t, idx, ranges, b, settings);
    const typst = generateTypst(doc);
    // the preview only sets roughly the first pages – large selections would be slow
    const short = truncateDocument(doc, charsPerPage(settings) * PREVIEW_PAGES);
    const preview = short.truncated ? generateTypst(short.doc) : typst;
    return { doc, typst, preview, truncated: short.truncated, label: doc.label };
  });

  const fonts = createMemo(() => {
    const names = new Set(['Libertinus Serif', settings.font, settings.headingFont]);
    return FONTS.filter((f) => names.has(f.name)).flatMap((f) => f.files.map(fontUrl));
  });

  // live preview (debounced)
  const [preview, setPreview] = createSignal<{ svg: string; pages: number; truncated: boolean }>();
  const [previewError, setPreviewError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  let generation = 0;
  createEffect(
    on([source, fonts], ([src, fontList]) => {
      if (!src) return;
      const gen = ++generation;
      const timer = setTimeout(async () => {
        setBusy(true);
        try {
          const res = await compile({
            source: src.preview,
            countSource: src.truncated ? src.typst : undefined,
            fonts: fontList,
            format: 'svg',
          });
          if (gen !== generation) return;
          if (res.ok) {
            setPreview({ svg: res.svg ?? '', pages: res.pages ?? 0, truncated: src.truncated });
            setPreviewError(undefined);
          } else setPreviewError(res.error);
        } catch (e) {
          if (gen === generation) setPreviewError((e as Error).message);
        } finally {
          if (gen === generation) setBusy(false);
        }
      }, 400);
      onCleanup(() => clearTimeout(timer));
    }),
  );

  function save(data: Uint8Array, type: string, name: string) {
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const [downloading, setDownloading] = createSignal(false);
  async function download() {
    const src = source();
    const t = translation();
    if (!src || !t) return;
    setDownloading(true);
    try {
      const res = await compile({ source: src.typst, fonts: fonts(), format: 'pdf' });
      if (!res.ok || !res.pdf) throw new Error(res.ok ? 'Kein PDF erzeugt' : res.error);
      save(res.pdf, 'application/pdf', fileName(src.label, t));
    } catch (e) {
      setPreviewError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  const [exportingOdt, setExportingOdt] = createSignal(false);
  async function downloadOdt() {
    const src = source();
    const t = translation();
    if (!src || !t) return;
    setExportingOdt(true);
    try {
      // loaded on demand – most people only want the PDF
      const { generateOdt, MIME } = await import('./odt/generate.ts');
      save(generateOdt(src.doc), MIME, fileName(src.label, t, 'odt'));
    } catch (e) {
      setPreviewError((e as Error).message);
    } finally {
      setExportingOdt(false);
    }
  }

  // remember valid references once the user stopped typing
  const [recent, setRecent] = createSignal(loadRecent());
  const updateRecent = (list: string[]) => {
    setRecent(list);
    saveRecent(list);
  };
  createEffect(
    on(source, (src) => {
      if (!src) return;
      const ref = settings.reference;
      const timer = setTimeout(() => updateRecent(addRecent(recent(), ref)), 1500);
      onCleanup(() => clearTimeout(timer));
    }),
  );

  createEffect(() => {
    const label = source()?.label;
    document.title = label ? `Print the word – ${label}` : 'Print the word – Bibel ausdrucken';
  });

  const [copied, setCopied] = createSignal(false);
  async function share() {
    const url = location.href;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: `Print the word – ${source()?.label ?? ''}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard not available (e.g. insecure context): let the user copy it
      prompt('Link zum Teilen:', url);
    }
  }

  const features = () => translation()?.features;
  const fontOptions = FONTS.map((f) => ({ value: f.name, label: f.name }));

  return (
    <div class="app">
      <header class="masthead">
        <div class="brand">
          <Logo />
          <div>
            <h1>Print the word</h1>
            <p>Die Bibel nach deinen Vorgaben ausdrucken</p>
          </div>
        </div>
      </header>

      <main class="layout">
        <aside class="panel" aria-label="Einstellungen">
          <section class="card primary">
            <Select
              label="Übersetzung"
              wide
              value={settings.translation}
              options={(translations() ?? []).map((t) => ({
                value: t.id,
                label: `${t.name} (${t.lang === 'de' ? 'Deutsch' : 'Englisch'})`,
              }))}
              onChange={set('translation')}
            />
            <div class="field wide">
              <label class="field-label" for="reference">
                Bibelstelle
              </label>
              <ReferenceInput
                value={settings.reference}
                onInput={(v) => setSettings('reference', v)}
                recent={recent()}
                lang={translation()?.lang ?? 'de'}
                invalid={!!parsed().error}
                onRemoveRecent={(v) => updateRecent(recent().filter((x) => x !== v))}
              />
            </div>
            <div class="ref-status" aria-live="polite">
              <Show when={parsed().error} fallback={<Show when={source()}>{(s) => <span class="ok">✓ {s().label}</span>}</Show>}>
                <span class="error">{parsed().error}</span>
              </Show>
            </div>
            <div class="chips" aria-label="Beispiele">
              <For each={EXAMPLES}>
                {(ex) => (
                  <button type="button" class="chip" onClick={() => setSettings('reference', ex)}>
                    {ex}
                  </button>
                )}
              </For>
            </div>
            <p class="help">
              Mehrere Stellen mit „;“ trennen, z. B. <code>Ps 23; Joh 10,1-18</code>. Englische Schreibweise{' '}
              <code>John 3:16</code> geht auch.
            </p>
          </section>

          <fieldset class="settings" disabled={!!parsed().error}>
          <Show when={parsed().error}>
            <p class="settings-disabled">Die Einstellungen sind gesperrt, bis die Bibelstelle gültig ist.</p>
          </Show>
          <Section title="Vorlagen" open>
            <div class="presets">
              <For each={PRESETS}>
                {(p) => (
                  <button type="button" class="preset" onClick={() => applyPreset(p.settings)}>
                    <strong>{p.name}</strong>
                    <span>{p.description}</span>
                  </button>
                )}
              </For>
            </div>
          </Section>

          <Section title="Seite" open>
            <div class="grid">
              <Select
                label="Papierformat"
                value={settings.paper}
                options={[
                  { value: 'a3', label: 'A3' },
                  { value: 'a4', label: 'A4' },
                  { value: 'a5', label: 'A5' },
                  { value: 'a6', label: 'A6' },
                  { value: 'us-letter', label: 'US Letter' },
                  { value: 'custom', label: 'Eigenes Format' },
                ]}
                onChange={set('paper')}
              />
              <Select
                label="Ausrichtung"
                value={settings.landscape ? 'landscape' : 'portrait'}
                options={[
                  { value: 'portrait', label: 'Hochformat' },
                  { value: 'landscape', label: 'Querformat' },
                ]}
                onChange={(v) => setSettings('landscape', v === 'landscape')}
              />
              <Show when={settings.paper === 'custom'}>
                <NumberInput label="Breite" unit="mm" min={50} max={600} value={settings.customWidth} onChange={set('customWidth')} />
                <NumberInput label="Höhe" unit="mm" min={50} max={900} value={settings.customHeight} onChange={set('customHeight')} />
              </Show>
              <NumberInput label="Rand oben" unit="mm" min={0} max={80} value={settings.marginTop} onChange={set('marginTop')} />
              <NumberInput label="Rand unten" unit="mm" min={0} max={80} value={settings.marginBottom} onChange={set('marginBottom')} />
              <NumberInput
                label={settings.twoSided ? 'Rand innen' : 'Rand links'}
                unit="mm"
                min={0}
                max={80}
                value={settings.marginInner}
                onChange={set('marginInner')}
              />
              <NumberInput
                label={settings.twoSided ? 'Rand außen' : 'Rand rechts'}
                unit="mm"
                min={0}
                max={80}
                value={settings.marginOuter}
                onChange={set('marginOuter')}
              />
            </div>
            <Toggle label="Doppelseitig (gespiegelte Ränder)" checked={settings.twoSided} onChange={set('twoSided')} />
          </Section>

          <Section title="Spalten">
            <div class="grid">
              <Select
                label="Anzahl"
                value={String(settings.columns)}
                options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: n === 1 ? '1 Spalte' : `${n} Spalten` }))}
                onChange={(v) => setSettings('columns', +v)}
              />
              <NumberInput label="Abstand" unit="mm" min={2} max={30} value={settings.columnGap} onChange={set('columnGap')} />
            </div>
            <Toggle label="Trennlinie zwischen Spalten" checked={settings.columnRule} disabled={settings.columns < 2} onChange={set('columnRule')} />
          </Section>

          <Section title="Schrift & Absatz">
            <div class="grid">
              <Select label="Schrift" value={settings.font} options={fontOptions} onChange={set('font')} />
              <Select label="Überschriften" value={settings.headingFont} options={fontOptions} onChange={set('headingFont')} />
              <NumberInput label="Schriftgröße" unit="pt" min={6} max={30} step={0.5} value={settings.fontSize} onChange={set('fontSize')} />
              <NumberInput
                label="Zeilenabstand"
                unit="em"
                min={0.2}
                max={3}
                step={0.05}
                value={settings.lineSpacing}
                onChange={set('lineSpacing')}
              />
              <NumberInput
                label="Absatzabstand"
                unit="em"
                min={0}
                max={3}
                step={0.05}
                value={settings.paragraphSpacing}
                onChange={set('paragraphSpacing')}
              />
            </div>
            <Toggle label="Jeder Vers in neuer Zeile" checked={settings.versePerLine} onChange={set('versePerLine')} />
            <Toggle label="Blocksatz" checked={settings.justify} onChange={set('justify')} />
            <Toggle label="Silbentrennung" checked={settings.hyphenate} onChange={set('hyphenate')} />
          </Section>

          <Section title="Inhalt">
            <Toggle label="Buchtitel bzw. Stellenangabe" checked={settings.showBookTitle} onChange={set('showBookTitle')} />
            <Segmented
              label="Kapitelnummern"
              value={settings.chapterStyle}
              options={[
                { value: 'dropcap', label: 'Groß' },
                { value: 'heading', label: 'Zeile' },
                { value: 'margin', label: 'Am Rand' },
                { value: 'none', label: 'Aus' },
              ]}
              onChange={set('chapterStyle')}
            />
            <Show when={settings.chapterStyle === 'heading'}>
              <Toggle label="„Kapitel 3“ statt „3“" checked={settings.chapterLabel} onChange={set('chapterLabel')} />
            </Show>
            <Segmented
              label="Versnummern"
              value={settings.verseStyle}
              options={[
                { value: 'super', label: 'Hochgestellt' },
                { value: 'inline', label: 'Klein' },
                { value: 'bold', label: 'Fett' },
                { value: 'none', label: 'Aus' },
              ]}
              onChange={set('verseStyle')}
            />
            <Toggle
              label="Zwischenüberschriften"
              checked={settings.showHeadings}
              onChange={set('showHeadings')}
              disabled={!features()?.headings}
              hint={features()?.headings ? undefined : 'Diese Übersetzung enthält keine Zwischenüberschriften'}
            />
            <Segmented
              label={features()?.footnotes ? 'Fußnoten' : 'Fußnoten (in dieser Übersetzung keine)'}
              value={settings.footnotes}
              options={[
                { value: 'page', label: 'Seitenende' },
                { value: 'end', label: 'Am Schluss' },
                { value: 'none', label: 'Aus' },
              ]}
              onChange={set('footnotes')}
            />
            <Toggle
              label="Worte Jesu farbig"
              checked={settings.wordsOfJesusRed}
              onChange={set('wordsOfJesusRed')}
              disabled={!features()?.wordsOfJesus}
              hint={features()?.wordsOfJesus ? undefined : 'Diese Übersetzung markiert die Worte Jesu nicht'}
            />
            <Toggle label="Kopfzeile mit Buch und Kapitel" checked={settings.runningHeader} onChange={set('runningHeader')} />
            <Toggle label="Seitenzahlen" checked={settings.pageNumbers} onChange={set('pageNumbers')} />
          </Section>

          <Section title="Farben">
            <div class="colors">
              <ColorInput label="Text" value={settings.textColor} onChange={set('textColor')} />
              <ColorInput label="Versnummern" value={settings.verseColor} onChange={set('verseColor')} />
              <ColorInput label="Kapitelnummern" value={settings.chapterColor} onChange={set('chapterColor')} />
              <ColorInput label="Überschriften" value={settings.headingColor} onChange={set('headingColor')} />
              <ColorInput label="Worte Jesu" value={settings.wjColor} onChange={set('wjColor')} />
            </div>
            <button
              type="button"
              class="link"
              onClick={() =>
                setSettings({
                  textColor: DEFAULTS.textColor,
                  verseColor: DEFAULTS.verseColor,
                  chapterColor: DEFAULTS.chapterColor,
                  headingColor: DEFAULTS.headingColor,
                  wjColor: DEFAULTS.wjColor,
                })
              }
            >
              Farben zurücksetzen
            </button>
            <button type="button" class="link" onClick={() => setSettings({ textColor: '#000000', verseColor: '#000000', chapterColor: '#000000', headingColor: '#000000', wjColor: '#000000' })}>
              Alles schwarz (spart Farbe)
            </button>
          </Section>

          <Section title="Notizspalte">
            <Segmented
              label="Notizspalte am Außenrand"
              value={settings.notesArea}
              options={[
                { value: 'none', label: 'Keine' },
                { value: 'lines', label: 'Liniert' },
                { value: 'blank', label: 'Frei' },
              ]}
              onChange={set('notesArea')}
            />
            <Show when={settings.notesArea !== 'none'}>
              <div class="grid">
                <NumberInput label="Breite" unit="mm" min={15} max={120} value={settings.notesWidth} onChange={set('notesWidth')} />
                <Show when={settings.notesArea === 'lines'}>
                  <NumberInput
                    label="Linienabstand"
                    unit="mm"
                    min={4}
                    max={20}
                    step={0.5}
                    value={settings.notesLineSpacing}
                    onChange={set('notesLineSpacing')}
                  />
                </Show>
              </div>
            </Show>
          </Section>

          <div class="reset">
            <button type="button" class="link" onClick={() => applyPreset({})}>
              Alle Layout-Einstellungen zurücksetzen
            </button>
          </div>
          </fieldset>
        </aside>

        <section class="preview-pane" aria-label="Vorschau">
          <div class="toolbar">
            <div class="status">
              <Show when={busy()}>
                <span class="spinner" aria-hidden="true" /> Setze …
              </Show>
              <Show when={!busy() && !parsed().error && preview()}>
                {(p) => (
                  <span>
                    {p().pages} {p().pages === 1 ? 'Seite' : 'Seiten'}
                    <Show when={p().truncated}> · Vorschau zeigt nur den Anfang</Show>
                  </span>
                )}
              </Show>
            </div>
            <div class="actions">
              <button type="button" class="secondary" onClick={share} disabled={!source()} title="Link mit Bibelstelle und allen Einstellungen kopieren">
                {copied() ? 'Link kopiert ✓' : 'Link teilen'}
              </button>
              <button
                type="button"
                class="secondary"
                onClick={downloadOdt}
                disabled={!source() || exportingOdt()}
                title="Bearbeitbares Dokument für Word und LibreOffice (.odt). Die Linien der Notizspalte gibt es nur im PDF."
              >
                {exportingOdt() ? 'Erzeuge Word-Datei …' : 'Word herunterladen'}
              </button>
              <button type="button" class="primary-btn" onClick={download} disabled={!source() || downloading()}>
                {downloading() ? 'Erzeuge PDF …' : 'PDF herunterladen'}
              </button>
            </div>
          </div>
          <Show when={previewError()}>
            <pre class="compile-error">{previewError()}</pre>
          </Show>
          <Show when={parsed().error}>
            {(error) => (
              <div class="reference-error" role="alert">
                <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" />
                  <path d="M12 7v6M12 16.5v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
                </svg>
                <div>
                  <strong>{error()}</strong>
                  <p>
                    Bitte die Bibelstelle links korrigieren, z. B. <em>Galater 1</em>, <em>Galater 1,12-17</em> oder <em>Römer</em>.
                  </p>
                </div>
              </div>
            )}
          </Show>
          <div class="pages" classList={{ stale: busy(), hidden: !!parsed().error }}>
            <Show when={preview()?.svg} fallback={<div class="placeholder">Lade Satzprogramm und Schriften …</div>}>
              <div class="doc" innerHTML={preview()!.svg} />
              <Show when={preview()?.truncated}>
                <p class="truncated-note">… die vollständige Fassung enthält das PDF.</p>
              </Show>
            </Show>
          </div>
        </section>
      </main>

      <footer class="footer">
        <Show when={translation()}>
          {(t) => (
            <p>
              <strong>{t().name}</strong> – {t().license}. Quelle:{' '}
              <a href={t().source} target="_blank" rel="noopener">
                eBible.org
              </a>
              .
            </p>
          )}
        </Show>
        <p>
          Print the word läuft komplett in deinem Browser: Die Texte werden als statische Dateien geladen, das PDF wird lokal mit{' '}
          <a href="https://typst.app" target="_blank" rel="noopener">
            Typst
          </a>{' '}
          gesetzt. Deine Einstellungen werden nur im localStorage deines Browsers gespeichert. Es werden ausschließlich gemeinfreie
          Übersetzungen verwendet; Schriften unter der SIL Open Font License.
        </p>
        <p class="legal">
          <a href="impressum.html">Impressum &amp; Datenschutz</a>
        </p>
      </footer>
    </div>
  );
}
