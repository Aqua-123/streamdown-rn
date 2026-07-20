import React from 'react';
import { render } from '@testing-library/react-native';
import type { StreamdownProps } from '../../../../src';
import { Streamdown } from '../../../../src';
import { parseSemanticDocument, type SemanticParseOptions } from '../../../../src/core/parser';

export function renderNative(markdown: string, props: Omit<StreamdownProps, 'children'> = {}) {
  return render(React.createElement(Streamdown, { ...props, mode: props.mode ?? 'static', children: markdown }));
}

export function renderedText(markdown: string, props: Omit<StreamdownProps, 'children'> = {}): string {
  const output = renderNative(markdown, props).toJSON();
  const read = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(read).join('');
    if (!value || typeof value !== 'object') return '';
    return read((value as { children?: unknown }).children);
  };
  return read(output);
}

export function semanticTypes(markdown: string, options: SemanticParseOptions = {}): string[] {
  const types: string[] = [];
  const walk = (node: { type: string; children?: Array<{ type: string; children?: never[] }> }) => {
    types.push(node.type);
    node.children?.forEach(walk);
  };
  walk(parseSemanticDocument(markdown, options) as never);
  return types;
}
