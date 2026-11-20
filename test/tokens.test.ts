import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markParam, splitKey, tokenize } from '../src/tokens.ts';

test('tokenize splits scheme, path address and parameters losslessly', () => {
  const uri = 'zcash:tmAbc?amount=1&&flag&memo.1=aGk';
  const tokens = tokenize(uri);
  assert.equal(tokens.map((t) => t.text).join(''), uri);
  assert.deepEqual(
    tokens.filter((t) => t.key).map((t) => [t.key, t.value]),
    [
      ['address', 'tmAbc'],
      ['amount', '1'],
      ['flag', null],
      ['memo.1', 'aGk'],
    ],
  );
});

test('tokenize keeps a non-zcash string whole', () => {
  assert.deepEqual(tokenize('bitcoin:abc'), [{ text: 'bitcoin:abc' }]);
  assert.deepEqual(tokenize(''), []);
});

test('markParam matches names case-insensitively', () => {
  const tokens = markParam(tokenize('ZCASH:?AMOUNT=1&address=x'), 'amount');
  assert.deepEqual(tokens.filter((t) => t.mark).map((t) => t.text), ['AMOUNT=1']);
  assert.equal(markParam(tokens, undefined).filter((t) => t.mark).length, 1, 'existing marks are kept');
});

test('splitKey separates the payment index', () => {
  assert.deepEqual(splitKey('amount.12'), ['amount', 12]);
  assert.deepEqual(splitKey('amount'), ['amount', 0]);
  assert.deepEqual(splitKey('address.0'), ['address.0', 0]);
});
