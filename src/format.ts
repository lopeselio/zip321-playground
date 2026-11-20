import type { AddressKind, Network, ReceiverKind } from 'zcash-zip321';

const ZAT_PER_ZEC = 100_000_000n;

/** Exact decimal ZEC for any non-negative zatoshi value (totals can exceed MAX_MONEY). */
export function zecString(zatoshi: bigint): string {
  const whole = zatoshi / ZAT_PER_ZEC;
  const fraction = (zatoshi % ZAT_PER_ZEC).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${groupDigits(whole)}.${fraction}` : groupDigits(whole);
}

/** `1234567n` → `"1,234,567"`. Locale-independent so output is stable in tests. */
export function groupDigits(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export const NETWORK_NAMES: Record<Network, string> = {
  main: 'Mainnet',
  test: 'Testnet',
  regtest: 'Regtest',
};

export function networksLabel(networks: readonly Network[]): string {
  return networks.map((n) => NETWORK_NAMES[n]).join(' or ');
}

export const ADDRESS_KIND_NAMES: Record<AddressKind, string> = {
  p2pkh: 'Transparent (P2PKH)',
  p2sh: 'Transparent (P2SH)',
  sapling: 'Sapling',
  unified: 'Unified Address',
  tex: 'TEX (transparent-source-only)',
};

const RECEIVER_NAMES: Record<ReceiverKind, string> = {
  p2pkh: 'P2PKH',
  p2sh: 'P2SH',
  sapling: 'Sapling',
  // Ironwood payments use Orchard-format (typecode 3) receivers.
  orchard: 'Orchard / Ironwood-format',
  unknown: 'Unknown',
};

export function receiverName(kind: ReceiverKind, typecode: number): string {
  return kind === 'unknown' ? `Unknown (typecode 0x${typecode.toString(16)})` : RECEIVER_NAMES[kind];
}
