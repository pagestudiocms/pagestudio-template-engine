const assert = require('node:assert/strict');
const { test } = require('node:test');
const { LexParser } = require('../dist/index.js');
const { cases, renderCase } = require('./fixtures/parser-cases.cjs');

for (const fixture of cases) {
  test(fixture.name, () => {
    assert.deepStrictEqual(renderCase(LexParser, fixture), {
      output: fixture.expected,
      calls: fixture.expectedCalls || []
    });
  });
}