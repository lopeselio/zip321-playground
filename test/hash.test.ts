import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHash, encodeHash } from '../src/hash.ts';
import { EXAMPLES } from '../src/examples.ts';

test('every example URI survives a hash round-trip', () => {
  for (const { uri } of EXAMPLES) {
    const hash = encodeHash({ uri });
    assert.match(hash, /^#uri=zcash%3A/i);
    assert.doesNotMatch(hash.slice(5), /[&#?= ]/, 'URI characters that would break the hash are escaped');
    assert.deepEqual(decodeHash(hash), { uri });
  }
});

test('non-default options are recorded and restored', () => {
  const state = { uri: 'zcash:abc?message=a%20b&x=1', network: 'main' as const, validateAddresses: false };
  const hash = encodeHash(state);
  assert.equal(hash, '#uri=zcash%3Aabc%3Fmessage%3Da%2520b%26x%3D1&network=main&validate=0');
  assert.deepEqual(decodeHash(hash), state);
});

test('Unicode, plus signs and percent signs round-trip', () => {
  const uri = 'zcash:x?message=50%25+off ✨';
  assert.equal(decodeHash(encodeHash({ uri })).uri, uri);
});

test('an empty URI gives an empty hash', () => {
  assert.equal(encodeHash({ uri: '' }), '');
  assert.deepEqual(decodeHash(''), {});
});

test('malformed and unknown fields are ignored', () => {
  assert.deepEqual(decodeHash('#uri=%E0%A4%A&network=mars&foo=bar&validate=1'), { validateAddresses: true });
  assert.deepEqual(decodeHash('uri=zcash%3Aabc'), { uri: 'zcash:abc' });
});
