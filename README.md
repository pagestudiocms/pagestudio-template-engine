# Lex Parser: Tests-First TypeScript Migration

The current PageStudio JavaScript parser is the migration baseline. The previous
TypeScript engine has been removed; the new TypeScript implementation has not
been written yet. The planned public entry point is `dist/index.js`, exporting
`LexParser` for CommonJS consumers, with declarations at `dist/index.d.ts`.

## Test Commands

Requires Node.js 18 or later. The tests use the built-in Node test runner and
have no third-party dependencies.

- `npm run test:baseline`: verifies the frozen JavaScript parser against recorded
  behavior. This should pass before implementation begins.
- `npm test`: permanent correctness tests against the compiled TypeScript package.
- `npm run test:compatibility`: temporary comparisons of the compiled package
  against the frozen JavaScript parser, including callback arguments.

The latter two commands intentionally fail until `dist/index.js` exists. Build
configuration and TypeScript dependencies will be added with the implementation;
these commands should then build before testing to avoid stale output.

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

This is an initial migration gate, not complete language conformance coverage.
Nested blocks, malformed templates, callback errors, reentrant parsing, and the
remaining conditional operators need additional agreed expectations.

## Temporary Migration Files

`tests/legacy/lexParser.cjs` was copied from
`pagestudio-template-development-server/src/lib/lexParser.js`. Its only modification
is removal of the unused Sass import so it can run without server dependencies.
Do not fix bugs in this reference implementation.

After migration, remove the legacy parser, baseline and compatibility test files,
and their npm commands. Keep fixtures and correctness tests as regression coverage.
The development server should retain its own compiler/plugin integration tests.

The package is private until the TypeScript implementation and release setup are
ready. No parser behavior or publishing configuration has been implemented yet.