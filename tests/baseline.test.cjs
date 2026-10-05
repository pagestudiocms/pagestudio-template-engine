const assert = require('node:assert/strict');
const { test } = require('node:test');
const { LexParser } = require('./legacy/lexParser.cjs');
const { cases, renderCase } = require('./fixtures/parser-cases.cjs');

for (const fixture of cases) {
  test(fixture.name, () => {
    const expected = fixture.knownBug ? fixture.legacyExpected : fixture.expected;
    assert.deepStrictEqual(renderCase(LexParser, fixture), {
      output: expected,
      calls: fixture.expectedCalls || []
    });
  });
}