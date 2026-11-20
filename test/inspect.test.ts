import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect, type InspectResult, type InvalidView, type ValidView } from '../src/inspect.ts';
import { ASSET, T_ADDR, U_MAIN, U_TEST, Z_ADDR } from '../src/examples.ts';

function valid(result: InspectResult): ValidView {
  assert.equal(result.status, 'valid', result.status === 'invalid' ? `${result.error.code}: ${result.error.message}` : '');
  return result as ValidView;
}
function invalid(result: InspectResult): InvalidView {
  assert.equal(result.status, 'invalid');
  return result as InvalidView;
}
const marked = (view: InvalidView) => view.tokens.filter((t) => t.mark).map((t) => t.text);

test('empty and whitespace-only input is "empty", not an error', () => {
  assert.deepEqual(inspect(''), { status: 'empty' });
  assert.deepEqual(inspect('  \n\t'), { status: 'empty' });
});

test('a single Sapling payment with a text memo and message', () => {
  const uri = `zcash:${Z_ADDR}?amount=1&memo=VGhpcyBpcyBhIHNpbXBsZSBtZW1vLg&message=Thank%20you%20for%20your%20purchase`;
  const view = valid(inspect(uri));
  assert.equal(view.network, 'test');
  assert.equal(view.networkLabel, 'Testnet');
  assert.equal(view.payments.length, 1);
  const [p] = view.payments;
  assert.equal(p!.index, 0);
  assert.equal(p!.suffix, '');
  assert.equal(p!.address, Z_ADDR);
  assert.equal(p!.kind, 'sapling');
  assert.equal(p!.kindLabel, 'Sapling');
  assert.equal(p!.canReceiveMemo, true);
  assert.equal(p!.transparentOnly, false);
  assert.deepEqual(p!.amount, { zatoshi: 100_000_000n, zec: '1', zatoshiLabel: '100,000,000' });
  assert.equal(p!.memo!.text, 'This is a simple memo.');
  assert.equal(p!.memo!.bytes, 22);
  assert.equal(p!.message, 'Thank you for your purchase');
  assert.equal(p!.label, undefined);
  assert.equal(view.isCanonical, true);
  assert.equal(view.canonical, uri);
});

test('a multi-payment request lists payments in order and totals the amounts', () => {
  const uri = `zcash:?address=${T_ADDR}&amount=123.456&address.1=${Z_ADDR}&amount.1=0.789&memo.1=VGhpcyBpcyBhIHVuaWNvZGUgbWVtbyDinKjwn6aE8J-PhvCfjok`;
  const view = valid(inspect(uri));
  assert.deepEqual(view.payments.map((p) => [p.index, p.suffix, p.kind]), [
    [0, '', 'p2pkh'],
    [1, '.1', 'sapling'],
  ]);
  assert.equal(view.payments[0]!.transparentOnly, true);
  assert.equal(view.payments[0]!.canReceiveMemo, false);
  assert.equal(view.payments[0]!.networksLabel, 'Testnet or Regtest');
  assert.equal(view.payments[1]!.memo!.text, 'This is a unicode memo ✨🦄🏆🎉');
  assert.equal(view.total.zatoshi, 12_424_500_000n);
  assert.equal(view.total.zec, '124.245');
  assert.equal(view.total.zatoshiLabel, '12,424,500,000');
  assert.equal(view.total.withAmount, 2);
  assert.equal(view.network, 'test'); // the Sapling address pins it down
  assert.equal(view.isCanonical, true);
});

test('a transparent-only request reports both networks it could be for', () => {
  const view = valid(inspect(`zcash:${T_ADDR}?amount=1`));
  assert.equal(view.network, undefined);
  assert.equal(view.networkLabel, 'Testnet or Regtest');
  const pinned = valid(inspect(`zcash:${T_ADDR}?amount=1`, { network: 'regtest' }));
  assert.equal(pinned.network, 'regtest');
});

test('Unified Address receivers are listed with kind and typecode', () => {
  const view = valid(inspect(`zcash:${U_MAIN}?amount=1.5`));
  const [p] = view.payments;
  assert.equal(view.network, 'main');
  assert.equal(p!.kindLabel, 'Unified Address');
  assert.deepEqual(
    p!.receivers!.map((r) => [r.kind, r.typecode, r.name, r.bytes]),
    [
      ['p2pkh', 0, 'P2PKH', 20],
      ['sapling', 2, 'Sapling', 43],
      ['orchard', 3, 'Orchard / Ironwood-format', 43],
    ],
  );
  assert.equal(p!.canReceiveMemo, true);
  assert.equal(p!.transparentOnly, false);
  assert.deepEqual(p!.amount, { zatoshi: 150_000_000n, zec: '1.5', zatoshiLabel: '150,000,000' });
});

test('a Sapling-only testnet Unified Address with label and percent-encoded text', () => {
  const view = valid(inspect(`zcash:${U_TEST}?amount=0.25&memo=b3JkZXIgNDI&label=Maya's%20Caf%C3%A9`));
  const [p] = view.payments;
  assert.deepEqual(p!.receivers!.map((r) => r.kind), ['sapling']);
  assert.equal(p!.label, "Maya's Café");
  assert.equal(p!.memo!.text, 'order 42');
});

test('binary memos have no text and are shown as hex', () => {
  const view = valid(inspect(`zcash:${Z_ADDR}?amount=0.01&memo=_wABAgOq`));
  const memo = view.payments[0]!.memo!;
  assert.equal(memo.text, undefined);
  assert.equal(memo.hex, 'ff00010203aa');
  assert.equal(memo.bytes, 6);
});

test('Custom Asset payments show the asset and are left out of the ZEC total', () => {
  const view = valid(inspect(`zcash:${U_MAIN}?req-asset=${ASSET}`));
  const [p] = view.payments;
  assert.equal(p!.amount, undefined);
  assert.equal(p!.asset!.value, '10,055');
  assert.equal(p!.asset!.assetIdHex.length, 132); // 66 bytes
  assert.equal(view.total.assetPayments, 1);
  assert.equal(view.total.withAmount, 0);
  assert.equal(view.total.zatoshi, 0n);
});

test('payments without an amount are counted separately', () => {
  const view = valid(inspect(`zcash:${Z_ADDR}`));
  assert.equal(view.payments[0]!.amount, undefined);
  assert.equal(view.total.withoutAmount, 1);
});

test('totals above 21,000,000 ZEC are still exact', () => {
  const view = valid(inspect(`zcash:?address=${Z_ADDR}&amount=21000000&address.1=${Z_ADDR}&amount.1=0.00000001`));
  assert.equal(view.total.zec, '21,000,000.00000001');
});

test('canonical form: non-canonical input is detected and normalized', () => {
  const uri = `ZCASH:?Address=${T_ADDR}&AMOUNT=2.50&address.5=${Z_ADDR}&amount.5=1&ref.5=inv%2D7`;
  const view = valid(inspect(uri));
  assert.equal(view.isCanonical, false);
  assert.equal(view.canonical, `zcash:?address=${T_ADDR}&amount=2.5&address.1=${Z_ADDR}&amount.1=1&ref.1=inv-7`);
  assert.deepEqual(view.payments[1]!.otherParams, [['ref', 'inv-7']]);
  assert.equal(valid(inspect(view.canonical)).isCanonical, true);
});

test('surrounding whitespace is trimmed and reported', () => {
  const view = valid(inspect(`  zcash:${Z_ADDR}?amount=1\n`));
  assert.equal(view.trimmed, true);
  assert.equal(view.isCanonical, true);
});

test('with validation off, addresses are not decoded and the network comes from the options', () => {
  const typo = Z_ADDR.slice(0, -1) + 'x';
  const view = valid(inspect(`zcash:${typo}?amount=1`, { validateAddresses: false }));
  assert.equal(view.payments[0]!.validated, false);
  assert.equal(view.payments[0]!.kindLabel, 'Not validated');
  assert.equal(view.payments[0]!.receivers, undefined);
  assert.equal(view.networkLabel, 'Unknown (address validation is off)');
  assert.equal(valid(inspect(`zcash:${typo}`, { validateAddresses: false, network: 'test' })).networkLabel, 'Testnet');
  // The memo rule still applies to transparent addresses by prefix.
  assert.equal(invalid(inspect('zcash:tmNotChecked?memo=aGk', { validateAddresses: false })).error.code, 'MEMO_NOT_ALLOWED');
});

test('errors carry the code, message, description and marked parameter', () => {
  const view = invalid(inspect(`zcash:?address=${T_ADDR}&amount=1&address.1=${Z_ADDR}&amount.1=0.123456789`));
  assert.equal(view.error.code, 'INVALID_AMOUNT');
  assert.equal(view.error.param, 'amount.1');
  assert.equal(view.error.paramInferred, false);
  assert.match(view.error.message, /0\.123456789/);
  assert.match(view.error.description, /8 decimals/);
  assert.deepEqual(marked(view), ['amount.1=0.123456789']);
  assert.equal(view.tokens.map((t) => t.text).join(''), view.uri);
});

test('duplicate parameters mark every copy', () => {
  const view = invalid(inspect(`zcash:?amount=1.234&amount=2.345&address=${T_ADDR}`));
  assert.equal(view.error.code, 'DUPLICATE_PARAM');
  assert.deepEqual(marked(view), ['amount=1.234', 'amount=2.345']);
});

test('the path address is marked for errors on "address"', () => {
  const view = invalid(inspect(`zcash:${Z_ADDR}?amount=1`, { network: 'main' }));
  assert.equal(view.error.code, 'WRONG_NETWORK');
  assert.equal(view.error.param, 'address');
  assert.deepEqual(marked(view), [Z_ADDR]);
});

test('a bad address checksum is located even though the library gives no param', () => {
  const typo = Z_ADDR.slice(0, -1) + 'x';
  const view = invalid(inspect(`zcash:?address=${T_ADDR}&address.1=${typo}&amount.1=1`));
  assert.equal(view.error.code, 'INVALID_ADDRESS');
  assert.equal(view.error.param, 'address.1');
  assert.equal(view.error.paramInferred, true);
  assert.deepEqual(marked(view), [`address.1=${typo}`]);
});

test('grammar errors without a parameter mark nothing', () => {
  const view = invalid(inspect(`zcash://${T_ADDR}?amount=1`));
  assert.equal(view.error.code, 'INVALID_URI');
  assert.equal(view.error.param, undefined);
  assert.deepEqual(marked(view), []);
  assert.equal(invalid(inspect('bitcoin:abc')).error.code, 'INVALID_URI');
});
