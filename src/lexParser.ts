import { buildAST } from './ast';
import { evaluateExpression } from './expressions';
import { LexParsingException } from './lexParsingException';
import { tokenize } from './tokenizer';
import { mapPluginName, parseParameters, resolveVariable, resolveVariablesInString, stringifyValue } from './values';
import type {
  AST, Callback, CallbackHelpers, CallbackNode, CallbackSignature, Context,
  ExtendedCallback, LegacyCallback, Node, ParserOptions, Token
} from './types';

export class LexParser {
  public readonly callbacks: Record<string, Callback> = Object.create(null) as Record<string, Callback>;
  private readonly signatures = new Map<string, CallbackSignature>();
  private readonly strict: boolean;
  private recursionLimit: number;
  private parsingDepth = 0;

  constructor(options: ParserOptions = {}) {
    this.strict = options.strict ?? false;
    this.recursionLimit = 100;
    this.setRecursionLimit(options.recursionLimit ?? 100);
  }

  registerFunction(name: string, handler: LegacyCallback, signature?: 'legacy'): void;
  registerFunction(name: string, handler: ExtendedCallback, signature?: 'extended'): void;
  registerFunction(name: string, handler: Callback, signature?: CallbackSignature): void {
    this.callbacks[name] = handler;
    if (signature) this.signatures.set(name, signature);
    else this.signatures.delete(name);
  }

  setRecursionLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RangeError('Recursion limit must be a positive integer');
    }
    this.recursionLimit = limit;
  }

  parse(template: string, context: Context = {}, data: Context = {}): string {
    return this.withParsingLimit(() => {
      const ast = this.buildAST(this.tokenize(template), template);
      return this.resolveVariablesInString(this.render(ast, context, data), context);
    });
  }

  tokenize(template: string): Token[] {
    return tokenize(template);
  }

  buildAST(tokens: Token[], template = ''): AST {
    return buildAST(tokens, template, this.strict, this.recursionLimit);
  }

  resolveVariable(name: string, context: unknown): unknown {
    return resolveVariable(name, context);
  }

  resolveVariablesInString(template: string, context: Context): string {
    return resolveVariablesInString(template, context);
  }

  evaluateExpression(expression: string, context: Context): boolean {
    return evaluateExpression(expression, context, this.strict, this.recursionLimit);
  }

  mapPluginName(tag: string): string {
    return mapPluginName(tag);
  }

  parseParameters(source: string): Record<string, string> {
    return parseParameters(source);
  }

  render(ast: AST, context: Context = {}, data: Context = {}): string {
    return this.renderChildren(ast.children, context, data, false);
  }

  renderPartial(ast: AST, context: Context = {}, data: Context = {}): string {
    return this.renderChildren(ast.children, context, data, true);
  }

  renderNode(node: Node, context: Context, data: Context = {}): string {
    return this.renderValue(node, context, data, false);
  }

  renderNodePartial(node: Node, context: Context, data: Context = {}): string {
    return this.renderValue(node, context, data, true);
  }

  private withParsingLimit(operation: () => string): string {
    if (this.parsingDepth >= this.recursionLimit) throw new LexParsingException('Parser recursion limit exceeded');
    this.parsingDepth++;
    try {
      return operation();
    } finally {
      this.parsingDepth--;
    }
  }

  private renderChildren(children: Node[], context: unknown, data: Context, partial: boolean): string {
    return children.map(node => this.renderValue(node, context, data, partial)).join('');
  }

  private renderValue(node: Node, context: unknown, data: Context, partial: boolean): string {
    switch (node.type) {
      case 'text': return node.value;
      case 'variable': return partial ? `{{ ${node.tag} }}` : stringifyValue(resolveVariable(node.tag, context));
      case 'loop': {
        const collection = resolveVariable(node.variable, context);
        if (collection === null || typeof collection !== 'object') return '';
        return Object.values(collection).map(item => this.renderChildren(node.children, item, data, partial)).join('');
      }
      case 'conditional': {
        for (const branch of node.conditions) {
          let matches = evaluateExpression(branch.expression, context, this.strict, this.recursionLimit);
          if (branch.type === 'unless' || branch.type === 'elseunless') matches = !matches;
          if (matches) return this.renderChildren(branch.children, context, data, partial);
        }
        return node.elseBranch ? this.renderChildren(node.elseBranch.children, context, data, partial) : '';
      }
      case 'callback': return this.renderCallback(node, context, data, partial);
    }
  }

  private renderCallback(node: CallbackNode, context: unknown, data: Context, partial: boolean): string {
    const inner = this.renderChildren(node.children, context, data, partial);
    const callback = this.callbacks[node.name];
    if (typeof callback !== 'function') return inner;
    const helpers: CallbackHelpers = {
      renderInner: localScope => node.raw ? this.withParsingLimit(() => {
        const ast = this.buildAST(this.tokenize(node.raw), node.raw);
        return this.renderPartial(ast, localScope, data);
      }) : inner,
      evaluateCondition: (expression, localScope) => this.evaluateExpression(expression, localScope),
      resolveVariables: (template, localScope) => this.resolveVariablesInString(template, localScope)
    };
    try {
      const signature = this.signatures.get(node.name);
      const extended = signature === 'extended' || (!signature && callback.length >= 6);
      const scope = context as Context;
      const result = extended
        ? (callback as ExtendedCallback)(node.params, scope, node.raw, inner, data, helpers)
        : (callback as LegacyCallback)(node.params, scope, inner, data);
      if (typeof result !== 'string') throw new TypeError('Synchronous callbacks must return a string');
      return result;
    } catch (error) {
      if (error instanceof LexParsingException) throw error;
      if (this.strict) throw new LexParsingException(`Callback ${node.name} failed: ${String(error)}`);
      console.error('Callback error for', node.name, error);
      return inner;
    }
  }
}