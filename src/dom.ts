type Child = Node | string | false | null | undefined;
type Attrs = Record<string, string | boolean | undefined | ((event: Event) => void)>;

/** Creates an element. Text children become text nodes, so values from the URI are never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') el.addEventListener(name.replace(/^on/, ''), value);
    else if (name === 'class') el.className = value === true ? '' : value;
    else el.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing`);
  return el as T;
}

/** Announces a short message to screen readers. */
export function announce(text: string): void {
  const region = byId('announcer');
  region.textContent = '';
  // A separate task, so repeating the same message is announced again.
  setTimeout(() => (region.textContent = text), 50);
}

/** A button that copies `text` to the clipboard and says so. */
export function copyButton(text: string, what: string): HTMLButtonElement {
  const button = h('button', { type: 'button', class: 'button button-small copy', 'aria-label': `Copy ${what}` }, 'Copy');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
      announce(`${what} copied`);
    } catch {
      button.textContent = 'Copy failed';
      announce('Copying is not available here; select the text instead');
    }
    setTimeout(() => (button.textContent = 'Copy'), 1500);
  });
  return button;
}
