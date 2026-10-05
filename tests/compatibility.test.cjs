const assert = require('node:assert/strict');
const { test } = require('node:test');
const { LexParser } = require('../dist/index.js');
const { LexParser: LegacyParser } = require('./legacy/lexParser.cjs');
const { cases, renderCase } = require('./fixtures/parser-cases.cjs');

for (const fixture of cases) {
  test(fixture.name, () => {
    const legacy = renderCase(LegacyParser, fixture);
    const actual = renderCase(LexParser, fixture);
    if (fixture.knownBug) {
      assert.deepStrictEqual(legacy.output, fixture.legacyExpected, fixture.knownBug);
      assert.deepStrictEqual(actual.output, fixture.expected, fixture.knownBug);
      assert.deepStrictEqual(actual.calls, legacy.calls);
    } else {
      assert.deepStrictEqual(actual, legacy);
    }
  });
}