import { For, Show, type JSX } from 'solid-js';
import type { SetStoreFunction } from 'solid-js/store';
import { markLabel } from '../lib/marks.ts';
import {
  LIGHT_COLORS,
  MARK_FRAMES,
  MARK_LINES,
  MAX_MARKS,
  newMark,
  STRONG_COLORS,
  type Mark,
  type Settings,
} from '../lib/settings.ts';
import { Toggle } from './Fields.tsx';

/** CSS approximation of a rule's effects for the sample in the side panel. */
function sampleStyle(m: Mark): JSX.CSSProperties {
  const css: JSX.CSSProperties = {};
  if (m.background) css.background = m.background;
  if (m.color) css.color = m.color;
  if (m.bold) css['font-weight'] = 700;
  if (m.italic) css['font-style'] = 'italic';
  if (m.line !== 'none') {
    css['text-decoration'] = `underline ${m.line} ${m.lineColor}`;
    css['text-underline-offset'] = '3px';
    css['text-decoration-thickness'] = m.line === 'wavy' ? '1px' : '1.5px';
  }
  if (m.frame !== 'none') {
    css.border = `1px ${m.frame === 'dashed' ? 'dashed' : 'solid'} ${m.frameColor}`;
    css['border-radius'] = m.frame === 'oval' ? '999px' : m.frame === 'rounded' ? '4px' : '0';
  }
  return css;
}

/** Suggested colours, an own colour and optionally "none" (''). */
function Swatches(props: { label: string; value: string; colors: string[]; none?: string; onChange: (v: string) => void }) {
  const custom = () => !!props.value && !props.colors.includes(props.value);
  return (
    <div class="swatches" role="radiogroup" aria-label={props.label}>
      <Show when={props.none}>
        <button
          type="button"
          role="radio"
          class="swatch none"
          classList={{ active: !props.value }}
          aria-checked={!props.value}
          title={props.none}
          onClick={() => props.onChange('')}
        />
      </Show>
      <For each={props.colors}>
        {(c) => (
          <button
            type="button"
            role="radio"
            class="swatch"
            classList={{ active: props.value === c }}
            aria-checked={props.value === c}
            title={c}
            style={{ background: c }}
            onClick={() => props.onChange(c)}
          />
        )}
      </For>
      <label class="swatch custom" classList={{ active: custom() }} title="Eigene Farbe" style={custom() ? { background: props.value } : {}}>
        <input type="color" value={props.value || props.colors[0]} onInput={(e) => props.onChange(e.currentTarget.value)} />
      </label>
    </div>
  );
}

function MarkRule(props: { mark: Mark; index: number; count: number; legend: boolean; setSettings: SetStoreFunction<Settings>; onRemove: () => void }) {
  const m = () => props.mark;
  const update = <K extends keyof Mark>(key: K, value: Mark[K]) => props.setSettings('marks', props.index, key, value as never);
  return (
    <div class="mark">
      <div class="mark-head">
        <input
          type="text"
          value={m().terms}
          placeholder="z. B. Jesus, Gott"
          aria-label={`Wörter für Markierung ${props.index + 1}`}
          onInput={(e) => update('terms', e.currentTarget.value)}
        />
        <span class="mark-count" title="Treffer im ganzen Dokument">
          {props.count}×
        </span>
        <button type="button" class="mark-remove" title="Markierung entfernen" aria-label="Markierung entfernen" onClick={props.onRemove}>
          ✕
        </button>
      </div>

      <div class="mark-row">
        <span class="field-label">Hintergrund</span>
        <Swatches label="Hintergrund" value={m().background} colors={LIGHT_COLORS} none="Kein Hintergrund" onChange={(v) => update('background', v)} />
      </div>
      <div class="mark-row">
        <span class="field-label">Schrift</span>
        <div class="mark-controls">
          <Swatches label="Schriftfarbe" value={m().color} colors={STRONG_COLORS} none="Normale Textfarbe" onChange={(v) => update('color', v)} />
          <div class="mark-font">
            <button type="button" aria-pressed={m().bold} classList={{ active: m().bold }} title="Fett" onClick={() => update('bold', !m().bold)}>
              <strong>F</strong>
            </button>
            <button type="button" aria-pressed={m().italic} classList={{ active: m().italic }} title="Kursiv" onClick={() => update('italic', !m().italic)}>
              <em>K</em>
            </button>
          </div>
        </div>
      </div>
      <div class="mark-row">
        <span class="field-label">Linie</span>
        <div class="mark-controls">
          <select value={m().line} aria-label="Linie" onChange={(e) => update('line', e.currentTarget.value as Mark['line'])}>
            <For each={MARK_LINES}>{(o) => <option value={o.value} selected={o.value === m().line}>{o.label}</option>}</For>
          </select>
          <Show when={m().line !== 'none'}>
            <Swatches label="Linienfarbe" value={m().lineColor} colors={STRONG_COLORS} onChange={(v) => update('lineColor', v)} />
          </Show>
        </div>
      </div>
      <div class="mark-row">
        <span class="field-label">Rahmen</span>
        <div class="mark-controls">
          <select value={m().frame} aria-label="Rahmen" onChange={(e) => update('frame', e.currentTarget.value as Mark['frame'])}>
            <For each={MARK_FRAMES}>{(o) => <option value={o.value} selected={o.value === m().frame}>{o.label}</option>}</For>
          </select>
          <Show when={m().frame !== 'none'}>
            <Swatches label="Rahmenfarbe" value={m().frameColor} colors={STRONG_COLORS} onChange={(v) => update('frameColor', v)} />
          </Show>
        </div>
      </div>

      <div class="mark-foot">
        <Show when={props.legend} fallback={<span />}>
          <input
            type="text"
            value={m().label}
            placeholder={markLabel(m()) ? `Legende: ${markLabel(m())}` : 'Text in der Legende'}
            aria-label={`Legende für Markierung ${props.index + 1}`}
            onInput={(e) => update('label', e.currentTarget.value)}
          />
        </Show>
        <span class="mark-sample">
          <span style={sampleStyle(m())}>Beispiel</span>
        </span>
      </div>
    </div>
  );
}

export function Marks(props: { settings: Settings; setSettings: SetStoreFunction<Settings>; counts: number[] }) {
  const set = props.setSettings;
  const add = () => {
    const used = new Set(props.settings.marks.map((m) => m.background));
    set('marks', props.settings.marks.length, newMark(LIGHT_COLORS.find((c) => !used.has(c)) ?? LIGHT_COLORS[0]));
  };

  return (
    <>
      <For each={props.settings.marks}>
        {(m, i) => (
          <MarkRule
            mark={m}
            index={i()}
            count={props.counts[i()] ?? 0}
            legend={props.settings.markLegend}
            setSettings={set}
            onRemove={() => set('marks', (marks) => marks.filter((_, j) => j !== i()))}
          />
        )}
      </For>
      <Show when={props.settings.marks.length < MAX_MARKS}>
        <button type="button" class="secondary add-mark" onClick={add}>
          + Markierung hinzufügen
        </button>
      </Show>
      <p class="help">
        Jedes Vorkommen wird gleich markiert, Groß-/Kleinschreibung egal. Mehrere Wörter oder Sätze mit Komma trennen (
        <code>Jesus, Gott</code>); <code>glaub*</code> trifft alle Wörter, die mit „glaub“ beginnen.
      </p>
      <Toggle label="Legende am Ende" checked={props.settings.markLegend} onChange={(v) => set('markLegend', v)} />
      <Show when={props.settings.markLegend}>
        <Toggle label="Legende auf eigener Seite" checked={props.settings.markLegendPage} onChange={(v) => set('markLegendPage', v)} />
        <Toggle label="Anzahl in der Legende" checked={props.settings.markCounts} onChange={(v) => set('markCounts', v)} />
      </Show>
    </>
  );
}
