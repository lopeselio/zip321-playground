import { copyButton, h } from './dom.ts';
import type { InspectResult, InvalidView, PaymentView, ValidView } from './inspect.ts';
import type { Token } from './tokens.ts';

export interface RenderHooks {
  /** Milliseconds the parse took, shown in the summary. */
  elapsedMs: number;
  /** Replaces the input with the canonical form. */
  useCanonical(uri: string): void;
  /** Fills `container` with a QR code of `uri` (asynchronously). */
  drawQr(container: HTMLElement, uri: string): void;
}

export function render(result: InspectResult, summary: HTMLElement, results: HTMLElement, hooks: RenderHooks): void {
  if (result.status === 'empty') {
    summary.replaceChildren(h('p', { class: 'muted' }, 'Paste a URI, scan a QR code or pick an example.'));
    results.replaceChildren();
    return;
  }
  const timing = `parsed in ${formatMs(hooks.elapsedMs)}`;
  if (result.status === 'invalid') {
    summary.replaceChildren(
      h('p', { class: 'verdict verdict-bad' }, h('span', { class: 'badge badge-bad' }, 'Invalid'), ` ${result.error.code}`),
      h('p', { class: 'muted small' }, `Rejected, ${timing}.`),
    );
    results.replaceChildren(renderError(result));
    return;
  }
  const n = result.payments.length;
  summary.replaceChildren(
    h(
      'p',
      { class: 'verdict verdict-ok' },
      h('span', { class: 'badge badge-ok' }, 'Valid'),
      ` ${n} payment${n === 1 ? '' : 's'} on ${result.networkLabel}`,
    ),
    h('p', { class: 'muted small' }, `${totalText(result)}, ${timing}.`),
  );
  results.replaceChildren(
    renderTotals(result),
    renderCanonical(result, hooks),
    ...result.payments.map((p) => renderPayment(p, n)),
  );
}

function formatMs(ms: number): string {
  return ms < 1 ? `${ms.toFixed(2)} ms` : `${ms.toFixed(1)} ms`;
}

function totalText(view: ValidView): string {
  return view.total.withAmount ? `Total ${view.total.zec} ZEC` : 'No ZEC amount';
}

function renderTotals(view: ValidView): HTMLElement {
  const { total } = view;
  const notes: string[] = [];
  if (total.withoutAmount) {
    notes.push(`${total.withoutAmount} payment${total.withoutAmount === 1 ? ' has' : 's have'} no amount; the payer chooses.`);
  }
  if (total.assetPayments) {
    notes.push(`${total.assetPayments} Custom Asset payment${total.assetPayments === 1 ? ' is' : 's are'} not included.`);
  }
  if (view.trimmed) notes.push('Whitespace around the URI was ignored.');
  return h(
    'section',
    { class: 'card overview', 'aria-label': 'Overview' },
    h(
      'dl',
      { class: 'stats' },
      stat('Network', view.networkLabel),
      stat('Payments', String(view.payments.length)),
      stat('Total', total.withAmount ? `${total.zec} ZEC` : '—', total.withAmount ? `${total.zatoshiLabel} zatoshi` : undefined),
    ),
    notes.length ? h('ul', { class: 'notes' }, notes.map((note) => h('li', null, note))) : null,
  );
}

function stat(label: string, value: string, sub?: string): HTMLElement {
  return h('div', { class: 'stat' }, h('dt', null, label), h('dd', null, value, sub ? h('span', { class: 'sub' }, sub) : null));
}

function renderCanonical(view: ValidView, hooks: RenderHooks): HTMLElement {
  const qr = h('div', { class: 'qr', role: 'img', 'aria-label': 'QR code of the canonical URI' });
  hooks.drawQr(qr, view.canonical);
  return h(
    'section',
    { class: 'card canonical', 'aria-labelledby': 'canonical-heading' },
    h(
      'div',
      { class: 'canonical-text' },
      h('h3', { id: 'canonical-heading' }, 'Canonical form'),
      view.isCanonical
        ? h('p', { class: 'status status-ok' }, 'The input is already canonical.')
        : h(
            'p',
            { class: 'status status-warn' },
            'The input is valid but not canonical. formatPaymentRequest writes it as:',
          ),
      h('pre', { class: 'uri' }, h('code', null, view.canonical)),
      h(
        'div',
        { class: 'row' },
        copyButton(view.canonical, 'canonical URI'),
        view.isCanonical
          ? null
          : h('button', { type: 'button', class: 'button button-small', onclick: () => hooks.useCanonical(view.canonical) }, 'Use canonical form'),
      ),
    ),
    h('figure', { class: 'qr-figure' }, qr, h('figcaption', null, 'Scan with a Zcash wallet')),
  );
}

function renderPayment(p: PaymentView, count: number): HTMLElement {
  const title = count === 1 ? 'Payment' : `Payment ${p.index}`;
  const headingId = `payment-${p.index}`;
  const rows: HTMLElement[] = [];
  const row = (label: string, ...value: (Node | string | null)[]) =>
    rows.push(h('div', { class: 'row-item' }, h('dt', null, label), h('dd', null, ...value)));

  row('Address', h('code', { class: 'mono address' }, p.address), copyButton(p.address, `address of ${title.toLowerCase()}`));
  row('Type', p.kindLabel, p.validated ? null : h('span', { class: 'muted' }, ' (address validation is off)'));
  if (p.networksLabel) row('Network', p.networksLabel);
  if (p.receivers) {
    row(
      'Receivers',
      h(
        'ul',
        { class: 'chips' },
        p.receivers.map((r) =>
          h('li', { class: `chip chip-${r.kind}` }, r.name, h('span', { class: 'chip-meta' }, ` typecode ${r.typecode}, ${r.bytes} bytes`)),
        ),
      ),
    );
  }
  row('Memo support', p.canReceiveMemo ? 'Can receive a memo' : 'Cannot receive a memo');

  if (p.amount) row('Amount', h('span', { class: 'amount' }, `${p.amount.zec} ZEC`), h('span', { class: 'sub' }, `${p.amount.zatoshiLabel} zatoshi`));
  else if (!p.asset) row('Amount', h('span', { class: 'muted' }, 'Not specified; the payer chooses'));
  if (p.asset) {
    row(
      'Asset',
      h('span', { class: 'amount' }, `${p.asset.value} units`),
      h('span', { class: 'sub' }, 'Asset ID'),
      h('code', { class: 'mono hex' }, p.asset.assetIdHex),
    );
  }
  if (p.memo) {
    row(
      'Memo',
      p.memo.text !== undefined
        ? h('p', { class: 'memo-text' }, p.memo.text || '(empty)')
        : h('code', { class: 'mono hex' }, p.memo.hex || '(empty)'),
      h(
        'span',
        { class: 'sub' },
        `${p.memo.bytes} byte${p.memo.bytes === 1 ? '' : 's'}, ${p.memo.text !== undefined ? 'UTF-8 text (ZIP 302)' : 'binary, shown as hex'}`,
      ),
    );
  }
  if (p.label !== undefined) row('Label', p.label || h('span', { class: 'muted' }, '(empty)'));
  if (p.message !== undefined) row('Message', p.message || h('span', { class: 'muted' }, '(empty)'));
  if (p.otherParams.length) {
    row(
      'Other parameters',
      h(
        'ul',
        { class: 'params' },
        p.otherParams.map(([name, value]) => h('li', null, h('code', { class: 'mono' }, value === null ? name : `${name} = ${value}`))),
      ),
      h('span', { class: 'sub' }, 'Wallets ignore these (ZIP-321); they are kept so the request round-trips.'),
    );
  }

  return h(
    'article',
    { class: 'card payment', 'aria-labelledby': headingId },
    h(
      'header',
      { class: 'payment-head' },
      h('h3', { id: headingId }, title),
      h('code', { class: 'param-chip' }, `address${p.suffix}`),
    ),
    p.transparentOnly
      ? h(
          'p',
          { class: 'callout callout-warn' },
          h('strong', null, 'Transparent only. '),
          'This payment goes to a transparent output: the amount and recipient are public on chain.',
        )
      : null,
    h('dl', { class: 'fields' }, rows),
  );
}

function renderError(view: InvalidView): HTMLElement {
  const { error } = view;
  const hasMark = view.tokens.some((t) => t.mark);
  return h(
    'section',
    { class: 'card error', 'aria-labelledby': 'error-heading' },
    h('h3', { id: 'error-heading' }, h('code', { class: 'error-code' }, error.code)),
    h('p', { class: 'error-message' }, error.message),
    error.description ? h('p', { class: 'muted' }, error.description) : null,
    h(
      'dl',
      { class: 'fields' },
      h(
        'div',
        { class: 'row-item' },
        h('dt', null, 'Parameter'),
        h(
          'dd',
          null,
          error.param ? h('code', { class: 'mono' }, error.param) : h('span', { class: 'muted' }, 'none (the URI as a whole)'),
        ),
      ),
    ),
    h('h4', null, hasMark ? 'Where' : 'Input'),
    h('pre', { class: 'uri' }, h('code', null, view.tokens.map(renderToken))),
  );
}

function renderToken(token: Token): Node {
  return token.mark ? h('mark', null, token.text) : document.createTextNode(token.text);
}
