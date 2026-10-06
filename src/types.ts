export type Context = Record<string, unknown>;
export type Parameters = Record<string, string>;

export interface ParserOptions {
  strict?: boolean;
  recursionLimit?: number;
}

export interface CallbackHelpers {
  renderInner(context: Context): string;
  evaluateCondition(expression: string, context: Context): boolean;
  resolveVariables(template: string, context: Context): string;
}

export type LegacyCallback = (
  params: Parameters, context: Context, innerContent: string, data: Context
) => string;

export type ExtendedCallback = (
  params: Parameters, context: Context, innerRaw: string,
  innerParsed: string, data: Context, helpers: CallbackHelpers
) => string;

export type Callback = LegacyCallback | ExtendedCallback;
export type CallbackSignature = 'legacy' | 'extended';

export interface TextToken {
  type: 'text';
  value: string;
  start: number;
  end: number;
}

export interface TagToken {
  type: 'variable' | 'callback' | 'conditional';
  tag: string;
  params: string;
  closing: boolean;
  start: number;
  end: number;
}

export type Token = TextToken | TagToken;

export interface TextNode {
  type: 'text';
  value: string;
}

export interface VariableNode {
  type: 'variable';
  tag: string;
}

export interface LoopNode {
  type: 'loop';
  variable: string;
  children: Node[];
}

export interface CallbackNode {
  type: 'callback';
  name: string;
  params: Parameters;
  children: Node[];
  raw: string;
}

export interface ConditionalBranch {
  type: 'if' | 'unless' | 'elseif' | 'elseunless';
  expression: string;
  children: Node[];
}

export interface ConditionalNode {
  type: 'conditional';
  conditions: ConditionalBranch[];
  elseBranch: { type: 'else'; children: Node[] } | null;
}

export type Node = TextNode | VariableNode | LoopNode | CallbackNode | ConditionalNode;

export interface AST {
  type: 'root';
  children: Node[];
}