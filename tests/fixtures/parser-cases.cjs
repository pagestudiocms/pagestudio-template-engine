const cases = [
  {
    name: 'plain text is unchanged',
    template: '<p>Hello</p>',
    expected: '<p>Hello</p>'
  },
  {
    name: 'empty template',
    template: '',
    expected: ''
  },
  {
    name: 'variable interpolation',
    template: 'Hello, {{ name }}!',
    context: { name: 'Alice' },
    expected: 'Hello, Alice!'
  },
  {
    name: 'dot-notation interpolation',
    template: 'Hello, {{ user.name }}!',
    context: { user: { name: 'Alice' } },
    expected: 'Hello, Alice!'
  },
  {
    name: 'false and zero are preserved',
    template: '{{ enabled }}:{{ count }}',
    context: { enabled: false, count: 0 },
    expected: 'false:0'
  },
  {
    name: 'missing variable is empty',
    template: 'Before{{ missing }}After',
    expected: 'BeforeAfter',
    legacyExpected: 'BeforeundefinedAfter',
    knownBug: 'Missing values are concatenated as undefined before final resolution.'
  },
  {
    name: 'null variable is empty',
    template: 'Before{{ value }}After',
    context: { value: null },
    expected: 'BeforeAfter',
    legacyExpected: 'BeforenullAfter',
    knownBug: 'Null values are concatenated as null before final resolution.'
  },
  {
    name: 'array loop',
    template: '{{ items }}<li>{{ name }}</li>{{ /items }}',
    context: { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
    expected: '<li>a</li><li>b</li><li>c</li>'
  },
  {
    name: 'object loop with nested fields',
    template: '{{ people }}<p>{{ real_name.first }} {{ real_name.last }}</p>{{ /people }}',
    context: { people: { first: { real_name: { first: 'John', last: 'Doe' } } } },
    expected: '<p>John Doe</p>'
  },
  {
    name: 'empty array loop',
    template: 'Before{{ items }}{{ name }}{{ /items }}After',
    context: { items: [] },
    expected: 'BeforeAfter'
  },
  {
    name: 'if selects true branch',
    template: '{{ if user.exists }}Yes{{ else }}No{{ endif }}',
    context: { user: { exists: true } },
    expected: 'Yes'
  },
  {
    name: 'if selects else branch',
    template: '{{ if user.exists }}Yes{{ else }}No{{ endif }}',
    context: { user: { exists: false } },
    expected: 'No'
  },
  {
    name: 'unless selects negated branch',
    template: '{{ unless user.admin }}Not Admin{{ else }}Is Admin{{ endif }}',
    context: { user: { admin: false } },
    expected: 'Not Admin'
  },
  {
    name: 'unless selects else branch',
    template: '{{ unless user.admin }}Not Admin{{ else }}Is Admin{{ endif }}',
    context: { user: { admin: true } },
    expected: 'Is Admin'
  },
  {
    name: 'quoted string comparison',
    template: "{{ if page.slug == 'templates' }}Matches{{ else }}No{{ endif }}",
    context: { page: { slug: 'templates' } },
    expected: 'Matches'
  },
  {
    name: 'logical operators',
    template: '{{ if active and not hidden }}Yes{{ else }}No{{ endif }}',
    context: { active: true, hidden: false },
    expected: 'Yes'
  },
  {
    name: 'elseif selects matching branch',
    template: '{{ if first }}A{{ elseif second }}B{{ else }}C{{ endif }}',
    context: { first: false, second: true },
    expected: 'B',
    legacyExpected: 'CB',
    knownBug: 'The AST stack cannot find the owning conditional when switching to elseif.'
  },
  {
    name: 'slash-style conditional closing tag',
    template: '{{ if featured }}Yes{{ else }}No{{ /if }}',
    context: { featured: true },
    expected: 'Yes'
  },
  {
    name: 'legacy callback receives parameters, context, content, and data',
    template: '{{ content:snippet name="title" format="uppercase" }}{{ title }}{{ /content:snippet }}',
    context: { title: 'Default' },
    data: { title: 'hello' },
    setup(parser, calls) {
      parser.registerFunction('content_snippet', (params, context, innerContent, data) => {
        calls.push({ params, context, innerContent, data });
        return data[params.name].toUpperCase();
      });
    },
    expected: 'HELLO',
    expectedCalls: [{
      params: { name: 'title', format: 'uppercase' },
      context: { title: 'Default' },
      innerContent: 'Default',
      data: { title: 'hello' }
    }]
  },
  {
    name: 'unregistered callback preserves rendered inner content',
    template: '{{ content:unknown }}Hello, {{ name }}!{{ /content:unknown }}',
    context: { name: 'Alice' },
    expected: 'Hello, Alice!'
  },
  {
    name: 'extended callback renders conditional content per item',
    template: '{{ content:entries }}{{ if featured }}<b>{{ title }}</b>{{ else }}<i>{{ title }}</i>{{ /if }}{{ /content:entries }}',
    context: {
      title: 'Page',
      featured: false,
      entries: [{ featured: true, title: 'First' }, { featured: false, title: 'Second' }]
    },
    setup(parser, calls) {
      parser.registerFunction('content_entries', (params, context, innerRaw, innerParsed, data, helpers) => {
        calls.push({
          params,
          innerRaw,
          innerParsed,
          data,
          helpers: Object.keys(helpers).sort((first, second) => first.localeCompare(second)),
          condition: helpers.evaluateCondition('featured', context.entries[0])
        });
        return context.entries.map(entry => {
          const fragment = helpers.renderInner(entry);
          return helpers.resolveVariables(fragment, entry);
        }).join('');
      });
    },
    expected: '<b>First</b><i>Second</i>',
    expectedCalls: [{
      params: {},
      innerRaw: '{{ if featured }}<b>{{ title }}</b>{{ else }}<i>{{ title }}</i>{{ /if }}',
      innerParsed: '<i>Page</i>',
      data: {},
      helpers: ['evaluateCondition', 'renderInner', 'resolveVariables'],
      condition: true
    }]
  },
  {
    name: 'repeated parses do not retain context',
    run(parser) {
      return [
        parser.parse('{{ if enabled }}{{ title }}{{ else }}No{{ endif }}', { enabled: true, title: 'First' }),
        parser.parse('{{ if enabled }}{{ title }}{{ else }}No{{ endif }}', { enabled: false, title: 'Second' })
      ];
    },
    expected: ['First', 'No']
  }
];

function renderCase(LexParser, fixture) {
  const parser = new LexParser();
  const calls = [];
  if (fixture.setup) fixture.setup(parser, calls);
  const output = fixture.run
    ? fixture.run(parser)
    : parser.parse(fixture.template, fixture.context || {}, fixture.data || {});
  return { output, calls };
}

module.exports = { cases, renderCase };