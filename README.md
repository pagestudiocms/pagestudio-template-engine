# PageStudio Template Engine

A TypeScript/Node.js port of the legacy
[PyroCMS Lex parser](https://github.com/pyrocms/lex/tree/master), adapted for
PageStudio CMS templates. It parses synchronously and compiles to CommonJS for
Node.js 18 or later. The package exports `LexParser`, `LexParsingException`, and
public TypeScript types. The JavaScript entry point is `dist/index.js`, with
declarations at `dist/index.d.ts`.

## Rationale

PageStudio CMS template development requires compiling and rendering templates
in the browser as developers build them. The legacy PHP Lex implementation
cannot run directly in that environment, motivating a JavaScript/TypeScript port
of the template parser.

The goal is a shared parsing core for browser-based template development and the
Node.js development server, rather than separate implementations for each
environment. Filesystem access, plugin discovery, and other environment-specific
integrations remain outside the core parser.

The current package delivers a Node.js/CommonJS build. Browser packaging,
browser-compatible plugin integrations, and browser runtime tests are still
needed before browser support can be claimed. The TypeScript-to-JavaScript build
is distinct from the template compilation/rendering performed by the parser.

## Origin And Compatibility

PyroCMS Lex is the upstream PHP template parser and syntax reference. Its README
identifies the project as MIT-licensed and credits the PyroCMS Team. This package
continues the PageStudio JavaScript adaptation in TypeScript; it is not a
drop-in replacement for the original PHP API or a fully conformant port yet.

The migration baseline is the PageStudio development server's JavaScript parser,
not an execution of upstream PHP Lex. Passing the compatibility suite therefore
establishes parity with that JavaScript baseline for the covered cases only.

Upstream features not yet implemented include Lex comments, `noparse` blocks,
the `exists` conditional operator, configurable scope glue, and recursive callback
markers. Callback routing, signatures, and standalone/block rules are adapted for
PageStudio rather than reproducing all upstream behavior. PHP execution is not
supported. Upstream-derived conformance tests are a separate future requirement.

## Development

```sh
npm ci
npm test
npm run test:compatibility
npm run test:baseline
```

`npm run build` cleans generated output and compiles the package. Packing also
builds automatically; only
compiled modules, declarations, source maps, package metadata, and this README
are included, not the tests or frozen parser. The package remains private until
publishing and release configuration are agreed.

## Usage

```js
const { LexParser } = require('@pagestudiocms/template-engine');

const parser = new LexParser();
const output = parser.parse('Hello, {{ user.name }}!', {
  user: { name: 'Alice' }
});
```

Templates support dot-notation variables, array/object loops, `if`, `elseif`,
`else`, `unless`, `elseunless`, and `endif` or matching slash-style conditional
closing tags. Plugin tags use `plugin:name`, mapped to `plugin_name`. Parameters
retain the existing double-quoted `name="value"` syntax.

Four-argument callbacks retain the legacy signature:

```js
parser.registerFunction('content_snippet', (params, context, innerContent, data) => {
  return innerContent.toUpperCase();
});
```

Extended callbacks receive raw and rendered inner content plus helpers. Specify
`'extended'` for reliable TypeScript inference and functions with default/rest
parameters; existing JavaScript functions with six declared parameters continue
to be detected automatically.

```ts
parser.registerFunction('content_entries', (params, context, raw, parsed, data, helpers) => {
  const fragment = helpers.renderInner({ featured: true, title: 'Local' });
  return helpers.resolveVariables(fragment, { title: 'Local' });
}, 'extended');
```

`renderInner` evaluates loops and conditions while preserving variable markers.
`resolveVariables` then resolves markers in a supplied context, including
object content fields and arrays. The initial callback inner render remains
eager for compatibility; nested callbacks can consequently run again when an
extended callback uses `renderInner`.

Callbacks must return strings synchronously. Filesystem partial loading and
plugin discovery remain responsibilities of the consuming development server.
That server has not been switched to this package yet.

## Expressions And Errors

Conditions are parsed by `jsep`, not executed with `eval`. Supported expressions
include literals, own-property access, parentheses, comparisons, arithmetic,
`and`/`or`/`not`, and their JavaScript equivalents. Logical operators short-circuit;
quoted operator words are left untouched. Loose equality retains JavaScript
coercion for compatibility, not full PHP comparison semantics.

Function calls, assignments, and unsupported expression syntax are not evaluated.
Inherited properties and `constructor`, `prototype`, and `__proto__` are blocked.
Use plain trusted data objects: getters, custom conversion methods, and plugin
callbacks are application code, not a sandbox. Rendered HTML is not escaped.

By default, invalid expressions evaluate false and ordinary callback failures
are logged and fall back to their rendered inner content. For validation:

```js
const strictParser = new LexParser({ strict: true, recursionLimit: 100 });
```

Strict mode throws `LexParsingException` for recognized malformed blocks,
invalid expressions, and callback failures. Template errors carry an optional
zero-based source offset. Unsupported placeholders remain literal text. A
callback with no matching closing tag is treated as standalone; a variable with
no matching closing tag is interpolation, not an unclosed loop.

The configurable positive-integer limit bounds parsed template nesting,
expression evaluation depth, and reentrant parsing. Limit errors always
propagate, including in permissive mode; parsing state resets after failure.
`setRecursionLimit()` can change the limit. These limits are not a total output
size, template-length, execution-time, or plugin-resource budget.

## Modules

- `src/lexParser.ts`: public API, rendering, callback dispatch, parsing limits.
- `src/tokenizer.ts`: template tokens and exact source offsets.
- `src/ast.ts`: local block/branch ownership and AST construction.
- `src/expressions.ts`: safe interpretation of supported `jsep` expression nodes.
- `src/values.ts`: own-property resolution, string conversion, parameters.
- `src/types.ts`: token, AST, callback, context, and option contracts.
- `src/lexParsingException.ts`: structured parser errors.
- `src/index.ts`: package exports.

The source is strictly typechecked. Dependency declaration internals are skipped
because `jsep` uses CommonJS declaration syntax with ESM package metadata;
the generated consumer API is separately typechecked by `test:types`.

## Test Commands

The tests use the built-in Node test runner without a separate test framework.

- `npm run test:baseline`: verifies the frozen JavaScript parser against recorded
  behavior, including documented bugs.
- `npm test`: builds, checks consumer declarations, and runs permanent correctness
  tests against the compiled TypeScript package.
- `npm run test:types`: checks callback and public API types after a build.
- `npm run test:compatibility`: temporary comparisons of the compiled package
  against the frozen JavaScript parser, including callback arguments.

Correctness and compatibility commands build first, so a failed compilation
cannot accidentally test stale output.

## Coverage And Known Bugs

Shared fixtures cover interpolation, dot notation, false/zero values, array and
object loops, empty loops, conditionals, expressions, legacy and extended plugin
callbacks, inner rendering, and repeated parses. The seven assertion-based cases
in the development server's `tests/templateCompiler.unit.test.js` and the
`renderInner.spec.js` scenario informed this suite. The extended callback fixture
uses a local test callback instead of depending on the server's plugins.

Each fixture has an explicit intended result. Known bugs also record the original
result and a reason: missing/null variables and `elseif` branch selection. The
baseline tests preserve that evidence; correctness and compatibility tests require
the intended fixed result. These exceptions are output-specific, not skipped tests.

Additional permanent tests cover nested blocks, standalone callbacks, safe
expression behavior, malformed templates, callback errors, typed registration,
reentrant parsing, limits, and package exports. This is not a complete
CodeIgniter/PHP language conformance suite.

Beyond the three recorded baseline fixes, intentional behavior changes include
correct standalone callback scope, nested branch ownership, safe expression
handling, blocked prototype access, validated synchronous callback results,
and optional strict errors/limits. Four/six-argument callback dispatch and the
existing partial-render helper semantics remain compatible in the shared cases.

## Temporary Migration Files

`tests/legacy/lexParser.cjs` was copied from
`pagestudio-template-development-server/src/lib/lexParser.js`. Its only modification
is removal of the unused Sass import so it can run without server dependencies.
Do not fix bugs in this reference implementation.

After migration, remove the legacy parser, baseline and compatibility test files,
and their npm commands. Keep fixtures and correctness tests as regression coverage.
The development server should retain its own compiler/plugin integration tests.
