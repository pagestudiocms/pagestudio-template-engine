import type { Parameters } from './types';

const blockedProperties = new Set(['__proto__', 'prototype', 'constructor']);

export function readProperty(value: unknown, key: string): unknown {
  if (value == null || blockedProperties.has(key)) return undefined;
  if (!Object.hasOwn(value, key)) return undefined;
  return (Object(value) as Record<string, unknown>)[key];
}

export function resolveVariable(name: string, context: unknown): unknown {
  if (name.startsWith('"') || name.startsWith("'")) return name.slice(1, -1);
  return name.split('.').reduce<unknown>((value, key) => readProperty(value, key), context);
}

export function stringifyValue(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function stringifyPlaceholder(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) {
    return value.map(item => {
      if (item == null) return '';
      return typeof item === 'object' ? JSON.stringify(item) : String(item);
    }).join('');
  }
  for (const key of ['body', 'html', 'content']) {
    const content = readProperty(value, key);
    if (content !== undefined) return String(content);
  }
  if (value.toString !== Object.prototype.toString) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export function resolveVariablesInString(template: string, context: unknown): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, name: string) => {
    return stringifyPlaceholder(resolveVariable(name, context));
  });
}

export function parseParameters(source: string): Parameters {
  const params: Parameters = {};
  let cursor = 0;
  while (cursor < source.length) {
    const equals = source.indexOf('=', cursor);
    if (equals === -1) break;
    let keyEnd = equals;
    while (keyEnd > cursor && /\s/.test(source[keyEnd - 1])) keyEnd--;
    let keyStart = keyEnd;
    while (keyStart > cursor && /\w/.test(source[keyStart - 1])) keyStart--;
    let valueStart = equals + 1;
    while (valueStart < source.length && /\s/.test(source[valueStart])) valueStart++;
    if (keyStart === keyEnd || source[valueStart] !== '"') {
      cursor = equals + 1;
      continue;
    }
    const valueEnd = source.indexOf('"', valueStart + 1);
    if (valueEnd === -1) break;
    Object.defineProperty(params, source.slice(keyStart, keyEnd), {
      value: source.slice(valueStart + 1, valueEnd),
      enumerable: true, configurable: true, writable: true
    });
    cursor = valueEnd + 1;
  }
  return params;
}

export function mapPluginName(tag: string): string {
  return tag.replace(':', '_');
}