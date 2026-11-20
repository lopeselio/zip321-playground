import type { Network } from 'zcash-zip321';

/** What the URL hash records, so a link reproduces what the sender saw. */
export interface ShareState {
  uri: string;
  network?: Network;
  /** Only recorded when `false` (the default is `true`). */
  validateAddresses?: boolean;
}

const NETWORKS = new Set<string>(['main', 'test', 'regtest']);

/** `{ uri }` → `#uri=zcash%3A…`, plus `&network=…` and `&validate=0` when they differ from the defaults. */
export function encodeHash(state: ShareState): string {
  if (!state.uri) return '';
  let hash = `#uri=${encodeURIComponent(state.uri)}`;
  if (state.network) hash += `&network=${state.network}`;
  if (state.validateAddresses === false) hash += '&validate=0';
  return hash;
}

/** Reads a hash written by `encodeHash`. Unknown or malformed fields are ignored. */
export function decodeHash(hash: string): Partial<ShareState> {
  const out: Partial<ShareState> = {};
  for (const part of hash.replace(/^#/, '').split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    let value: string;
    try {
      value = decodeURIComponent(part.slice(eq + 1));
    } catch {
      continue;
    }
    if (key === 'uri') out.uri = value;
    else if (key === 'network' && NETWORKS.has(value)) out.network = value as Network;
    else if (key === 'validate') out.validateAddresses = value !== '0';
  }
  return out;
}
