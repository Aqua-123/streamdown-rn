import type { ReactNode } from 'react';
import remarkMath from 'remark-math';
import type { Pluggable } from 'unified';

export interface MathRenderRequest {
  source: string;
  display: boolean;
  errorColor?: string;
}

/** Host adapter seam for a release-build-proven renderer such as RaTeX. */
export interface MathNativeAdapter {
  render(request: MathRenderRequest): ReactNode;
}

export interface MathPlugin {
  name: 'katex';
  type: 'math';
  remarkPlugin: Pluggable;
  /** DOM-only Streamdown fields are deliberately absent from the native plugin. */
  rehypePlugin?: never;
  getStyles?: never;
  adapter?: MathNativeAdapter;
  errorColor?: string;
  maxExpressionLength: number;
  onError?: (error: Error) => void;
  render(request: MathRenderRequest): ReactNode | null;
}

export interface MathPluginOptions {
  singleDollarTextMath?: boolean;
  errorColor?: string;
  adapter?: MathNativeAdapter;
  maxExpressionLength?: number;
  onError?: (error: Error) => void;
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

export function createMathPlugin(options: MathPluginOptions = {}): MathPlugin {
  const errorColor = options.errorColor;
  const plugin: MathPlugin = {
    name: 'katex',
    type: 'math',
    remarkPlugin: [remarkMath, { singleDollarTextMath: options.singleDollarTextMath ?? false }],
    adapter: options.adapter,
    errorColor,
    maxExpressionLength: positiveInteger(options.maxExpressionLength, 100_000, 'maxExpressionLength'),
    onError: options.onError,
    render(request) { return renderMath(plugin, request); },
  };
  return plugin;
}

export function renderMath(plugin: MathPlugin, request: MathRenderRequest): ReactNode | null {
  if (!plugin.adapter || request.source.length > plugin.maxExpressionLength) return null;
  try {
    return plugin.adapter.render({ ...request, errorColor: plugin.errorColor ?? request.errorColor });
  } catch (reason) {
    plugin.onError?.(reason instanceof Error ? reason : new Error(String(reason)));
    return null;
  }
}

export const math = createMathPlugin();
