import type { TagToken, Token } from './types';

const conditionalTags = new Set(['if', 'elseif', 'else', 'unless', 'elseunless', 'endif']);

function classifyTag(tag: string): TagToken['type'] {
  if (conditionalTags.has(tag)) return 'conditional';
  if (tag.includes(':')) return 'callback';
  return 'variable';
}

export function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let searchIndex = 0;
  while (searchIndex < template.length) {
    const start = template.indexOf('{{', searchIndex);
    if (start === -1) break;
    const close = template.indexOf('}}', start + 2);
    if (close === -1) break;
    searchIndex = close + 2;
    const source = template.slice(start + 2, close).trim();
    const match = /^(\/?)([\w.]+(?::\w+)?)/.exec(source);
    if (!match || source.includes('}')) continue;
    const remainder = source.slice(match[0].length);
    if (remainder && !/^\s/.test(remainder)) continue;
    if (start > lastIndex) {
      tokens.push({
        type: 'text', value: template.slice(lastIndex, start),
        start: lastIndex, end: start
      });
    }
    const tag = match[2];
    tokens.push({
      type: classifyTag(tag), tag, params: remainder.trim(), closing: match[1] === '/',
      start, end: searchIndex
    });
    lastIndex = searchIndex;
  }
  if (lastIndex < template.length) {
    tokens.push({ type: 'text', value: template.slice(lastIndex), start: lastIndex, end: template.length });
  }
  return tokens;
}