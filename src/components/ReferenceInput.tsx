import { createMemo, createSignal, For, Show } from 'solid-js';
import { suggestBooks } from '../lib/books.ts';

interface Option {
  value: string;
  group: 'recent' | 'book';
}

/**
 * Text input for a Bible reference with a dropdown that offers recently used
 * references and – while typing a book name – matching books.
 */
export function ReferenceInput(props: {
  value: string;
  onInput: (v: string) => void;
  recent: string[];
  lang: 'de' | 'en';
  invalid: boolean;
  onRemoveRecent: (v: string) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  const [typed, setTyped] = createSignal(false);
  let input!: HTMLInputElement;

  const options = createMemo<Option[]>(() => {
    const value = props.value.trim();
    const out: Option[] = [];
    // only filter while the user is typing; opening via the button shows everything
    const filter = typed() && value ? value.toLowerCase() : '';
    for (const r of props.recent) if (!filter || r.toLowerCase().includes(filter)) out.push({ value: r, group: 'recent' });
    // suggest books while the input is just a (partial) book name
    if (typed() && /^\s*([1-5]\.?\s*)?\p{L}[\p{L}\s.]*$/u.test(value)) {
      for (const b of suggestBooks(value, props.lang, 6)) {
        const name = b[props.lang];
        if (name.toLowerCase() !== value.toLowerCase()) out.push({ value: name + ' ', group: 'book' });
      }
    }
    return out;
  });

  const choose = (o: Option) => {
    props.onInput(o.value);
    setTyped(o.group === 'book');
    if (o.group === 'recent') setOpen(false);
    setActive(-1);
    input.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const list = options();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open()) setOpen(true);
      setActive((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter' && open() && active() >= 0 && list[active()]) {
      e.preventDefault();
      choose(list[active()]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div class="combo" classList={{ invalid: props.invalid }} onFocusOut={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
    }}>
      <input
        ref={input}
        id="reference"
        class="reference"
        type="text"
        role="combobox"
        aria-expanded={open() && options().length > 0}
        aria-controls="reference-list"
        aria-autocomplete="list"
        aria-invalid={props.invalid}
        aria-activedescendant={active() >= 0 ? `reference-opt-${active()}` : undefined}
        value={props.value}
        placeholder="z. B. Galater 1,12-17"
        spellcheck={false}
        autocomplete="off"
        onInput={(e) => {
          setTyped(true);
          setOpen(true);
          setActive(-1);
          props.onInput(e.currentTarget.value);
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        class="combo-toggle"
        tabindex="-1"
        aria-label="Zuletzt verwendete Stellen anzeigen"
        onClick={() => {
          // while typing the list is filtered – the button then shows all entries
          if (open() && !typed()) setOpen(false);
          else {
            setTyped(false);
            setOpen(true);
          }
          input.focus();
        }}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <Show when={open() && (options().length > 0 || !typed())}>
        <ul class="combo-list" id="reference-list" role="listbox">
          <Show when={options().length === 0}>
            <li class="combo-empty">Noch keine zuletzt verwendeten Stellen</li>
          </Show>
          <For each={options()}>
            {(o, i) => (
              <>
                <Show when={i() === 0 || options()[i() - 1].group !== o.group}>
                  <li class="combo-group" role="presentation">
                    {o.group === 'recent' ? 'Zuletzt verwendet' : 'Bücher'}
                  </li>
                </Show>
                <li
                  id={`reference-opt-${i()}`}
                  role="option"
                  aria-selected={active() === i()}
                  classList={{ active: active() === i() }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                >
                  <span>{o.value}</span>
                  <Show when={o.group === 'recent'}>
                    <button
                      type="button"
                      class="combo-remove"
                      tabindex="-1"
                      aria-label={`„${o.value}“ aus der Liste entfernen`}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onRemoveRecent(o.value);
                      }}
                    >
                      ×
                    </button>
                  </Show>
                </li>
              </>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
