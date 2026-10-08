import { For, type JSX } from 'solid-js';

export function Field(props: { label: string; hint?: string; children: JSX.Element; wide?: boolean }) {
  return (
    <label class="field" classList={{ wide: props.wide }}>
      <span class="field-label">{props.label}</span>
      {props.children}
      {props.hint && <span class="field-hint">{props.hint}</span>}
    </label>
  );
}

export function Select<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  wide?: boolean;
}) {
  return (
    <Field label={props.label} wide={props.wide}>
      <select value={props.value} onChange={(e) => props.onChange(e.currentTarget.value as T)}>
        <For each={props.options}>
          {(o) => (
            // `selected` keeps the value when options arrive after the select was rendered
            <option value={o.value} selected={o.value === props.value}>
              {o.label}
            </option>
          )}
        </For>
      </select>
    </Field>
  );
}

export function NumberInput(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <Field label={props.label}>
      <span class="number">
        <input
          type="number"
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onInput={(e) => {
            const v = e.currentTarget.valueAsNumber;
            if (Number.isFinite(v)) props.onChange(Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, v)));
          }}
        />
        {props.unit && <span class="unit">{props.unit}</span>}
      </span>
    </Field>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <label class="toggle" classList={{ disabled: props.disabled }} title={props.hint}>
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.currentTarget.checked)} />
      <span class="switch" aria-hidden="true" />
      <span>{props.label}</span>
    </label>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="field wide">
      <span class="field-label">{props.label}</span>
      <div class="segmented" role="radiogroup" aria-label={props.label}>
        <For each={props.options}>
          {(o) => (
            <button
              type="button"
              role="radio"
              aria-checked={props.value === o.value}
              classList={{ active: props.value === o.value }}
              onClick={() => props.onChange(o.value)}
            >
              {o.label}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

export function ColorInput(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label class="color">
      <input type="color" value={props.value} onInput={(e) => props.onChange(e.currentTarget.value)} />
      <span>{props.label}</span>
    </label>
  );
}

export function Section(props: { title: string; open?: boolean; children: JSX.Element }) {
  return (
    <details class="section" open={props.open}>
      <summary>{props.title}</summary>
      <div class="section-body">{props.children}</div>
    </details>
  );
}
