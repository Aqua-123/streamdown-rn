import type { ComponentType, ReactNode } from 'react';
import { MermaidBlock, type MermaidBlockProps } from './MermaidBlock';

export { mermaidFileRequest, type MermaidDownloadFormat } from './download';

export type MermaidFamily = 'flowchart' | 'sequence' | 'class' | 'state' | 'er' | 'xychart' | 'unsupported' | 'invalid';
export const BEAUTIFUL_MERMAID_FAMILIES = ['flowchart', 'state', 'sequence', 'class', 'er', 'xychart'] as const;
export type MermaidConfig = Readonly<Record<string, unknown>>;

export interface MermaidRenderRequest {
  source: string;
  family: MermaidFamily;
  config: MermaidConfig;
}

export type MermaidRenderResult =
  | { kind: 'native'; content: ReactNode; svg?: string; png?: Uint8Array; release?: () => void }
  | { kind: 'svg'; svg: string; content?: ReactNode; png?: Uint8Array; release?: () => void };

export interface MermaidAdapter {
  /** `*` is reserved for the separately imported full-fidelity adapter. */
  families: readonly (MermaidFamily | '*')[];
  render(request: MermaidRenderRequest): MermaidRenderResult | Promise<MermaidRenderResult>;
  renderSvg?: (svg: string) => ReactNode;
}

export interface BeautifulMermaidProvider {
  render(request: MermaidRenderRequest): { svg: string; png?: Uint8Array } | Promise<{ svg: string; png?: Uint8Array }>;
  renderSvg(svg: string): ReactNode;
}

const BEAUTIFUL_MERMAID_COLORS: Readonly<Record<string, string>> = {
  '--bg': '#FFFFFF', '--fg': '#27272A', '--_text': '#27272A', '--_text-sec': '#52525B',
  '--_text-muted': '#71717A', '--_text-faint': '#A1A1AA', '--_line': '#71717A',
  '--_arrow': '#3F3F46', '--_node-fill': '#FAFAFA', '--_node-stroke': '#D4D4D8',
  '--_group-fill': '#FFFFFF', '--_group-hdr': '#F4F4F5', '--_inner-stroke': '#E4E4E7',
  '--_key-badge': '#E4E4E7',
};

/** Converts beautiful-mermaid's browser CSS into the strict, offline SVG subset accepted on native. */
export function normalizeBeautifulMermaidSvg(svg: string): string {
  return svg
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/var\(\s*(--[\w-]+)(?:\s*,[^)]*)?\)/gi, (_match, name: string) => BEAUTIFUL_MERMAID_COLORS[name] ?? '#27272A');
}

/** Injects beautiful-mermaid plus react-native-svg without making either a core dependency. */
export function createBeautifulMermaidAdapter(provider: BeautifulMermaidProvider): MermaidAdapter {
  return {
    families: BEAUTIFUL_MERMAID_FAMILIES,
    async render(request) {
      const result = await provider.render(request);
      return { kind: 'svg', ...result, svg: normalizeBeautifulMermaidSvg(result.svg) };
    },
    renderSvg: provider.renderSvg,
  };
}

export interface MermaidInstance {
  initialize(config: MermaidConfig): void;
  render(id: string, source: string): Promise<MermaidRenderResult>;
}

export interface DiagramPlugin {
  name: 'mermaid';
  type: 'diagram';
  language: 'mermaid';
  getMermaid(config?: MermaidConfig): MermaidInstance;
  render(source: string): Promise<MermaidRenderResult>;
  maxSourceLength: number;
  maxSvgLength: number;
  onError?: (error: Error) => void;
  errorComponent?: ComponentType<{ error: Error; source: string; retry: () => void }>;
  component: ComponentType<MermaidBlockProps>;
}

export interface MermaidPluginOptions {
  config?: MermaidConfig;
  adapter?: MermaidAdapter;
  fullFidelityAdapter?: MermaidAdapter;
  maxSourceLength?: number;
  maxSvgLength?: number;
  maxRetries?: number;
  onError?: (error: Error) => void;
  errorComponent?: ComponentType<{ error: Error; source: string; retry: () => void }>;
}

const DEFAULT_CONFIG: MermaidConfig = {
  theme: 'default',
  fontFamily: 'monospace',
};
const SECURITY_CONFIG: MermaidConfig = {
  startOnLoad: false,
  securityLevel: 'strict',
  suppressErrorRendering: true,
};

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function nonnegativeInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a nonnegative integer`);
  return value;
}

function safeConfig(value: MermaidConfig): MermaidConfig {
  const seen = new WeakSet<object>();
  const visit = (entry: unknown): void => {
    if (entry === null || typeof entry === 'string' || typeof entry === 'boolean') return;
    if (typeof entry === 'number' && Number.isFinite(entry)) return;
    if (typeof entry !== 'object') throw new TypeError('Mermaid config must contain only JSON values');
    if (seen.has(entry)) throw new TypeError('Mermaid config must not contain cycles');
    seen.add(entry);
    if (!Array.isArray(entry) && Object.getPrototypeOf(entry) !== Object.prototype && Object.getPrototypeOf(entry) !== null) {
      throw new TypeError('Mermaid config must contain plain objects');
    }
    for (const [key, nested] of Object.entries(entry)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new TypeError('Unsafe Mermaid config key');
      visit(nested);
    }
    seen.delete(entry);
  };
  visit(value);
  const json = JSON.stringify(value);
  if (json.length > 20_000) throw new TypeError('Mermaid config is too large');
  return JSON.parse(json) as MermaidConfig;
}

function resolveConfig(options: MermaidConfig | undefined, next: MermaidConfig = {}): MermaidConfig {
  return safeConfig({ ...DEFAULT_CONFIG, ...options, ...next, ...SECURITY_CONFIG });
}

export function detectMermaidFamily(source: string): MermaidFamily {
  const first = source.trimStart().split(/[\s{]/, 1)[0];
  if (/^(?:flowchart|graph)$/i.test(first)) return 'flowchart';
  if (/^sequenceDiagram$/i.test(first)) return 'sequence';
  if (/^classDiagram$/i.test(first)) return 'class';
  if (/^stateDiagram(?:-v2)?$/i.test(first)) return 'state';
  if (/^erDiagram$/i.test(first)) return 'er';
  if (/^xychart-beta$/i.test(first)) return 'xychart';
  if (/^(?:gantt|journey|timeline|gitGraph|quadrantChart|pie|mindmap|sankey-beta|packet-beta|architecture-beta|block-beta|kanban)$/i.test(first)) return 'unsupported';
  return 'invalid';
}

export function sanitizeMermaidSvg(svg: string, maxLength = 1_000_000): string {
  if (svg.length > maxLength) throw new Error('Mermaid SVG is too large');
  if (!/^\s*<svg(?:\s|>)/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) throw new Error('Invalid Mermaid SVG');
  const securityScan = svg.replace(/\smarker-(?:start|mid|end)\s*=\s*["']url\(#[a-z][\w:.-]*\)["']/gi, '');
  if (/<(?:script|foreignObject|iframe|object|embed|image|use|style|link|meta|animate|animateMotion|animateTransform|set|filter|fe[a-z]+)\b|\son[a-z]+\s*=|\s(?:href|xlink:href|style|filter|mask|clip-path)\s*=|url\s*\(|@import|<!DOCTYPE|<\?xml|\s[a-z][\w-]*:[\w-]+\s*=/i.test(securityScan)) {
    throw new Error('Unsafe Mermaid SVG');
  }
  const unsafeEntity = svg.match(/&(?:#(?:x[\da-f]+|\d+)|[a-z][\w]+);/gi)?.find((entity) => !/^&(amp|lt|gt|quot|apos);$/i.test(entity));
  if (unsafeEntity) throw new Error('Unsafe Mermaid SVG entity');
  if ((svg.match(/<[a-z][^>]*>/gi)?.length ?? 0) > 5_000) throw new Error('Mermaid SVG has too many elements');
  for (const match of svg.matchAll(/\sd\s*=\s*["']([^"']*)["']/gi)) {
    if (match[1].length > 100_000) throw new Error('Mermaid SVG path data is too large');
  }
  for (const match of svg.matchAll(/(?:^|[^\d.-])(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?=[^\d.-]|$)/gi)) {
    if (Math.abs(Number(match[1])) > 10_000_000) throw new Error('Mermaid SVG numeric value is too large');
  }
  for (const match of svg.matchAll(/\s(?:width|height)\s*=\s*["']([\d.]+)(?:px)?["']/gi)) {
    if (Number(match[1]) > 8192) throw new Error('Mermaid SVG dimensions are too large');
  }
  return svg;
}

function supports(adapter: MermaidAdapter | undefined, family: MermaidFamily): adapter is MermaidAdapter {
  return Boolean(adapter?.families.includes('*') || adapter?.families.includes(family));
}

export function createMermaidPlugin(options: MermaidPluginOptions = {}): DiagramPlugin {
  const maxSourceLength = positiveInteger(options.maxSourceLength, 100_000, 'maxSourceLength');
  const maxSvgLength = positiveInteger(options.maxSvgLength, 1_000_000, 'maxSvgLength');
  const retries = nonnegativeInteger(options.maxRetries, 0, 'maxRetries');
  let config = resolveConfig(options.config);

  const render = async (source: string): Promise<MermaidRenderResult> => {
    if (source.length > maxSourceLength) {
      const error = new Error(`Mermaid source exceeds ${maxSourceLength} characters`);
      options.onError?.(error);
      throw error;
    }
    const family = detectMermaidFamily(source);
    const adapter = supports(options.adapter, family)
      ? options.adapter
      : supports(options.fullFidelityAdapter, family) ? options.fullFidelityAdapter : undefined;
    if (!adapter) {
      const error = new Error(`No Mermaid adapter supports ${family} diagrams`);
      options.onError?.(error);
      throw error;
    }
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= retries; attempt++) {
      let supplied: MermaidRenderResult | undefined;
      try {
        supplied = await adapter.render({ source, family, config });
        const result: MermaidRenderResult = supplied.svg
          ? { ...supplied, svg: sanitizeMermaidSvg(supplied.svg, maxSvgLength) }
          : { ...supplied };
        if (result.kind === 'svg' && !result.content && adapter.renderSvg) {
          return { ...result, content: adapter.renderSvg(result.svg) };
        }
        return result;
      } catch (reason) {
        try { supplied?.release?.(); } catch { /* preserve the render/security failure */ }
        lastError = reason instanceof Error ? reason : new Error(String(reason));
      }
    }
    options.onError?.(lastError!);
    throw lastError;
  };

  const instance: MermaidInstance = {
    initialize(next) { config = resolveConfig(options.config, next); },
    render(_id, source) { return render(source); },
  };
  return {
    name: 'mermaid', type: 'diagram', language: 'mermaid', maxSourceLength, maxSvgLength,
    component: MermaidBlock,
    onError: options.onError,
    errorComponent: options.errorComponent,
    getMermaid(next) { if (next) instance.initialize(next); return instance; },
    render,
  };
}

export const mermaid = createMermaidPlugin();
