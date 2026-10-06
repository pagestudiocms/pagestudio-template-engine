import { LexParsingException } from './lexParsingException';
import { mapPluginName, parseParameters } from './values';
import type { AST, ConditionalBranch, ConditionalNode, Node, TagToken, Token } from './types';

export function buildAST(tokens: Token[], template: string, strict: boolean, limit: number): AST {
  let cursor = 0;

  function malformed(message: string, token: TagToken): void {
    if (strict) throw new LexParsingException(message, token.start);
  }

  function hasClosing(opening: TagToken): boolean {
    return tokens.slice(cursor).some(token => token.type !== 'text' &&
      token.type === opening.type && token.closing && token.tag === opening.tag);
  }

  function isConditionalEnd(token: Token): boolean {
    return token.type === 'conditional' && (token.closing ||
      ['elseif', 'elseunless', 'else', 'endif'].includes(token.tag));
  }

  function nodes(depth: number, stop?: (token: Token) => boolean): Node[] {
    if (depth > limit) throw new LexParsingException('Template nesting limit exceeded', tokens[cursor]?.start);
    const children: Node[] = [];
    while (cursor < tokens.length) {
      const token = tokens[cursor];
      if (stop?.(token)) break;
      cursor++;
      const node = parseNode(token, depth);
      if (node) children.push(node);
    }
    return children;
  }

  function parseNode(token: Token, depth: number): Node | undefined {
    if (token.type === 'text') return { type: 'text', value: token.value };
    if (token.closing || isConditionalEnd(token)) {
      malformed(`Unexpected closing or branch tag ${token.tag}`, token);
      return undefined;
    }
    if (token.type === 'conditional') return conditional(token, depth);
    if (token.type === 'variable' && !hasClosing(token)) return { type: 'variable', tag: token.tag };
    return block(token, depth);
  }

  function block(token: TagToken, depth: number): Node {
    const paired = hasClosing(token);
    const content = paired ? nodes(depth + 1, candidate => candidate.type !== 'text' &&
      candidate.type === token.type && candidate.closing && candidate.tag === token.tag) : [];
    const closing = paired ? tokens[cursor] : undefined;
    if (paired && !closing) malformed(`Unclosed tag ${token.tag}`, token);
    if (closing) cursor++;
    if (token.type === 'variable') return { type: 'loop', variable: token.tag, children: content };
    return {
      type: 'callback', name: mapPluginName(token.tag), params: parseParameters(token.params),
      children: content, raw: closing ? template.slice(token.end, closing.start) : ''
    };
  }

  function closeConditional(token: TagToken, opening: TagToken): void {
    if (token.closing && token.tag !== opening.tag && token.tag !== 'endif') {
      malformed(`Mismatched conditional closing tag ${token.tag}`, token);
    }
  }

  function conditional(opening: TagToken, depth: number): ConditionalNode {
    const result: ConditionalNode = { type: 'conditional', conditions: [], elseBranch: null };
    let branch = opening;
    while (true) {
      result.conditions.push({
        type: branch.tag as ConditionalBranch['type'], expression: branch.params,
        children: nodes(depth + 1, isConditionalEnd)
      });
      const next = tokens[cursor];
      if (next?.type !== 'conditional') {
        malformed('Unclosed conditional', opening);
        return result;
      }
      cursor++;
      if (next.closing || next.tag === 'endif') {
        closeConditional(next, opening);
        return result;
      }
      if (next.tag === 'else') {
        result.elseBranch = { type: 'else', children: nodes(depth + 1, isConditionalEnd) };
        const end = tokens[cursor];
        if (end?.type === 'conditional' && (end.closing || end.tag === 'endif')) {
          closeConditional(end, opening);
          cursor++;
        } else malformed('Expected conditional closing tag after else', opening);
        return result;
      }
      branch = next;
    }
  }

  return { type: 'root', children: nodes(0) };
}