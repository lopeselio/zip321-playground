import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../src/examples.ts';
import { inspect } from '../src/inspect.ts';

test('example ids are unique and there are valid and invalid ones', () => {
  assert.equal(new Set(EXAMPLES.map((e) => e.id)).size, EXAMPLES.length);
  assert.ok(EXAMPLES.filter((e) => e.valid).length >= 5);
  assert.ok(EXAMPLES.filter((e) => !e.valid).length >= 5);
});

for (const example of EXAMPLES) {
  test(`example "${example.title}" is ${example.valid ? 'valid' : `rejected with ${example.expect?.code}`}`, () => {
    const options: { network?: typeof example.network; validateAddresses?: boolean } = {};
    if (example.network) options.network = example.network;
    if (example.validateAddresses === false) options.validateAddresses = false;
    const result = inspect(example.uri, options);
    if (example.valid) {
      assert.equal(result.status, 'valid', result.status === 'invalid' ? result.error.message : '');
      return;
    }
    assert.equal(result.status, 'invalid');
    if (result.status !== 'invalid') return;
    assert.equal(result.error.code, example.expect!.code, result.error.message);
    assert.equal(result.error.param, example.expect!.param);
    if (example.expect!.param) assert.ok(result.tokens.some((t) => t.mark), 'the parameter is marked in the URI');
  });
}
