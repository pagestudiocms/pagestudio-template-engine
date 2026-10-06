import jsep from 'jsep';
import { LexParsingException } from './lexParsingException';
import { readProperty } from './values';

function normalize(expression: string): string {
  const operators: Record<string, string> = { and: '&&', or: '||', not: '!' };
  return expression.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:and|or|not)\b/g,
    (match: string, offset: number) => expression[offset - 1] === '.' ? match : operators[match] || match);
}

function binary(operator: string, left: unknown, right: unknown): unknown {
  switch (operator) {
    case '==': return left == right;
    case '!=': return left != right;
    case '===': return left === right;
    case '!==': return left !== right;
    case '>': return (left as number) > (right as number);
    case '<': return (left as number) < (right as number);
    case '>=': return (left as number) >= (right as number);
    case '<=': return (left as number) <= (right as number);
    case '+': return typeof left === 'string' || typeof right === 'string'
      ? String(left) + String(right) : Number(left) + Number(right);
    case '-': return Number(left) - Number(right);
    case '*': return Number(left) * Number(right);
    case '/': return Number(left) / Number(right);
    case '%': return Number(left) % Number(right);
    default: throw new LexParsingException(`Unsupported expression operator ${operator}`);
  }
}

function evaluate(node: jsep.Expression, context: unknown, depth: number, limit: number): unknown {
  if (depth > limit) throw new LexParsingException('Expression nesting limit exceeded');
  const child = (expression: jsep.Expression) => evaluate(expression, context, depth + 1, limit);
  switch (node.type) {
    case 'Literal': return (node as jsep.Literal).value;
    case 'Identifier': return readProperty(context, (node as jsep.Identifier).name);
    case 'MemberExpression': {
      const member = node as jsep.MemberExpression;
      const key = member.computed ? child(member.property) : (member.property as jsep.Identifier).name;
      return readProperty(child(member.object), String(key));
    }
    case 'UnaryExpression': {
      const unary = node as jsep.UnaryExpression;
      const value = child(unary.argument);
      switch (unary.operator) {
        case '!': return !value;
        case '+': return Number(value);
        case '-': return -Number(value);
        default: throw new LexParsingException(`Unsupported unary operator ${unary.operator}`);
      }
    }
    case 'BinaryExpression': {
      const expression = node as jsep.BinaryExpression;
      const left = child(expression.left);
      if (expression.operator === '&&') return left && child(expression.right);
      if (expression.operator === '||') return left || child(expression.right);
      return binary(expression.operator, left, child(expression.right));
    }
    default: throw new LexParsingException(`Unsupported expression syntax ${node.type}`);
  }
}

export function evaluateExpression(expression: string, context: unknown, strict: boolean, limit: number): boolean {
  try {
    return Boolean(evaluate(jsep(normalize(expression)), context, 0, limit));
  } catch (error) {
    if (error instanceof LexParsingException && error.message.includes('limit exceeded')) throw error;
    if (strict) {
      if (error instanceof LexParsingException) throw error;
      throw new LexParsingException(`Invalid expression: ${expression}`);
    }
    return false;
  }
}