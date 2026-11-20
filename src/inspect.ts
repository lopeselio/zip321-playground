import {
  decodeAddress,
  formatPaymentRequest,
  memoText,
  parsePaymentRequest,
  ZIP321Error,
  type AddressKind,
  type Network,
  type Payment,
  type ReceiverKind,
  type ZIP321Options,
} from 'zip321';
import { ADDRESS_KIND_NAMES, groupDigits, networksLabel, receiverName, toHex, zecString } from './format.ts';
import { markParam, splitKey, tokenize, type Token } from './tokens.ts';

export interface InspectOptions {
  /** Required network, or `undefined` for any. */
  network?: Network;
  /** Maps to the library's `validateAddresses` (default `true`). */
  validateAddresses?: boolean;
}

export interface ReceiverView {
  kind: ReceiverKind;
  typecode: number;
  name: string;
  bytes: number;
}

export interface PaymentView {
  index: number;
  /** `''` for index 0, else `.N`, as parameters for this payment are suffixed. */
  suffix: string;
  address: string;
  /** False when address validation was turned off. */
  validated: boolean;
  kind?: AddressKind;
  kindLabel: string;
  networks?: readonly Network[];
  networksLabel?: string;
  receivers?: ReceiverView[];
  canReceiveMemo: boolean;
  transparentOnly: boolean;
  amount?: { zatoshi: bigint; zec: string; zatoshiLabel: string };
  asset?: { value: string; assetIdHex: string };
  memo?: { bytes: number; text?: string; hex: string };
  label?: string;
  message?: string;
  otherParams: [name: string, value: string | null][];
}

export interface ValidView {
  status: 'valid';
  /** The URI that was parsed (input without surrounding whitespace). */
  uri: string;
  /** Whether surrounding whitespace was removed from the input. */
  trimmed: boolean;
  /** The network the request is for, when it is pinned down. */
  network?: Network;
  /** Human description of the network(s), e.g. "Testnet or Regtest". */
  networkLabel: string;
  payments: PaymentView[];
  total: {
    zatoshi: bigint;
    zec: string;
    zatoshiLabel: string;
    /** Payments that carry a ZEC amount. */
    withAmount: number;
    /** Payments with neither an amount nor a Custom Asset (the payer chooses). */
    withoutAmount: number;
    /** Payments in a Custom Asset, which the ZEC total excludes. */
    assetPayments: number;
  };
  canonical: string;
  isCanonical: boolean;
  tokens: Token[];
}

export interface ErrorView {
  code: string;
  message: string;
  /** What the error code means in general. */
  description: string;
  param?: string;
  /** True when the library did not name the parameter and the playground worked it out. */
  paramInferred: boolean;
}

export interface InvalidView {
  status: 'invalid';
  uri: string;
  trimmed: boolean;
  error: ErrorView;
  /** The URI split into pieces, with the offending parameter marked. */
  tokens: Token[];
}

export type InspectResult = { status: 'empty' } | ValidView | InvalidView;

export const ERROR_DESCRIPTIONS: Record<string, string> = {
  INVALID_URI: 'The text does not match the ZIP-321 URI grammar.',
  INVALID_PARAM: 'A parameter name, index or value is malformed.',
  DUPLICATE_PARAM: 'The same parameter appears twice for one payment.',
  MISSING_ADDRESS: 'A payment has parameters but no address.',
  NO_PAYMENTS: 'The request contains no payments.',
  INVALID_AMOUNT: 'An amount is malformed, has more than 8 decimals, or is above 21,000,000 ZEC.',
  INVALID_MEMO: 'A memo is not unpadded base64url, or decodes to more than 512 bytes.',
  MEMO_NOT_ALLOWED: 'A memo is attached to an address that cannot receive one.',
  ZERO_TRANSPARENT_AMOUNT: 'A zero-valued payment to a transparent address, which consensus rejects.',
  INVALID_ASSET: 'A req-asset value is malformed or is not paid to an Orchard receiver.',
  AMOUNT_AND_ASSET: 'amount and req-asset are both given for one payment.',
  UNSUPPORTED_REQUIRED_PARAM: 'A req- parameter this implementation does not understand; ZIP-321 says to reject the request.',
  INVALID_ADDRESS: 'An address fails to decode (checksum, encoding or structure).',
  UNSUPPORTED_ADDRESS: 'An address type that ZIP-321 forbids (Sprout).',
  WRONG_NETWORK: 'An address is not for the expected network, or the addresses mix networks.',
  UNEXPECTED: 'An unexpected error, not a ZIP321Error. This is a bug worth reporting.',
};

const ALL_NETWORKS: readonly Network[] = ['main', 'test', 'regtest'];

export function toLibraryOptions(options: InspectOptions): ZIP321Options {
  const out: ZIP321Options = {};
  if (options.network) out.network = options.network;
  if (options.validateAddresses === false) out.validateAddresses = false;
  return out;
}

/** Parses `input` and turns the outcome into a plain view model. Never throws. */
export function inspect(input: string, options: InspectOptions = {}): InspectResult {
  const uri = input.trim();
  if (uri === '') return { status: 'empty' };
  const trimmed = uri !== input;
  const libOptions = toLibraryOptions(options);

  let request;
  try {
    request = parsePaymentRequest(uri, libOptions);
  } catch (err) {
    const error = describeError(err, uri);
    return { status: 'invalid', uri, trimmed, error, tokens: markParam(tokenize(uri), error.param) };
  }

  const payments = request.payments.map(paymentView);
  let canonical: string;
  try {
    canonical = formatPaymentRequest(request, libOptions);
  } catch (err) {
    // The library re-parses what it formats, so this would be a library bug. Report it as one.
    const error = describeError(err, uri);
    return { status: 'invalid', uri, trimmed, error: { ...error, code: 'UNEXPECTED' }, tokens: tokenize(uri) };
  }

  let zatoshi = 0n;
  let withAmount = 0;
  let withoutAmount = 0;
  let assetPayments = 0;
  for (const p of request.payments) {
    if (p.amount !== undefined) {
      zatoshi += p.amount;
      withAmount++;
    } else if (p.asset) assetPayments++;
    else withoutAmount++;
  }

  const view: ValidView = {
    status: 'valid',
    uri,
    trimmed,
    networkLabel: describeNetwork(request.network, request.payments, options),
    payments,
    total: { zatoshi, zec: zecString(zatoshi), zatoshiLabel: groupDigits(zatoshi), withAmount, withoutAmount, assetPayments },
    canonical,
    isCanonical: canonical === uri,
    tokens: tokenize(uri),
  };
  if (request.network) view.network = request.network;
  return view;
}

function describeNetwork(network: Network | undefined, payments: Payment[], options: InspectOptions): string {
  if (network) return networksLabel([network]);
  if (options.validateAddresses === false) return 'Unknown (address validation is off)';
  // Transparent Base58 addresses share a prefix on testnet and regtest.
  let possible = ALL_NETWORKS;
  for (const p of payments) possible = possible.filter((n) => p.addressInfo?.networks.includes(n));
  return networksLabel(possible);
}

function paymentView(p: Payment): PaymentView {
  const info = p.addressInfo;
  const transparentOnly = info ? info.transparentOnly : /^(t[1-3m]|tex)/i.test(p.address);
  const view: PaymentView = {
    index: p.index,
    suffix: p.index ? `.${p.index}` : '',
    address: p.address,
    validated: info !== undefined,
    kindLabel: info ? ADDRESS_KIND_NAMES[info.kind] : 'Not validated',
    canReceiveMemo: info ? info.canReceiveMemo : !transparentOnly,
    transparentOnly,
    otherParams: Object.entries(p.otherParams),
  };
  if (info) {
    view.kind = info.kind;
    view.networks = info.networks;
    view.networksLabel = networksLabel(info.networks);
    if (info.receivers) {
      view.receivers = info.receivers.map((r) => ({
        kind: r.kind,
        typecode: r.typecode,
        name: receiverName(r.kind, r.typecode),
        bytes: r.data.length,
      }));
    }
  }
  if (p.amount !== undefined) {
    view.amount = { zatoshi: p.amount, zec: zecString(p.amount), zatoshiLabel: groupDigits(p.amount) };
  }
  if (p.asset) view.asset = { value: groupDigits(p.asset.value), assetIdHex: toHex(p.asset.assetId) };
  if (p.memo) {
    const text = memoText(p.memo);
    view.memo = { bytes: p.memo.length, hex: toHex(p.memo) };
    if (text !== undefined) view.memo.text = text;
  }
  if (p.label !== undefined) view.label = p.label;
  if (p.message !== undefined) view.message = p.message;
  return view;
}

export function describeError(err: unknown, uri: string): ErrorView {
  if (!(err instanceof ZIP321Error)) {
    return {
      code: 'UNEXPECTED',
      message: err instanceof Error ? err.message : String(err),
      description: ERROR_DESCRIPTIONS.UNEXPECTED!,
      paramInferred: false,
    };
  }
  const view: ErrorView = {
    code: err.code,
    message: err.message,
    description: ERROR_DESCRIPTIONS[err.code] ?? '',
    paramInferred: false,
  };
  if (err.param !== undefined) view.param = err.param;
  else if (err.code === 'INVALID_ADDRESS' || err.code === 'UNSUPPORTED_ADDRESS') {
    // decodeAddress does not know which parameter it was given; find the first address
    // (in payment order, as the parser checks them) that fails the same way.
    const param = locateBadAddress(uri, err.code);
    if (param) {
      view.param = param;
      view.paramInferred = true;
    }
  }
  return view;
}

function locateBadAddress(uri: string, code: string): string | undefined {
  const addresses = tokenize(uri)
    .filter((t) => t.key !== undefined && splitKey(t.key)[0].toLowerCase() === 'address' && typeof t.value === 'string')
    .map((t) => ({ key: t.key!, value: t.value!, index: splitKey(t.key!)[1] }))
    .sort((a, b) => a.index - b.index);
  for (const a of addresses) {
    try {
      decodeAddress(a.value);
    } catch (err) {
      if (err instanceof ZIP321Error && err.code === code) return a.key;
    }
  }
  return undefined;
}
