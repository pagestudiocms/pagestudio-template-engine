import { LexParser, LexParsingException } from '../dist';
import type { AST, CallbackHelpers, Context, ExtendedCallback, LegacyCallback, Token } from '../dist';

const parser = new LexParser({ strict: true, recursionLimit: 20 });
const context: Context = { title: 'Hello' };
const output: string = parser.parse('{{ title }}', context);
const tokens: Token[] = parser.tokenize('{{ title }}');
const ast: AST = parser.buildAST(tokens, '{{ title }}');
const rendered: string = parser.render(ast, context);
const matches: boolean = parser.evaluateExpression('title == "Hello"', context);
const error: Error = new LexParsingException('Invalid template', 0);

parser.registerFunction('content_legacy', (params, scope, innerContent, data) => {
  const name: string = params.name;
  const localScope: Context = scope;
  const payload: Context = data;
  return name + innerContent + String(localScope.title) + String(payload.title);
});

parser.registerFunction('content_extended', (params, scope, raw, parsed, data, helpers) => {
  const typedHelpers: CallbackHelpers = helpers;
  const localScope: Context = scope;
  return params.name + raw + parsed + String(data.title) + typedHelpers.renderInner(localScope);
}, 'extended');

const legacy: LegacyCallback = (_params, _scope, inner) => inner;
const extended: ExtendedCallback = (_params, scope, _raw, parsed, _data, helpers) => {
  return helpers.renderInner(scope) || parsed;
};
parser.registerFunction('content_explicit_legacy', legacy, 'legacy');
parser.registerFunction('content_explicit_extended', extended, 'extended');

void [output, rendered, matches, error];