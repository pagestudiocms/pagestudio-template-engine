const assert = require('node:assert/strict');
const { test } = require('node:test');
const { LexParser, LexParsingException } = require('../dist/index.js');
const { cases, renderCase } = require('./fixtures/parser-cases.cjs');

for (const fixture of cases) {
  test(fixture.name, () => {
    assert.deepStrictEqual(renderCase(LexParser, fixture), {
      output: fixture.expected,
      calls: fixture.expectedCalls || []
    });
  });
}

const additionalCases = [
  {
    name: 'nested conditionals retain the outer else branch',
    template: '{{ if outer }}{{ if inner }}A{{ else }}B{{ endif }}{{ else }}C{{ endif }}',
    context: { outer: false, inner: true },
    expected: 'C'
  },
  {
    name: 'nested conditionals select the inner else branch',
    template: '{{ if outer }}{{ if inner }}A{{ else }}B{{ endif }}{{ else }}C{{ endif }}',
    context: { outer: true, inner: false },
    expected: 'B'
  },
  {
    name: 'same-name nested loops',
    template: '{{ items }}{{ name }}[{{ items }}{{ name }}{{ /items }}]{{ /items }}',
    context: { items: [{ name: 'A', items: [{ name: 'B' }, { name: 'C' }] }] },
    expected: 'A[BC]'
  },
  {
    name: 'loop conditionals use the current item',
    template: '{{ items }}{{ if active }}{{ name }}{{ else }}-{{ endif }}{{ /items }}',
    context: { items: [{ name: 'A', active: true }, { name: 'B', active: false }] },
    expected: 'A-'
  },
  {
    name: 'elseunless negates its condition',
    template: '{{ if first }}A{{ elseunless second }}B{{ else }}C{{ endif }}',
    context: { first: false, second: false },
    expected: 'B'
  },
  {
    name: 'standalone callback does not capture following content',
    template: '{{ content:snippet }}After{{ title }}',
    context: { title: 'Page' },
    setup(parser) {
      parser.registerFunction('content_snippet', () => 'Snippet');
    },
    expected: 'SnippetAfterPage'
  },
  {
    name: 'same-name nested callback blocks',
    template: '{{ content:wrap }}A{{ content:wrap }}B{{ /content:wrap }}C{{ /content:wrap }}',
    setup(parser) {
      parser.registerFunction('content_wrap', (_params, _scope, inner) => `[${inner}]`);
    },
    expected: '[A[B]C]'
  },
  {
    name: 'reentrant plugin parsing preserves surrounding conditional state',
    template: '{{ if active }}{{ content:snippet }}{{ /content:snippet }}{{ else }}No{{ endif }}',
    context: { active: true },
    setup(parser) {
      parser.registerFunction('content_snippet', () => parser.parse('{{ if enabled }}Yes{{ else }}No{{ endif }}', { enabled: true }));
    },
    expected: 'Yes'
  }
];

for (const fixture of additionalCases) {
  test(fixture.name, () => {
    assert.equal(renderCase(LexParser, fixture).output, fixture.expected);
  });
}

const expressions = [
  ['true and not false', {}, true],
  ['false or true', {}, true],
  ['count >= 2 and count < 4', { count: 3 }, true],
  ['count > 3 or count <= 0', { count: 3 }, false],
  ['count == "3"', { count: 3 }, true],
  ['count === "3"', { count: 3 }, false],
  ['count != 4 and count !== "3"', { count: 3 }, true],
  ['(count + 1) * 2 == 8', { count: 3 }, true],
  ['title == "and or not"', { title: 'and or not' }, true],
  ['title == "He said \\"yes\\""', { title: 'He said "yes"' }, true],
  ['user.or == "yes"', { user: { or: 'yes' } }, true],
  ['items[0].active', { items: [{ active: true }] }, true],
  ['missing.nested', {}, false],
  ['true or unsupported()', {}, true],
  ['false and unsupported()', {}, false]
];

for (const [expression, context, expected] of expressions) {
  test(`safe expression: ${expression}`, () => {
    assert.equal(new LexParser().evaluateExpression(expression, context), expected);
  });
}

test('expressions cannot invoke context functions', () => {
  let invoked = false;
  const parser = new LexParser();
  assert.equal(parser.evaluateExpression('execute()', { execute() { invoked = true; } }), false);
  assert.equal(invoked, false);
});

test('prototype and inherited properties are unavailable', () => {
  const parser = new LexParser();
  const context = Object.create({ inherited: 'hidden' });
  context.user = { name: 'Alice' };
  assert.equal(parser.parse('{{ inherited }}{{ user.constructor }}{{ user.__proto__ }}', context), '');
  assert.equal(parser.evaluateExpression('user.constructor', context), false);
});

test('strict mode reports malformed templates with source offsets', () => {
  const parser = new LexParser({ strict: true });
  for (const template of ['{{ /items }}', '{{ else }}', '{{ if active }}Yes']) {
    assert.throws(() => parser.parse(template, { active: true }), error => {
      assert.ok(error instanceof LexParsingException);
      assert.equal(error.position, 0);
      return true;
    });
  }
});

test('strict mode rejects invalid and executable expressions', () => {
  const parser = new LexParser({ strict: true });
  assert.throws(() => parser.evaluateExpression('value ==', {}), LexParsingException);
  assert.throws(() => parser.evaluateExpression('execute()', {}), LexParsingException);
});

test('strict mode rejects mismatched conditional closing tags', () => {
  assert.throws(() => new LexParser({ strict: true }).parse('{{ if active }}Yes{{ /unless }}', { active: true }),
    /Mismatched conditional closing tag/);
});

test('tokenizer preserves invalid placeholders and exact source offsets', () => {
  const parser = new LexParser();
  const template = 'Before{{ @invalid }}{{ title }}After';
  const tokens = parser.tokenize(template);
  assert.equal(parser.parse(template, { title: 'Page' }), 'Before{{ @invalid }}PageAfter');
  assert.equal(template.slice(tokens[1].start, tokens[1].end), '{{ title }}');
});

test('package entry point exports the compiled parser', () => {
  assert.equal(require('..').LexParser, LexParser);
  assert.equal(require('..').LexParsingException, LexParsingException);
});

test('parameter parsing preserves empty and quoted values with equals signs', () => {
  const parser = new LexParser();
  assert.deepEqual(parser.parseParameters('name = "a=b" empty="" ignored=plain next="value"'),
    { name: 'a=b', empty: '', next: 'value' });
});

test('parameter names cannot mutate the prototype', () => {
  const params = new LexParser().parseParameters('__proto__="safe"');
  assert.equal(Object.getPrototypeOf(params), Object.prototype);
  assert.equal(params.__proto__, 'safe');
});

test('callback errors retain legacy fallback in permissive mode', () => {
  const parser = new LexParser();
  parser.registerFunction('content_failure', () => { throw new Error('plugin failure'); });
  const original = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    assert.equal(parser.parse('{{ content:failure }}Fallback{{ /content:failure }}'), 'Fallback');
    assert.equal(logs.length, 1);
  } finally {
    console.error = original;
  }
});

test('strict mode surfaces callback errors', () => {
  const parser = new LexParser({ strict: true });
  parser.registerFunction('content_failure', () => { throw new Error('plugin failure'); });
  assert.throws(() => parser.parse('{{ content:failure }}'), /Callback content_failure failed/);
});

test('explicit extended signature supports default parameters', () => {
  const parser = new LexParser();
  parser.registerFunction('content_default', (_params, context, raw, parsed, data = {}, helpers = {}) => {
    assert.equal(raw, '{{ title }}');
    assert.equal(parsed, 'Page');
    return helpers.resolveVariables(helpers.renderInner(context), { title: 'Local' });
  }, 'extended');
  assert.equal(parser.parse('{{ content:default }}{{ title }}{{ /content:default }}', { title: 'Page' }), 'Local');
});

test('renderPartial preserves variables while selecting branches', () => {
  const parser = new LexParser();
  const template = '{{ if active }}{{ title }}{{ else }}No{{ endif }}';
  const ast = parser.buildAST(parser.tokenize(template), template);
  assert.equal(parser.renderPartial(ast, { active: true }), '{{ title }}');
});

test('final variable resolution supports plugin-produced content values', () => {
  const parser = new LexParser();
  parser.registerFunction('content_marker', () => '{{ body }}:{{ items }}');
  assert.equal(parser.parse('{{ content:marker }}', { body: { html: '<b>Hello</b>' }, items: [1, null, 2] }), '<b>Hello</b>:12');
});

test('template nesting limit is enforced and parser recovers', () => {
  const parser = new LexParser({ recursionLimit: 2 });
  const template = '{{ if active }}'.repeat(3) + 'Yes' + '{{ endif }}'.repeat(3);
  assert.throws(() => parser.parse(template, { active: true }), /nesting limit exceeded/);
  assert.equal(parser.parse('After'), 'After');
});

test('expression nesting limit is enforced', () => {
  const parser = new LexParser({ recursionLimit: 2 });
  assert.throws(() => parser.evaluateExpression('!!!!active', { active: true }), /nesting limit exceeded/);
});

test('reentrant parsing limit is enforced and parser recovers', () => {
  const parser = new LexParser({ recursionLimit: 2 });
  parser.registerFunction('content_recurse', () => parser.parse('{{ content:recurse }}'));
  assert.throws(() => parser.parse('{{ content:recurse }}'), /recursion limit exceeded/);
  assert.equal(parser.parse('After'), 'After');
});

test('invalid recursion limits are rejected', () => {
  for (const recursionLimit of [0, -1, 1.5, Infinity, NaN]) {
    assert.throws(() => new LexParser({ recursionLimit }), RangeError);
  }
});