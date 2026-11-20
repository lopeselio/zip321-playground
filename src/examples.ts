import type { Network } from 'zip321';

// Example data only: addresses from the ZIP-321 spec, the zip321 test suite and the public
// zcash-test-vectors Unified Address vectors. None of these belong to anyone's wallet.

/** Testnet P2PKH address from ZIP-321. */
export const T_ADDR = 'tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU';
/** Testnet Sapling address from ZIP-321. */
export const Z_ADDR = 'ztestsapling10yy2ex5dcqkclhc7z7yrnjq2z6feyjad56ptwlfgmy77dmaqqrl9gyhprdx59qgmsnyfska2kez';
/** Testnet Sapling-only Unified Address. */
export const U_TEST = 'utest10c5kutapazdnf8ztl3pu43nkfsjx89fy3uuff8tsmxm6s86j37pe7uz94z5jhkl49pqe8yz75rlsaygexk6jpaxwx0esjr8wm5ut7d5s';
/** Mainnet P2PKH address from the zcash_address vectors. */
export const T_MAIN = 't1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs';
/** Mainnet Unified Address with P2PKH, Sapling and Orchard receivers (zcash-test-vectors). */
export const U_MAIN =
  'u1pg2aaph7jp8rpf6yhsza25722sg5fcn3vaca6ze27hqjw7jvvhhuxkpcg0ge9xh6drsgdkda8qjq5chpehkcpxf87rnjryjqwymdheptpvnljqqrjqzjwkc2ma6hcq666kgwfytxwac8eyex6ndgr6ezte66706e3vaqrd25dzvzkc69kw0jgywtd0cmq52q5lkw6uh7hyvzjse8ksx';
/** The first `req-asset` value from ZIP-321: 10055 units of an example asset. */
export const ASSET = 'AEcnAAAAAAAAAADerb7v3q2-796tvu_erb7v3q2-796tvu_erb7v3q2-7xEiM0RVZneImQCqu8zd7v8AESIzRFVmd4iZqrvM3e7_';

export interface Example {
  id: string;
  title: string;
  valid: boolean;
  uri: string;
  /** Options the example needs (selected in the UI when it loads). */
  network?: Network;
  validateAddresses?: boolean;
  /** For invalid examples: the error the library must report. */
  expect?: { code: string; param?: string };
}

export const EXAMPLES: readonly Example[] = [
  {
    id: 'single',
    title: 'Single payment to a Unified Address',
    valid: true,
    uri: `zcash:${U_MAIN}?amount=1.5`,
  },
  {
    id: 'multi',
    title: 'Two payments (ZIP-321 example)',
    valid: true,
    uri: `zcash:?address=${T_ADDR}&amount=123.456&address.1=${Z_ADDR}&amount.1=0.789&memo.1=VGhpcyBpcyBhIHVuaWNvZGUgbWVtbyDinKjwn6aE8J-PhvCfjok`,
  },
  {
    id: 'memo',
    title: 'Memo and message (ZIP-321 example)',
    valid: true,
    uri: `zcash:${Z_ADDR}?amount=1&memo=VGhpcyBpcyBhIHNpbXBsZSBtZW1vLg&message=Thank%20you%20for%20your%20purchase`,
  },
  {
    id: 'label',
    title: 'Shop checkout: label, message, memo',
    valid: true,
    uri: `zcash:${U_TEST}?amount=0.25&memo=b3JkZXIgNDI&label=Maya's%20Caf%C3%A9&message=Order%2042%3A%202%20flat%20whites`,
  },
  {
    id: 'binary-memo',
    title: 'Binary (non-text) memo',
    valid: true,
    uri: `zcash:${Z_ADDR}?amount=0.01&memo=_wABAgOq`,
  },
  {
    id: 'asset',
    title: 'Custom Asset (req-asset)',
    valid: true,
    uri: `zcash:${U_MAIN}?req-asset=${ASSET}`,
  },
  {
    id: 'non-canonical',
    title: 'Valid but not canonical (gaps, case, extras)',
    valid: true,
    uri: `ZCASH:?Address=${T_ADDR}&AMOUNT=2.50&address.5=${Z_ADDR}&amount.5=1&ref.5=inv%2D7`,
  },
  {
    id: 'duplicate',
    title: 'Duplicate parameter',
    valid: false,
    uri: `zcash:?amount=1.234&amount=2.345&address=${T_ADDR}`,
    expect: { code: 'DUPLICATE_PARAM', param: 'amount' },
  },
  {
    id: 'bad-amount',
    title: 'Amount with 9 decimals',
    valid: false,
    uri: `zcash:?address=${T_ADDR}&amount=1&address.1=${Z_ADDR}&amount.1=1&address.2=${U_TEST}&amount.2=0.123456789`,
    expect: { code: 'INVALID_AMOUNT', param: 'amount.2' },
  },
  {
    id: 'memo-transparent',
    title: 'Memo to a transparent address',
    valid: false,
    uri: `zcash:?address=${T_ADDR}&amount=123.456&memo=eyAia2V5IjogIlRoaXMgaXMgYSBKU09OLXN0cnVjdHVyZWQgbWVtby4iIH0&address.1=${Z_ADDR}`,
    expect: { code: 'MEMO_NOT_ALLOWED', param: 'memo' },
  },
  {
    id: 'mixed-network',
    title: 'Mainnet and testnet addresses mixed',
    valid: false,
    uri: `zcash:?address=${T_MAIN}&amount=1&address.1=${Z_ADDR}&amount.1=1`,
    expect: { code: 'WRONG_NETWORK', param: 'address.1' },
  },
  {
    id: 'wrong-network',
    title: 'Testnet address, mainnet expected',
    valid: false,
    uri: `zcash:${Z_ADDR}?amount=1`,
    network: 'main',
    expect: { code: 'WRONG_NETWORK', param: 'address' },
  },
  {
    id: 'checksum',
    title: 'Address with a typo (bad checksum)',
    valid: false,
    uri: `zcash:${Z_ADDR.slice(0, -1)}x?amount=1`,
    expect: { code: 'INVALID_ADDRESS', param: 'address' },
  },
  {
    id: 'missing-address',
    title: 'Parameter without an address',
    valid: false,
    uri: `zcash:?address=${T_ADDR}&amount=1&amount.1=2&address.2=${Z_ADDR}`,
    expect: { code: 'MISSING_ADDRESS', param: 'amount.1' },
  },
  {
    id: 'req-unknown',
    title: 'Unsupported required parameter',
    valid: false,
    uri: `zcash:${Z_ADDR}?amount=1&req-tip=0.1`,
    expect: { code: 'UNSUPPORTED_REQUIRED_PARAM', param: 'req-tip' },
  },
];
