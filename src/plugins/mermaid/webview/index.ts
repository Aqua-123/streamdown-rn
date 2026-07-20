import type { ReactNode } from 'react';
import { type MermaidAdapter, type MermaidFamily, type MermaidRenderRequest } from '..';

export interface OfflineWebViewAssets {
  /** Bundled source text; remote URLs and dynamic network loaders are rejected. */
  mermaidJs: string;
  katexJs?: string;
  katexCss?: string;
}

export interface OfflineBridgeRequest {
  id: string;
  kind: 'mermaid' | 'math';
  source: string;
  display?: boolean;
  config?: Readonly<Record<string, unknown>>;
  navigation: 'disabled';
  links: 'disabled';
  maxMessageBytes: number;
  contentSecurityPolicy: "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'";
  assetDigest?: string;
}

export interface OfflineWebViewTransport {
  /** Trusted host code must load only `assets`, enforce CSP, reject navigation/network/file access, and return one status message. */
  render(request: OfflineBridgeRequest, signal: AbortSignal, assets: OfflineWebViewAssets): Promise<string>;
  release(surfaceId: string): void;
  dispose(): void;
}

export interface OfflineWebViewAdapterOptions {
  assets: OfflineWebViewAssets;
  transport: OfflineWebViewTransport;
  timeoutMs?: number;
  maxMessageBytes?: number;
  maxSourceBytes?: number;
  maxAssetBytes?: number;
  maxRetries?: number;
  /** Optional application-pinned digest that trusted transport code verifies before loading assets. */
  assetDigest?: string;
  /** Materialize the already-locked host WebView surface; SVG/DOM never crosses the bridge. */
  renderSurface: (surfaceId: string, kind: 'mermaid' | 'math') => ReactNode;
}

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

function assertOfflineAssets(assets: OfflineWebViewAssets): void {
  if (!assets.mermaidJs.trim()) throw new TypeError('Offline Mermaid asset is required');
  const joined = [assets.mermaidJs, assets.katexJs, assets.katexCss].filter(Boolean).join('\n');
  if (/<script\b[^>]*\bsrc\s*=|\b(?:fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(\s*["'](?:https?:|data:|file:|ftp:)/i.test(joined)) {
    throw new TypeError('WebView assets must be fully offline');
  }
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const symbol of value) {
    const point = symbol.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function parseBridgeMessage(raw: string, id: string, maxMessageBytes: number): string {
  if (utf8Bytes(raw) > maxMessageBytes) throw new Error('WebView bridge message is too large');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('Invalid WebView bridge JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid WebView bridge message');
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(',') !== 'id,surfaceId,type' || record.id !== id || record.type !== 'rendered' || record.surfaceId !== id) {
    throw new Error('Invalid WebView bridge message');
  }
  return record.surfaceId;
}

export function createOfflineWebViewAdapter(options: OfflineWebViewAdapterOptions) {
  assertOfflineAssets(options.assets);
  const timeoutMs = positiveInteger(options.timeoutMs, 15_000, 'timeoutMs');
  const maxMessageBytes = positiveInteger(options.maxMessageBytes, 16_384, 'maxMessageBytes');
  const maxSourceBytes = positiveInteger(options.maxSourceBytes, 400_000, 'maxSourceBytes');
  const maxAssetBytes = positiveInteger(options.maxAssetBytes, 8 * 1024 * 1024, 'maxAssetBytes');
  const assetBytes = [options.assets.mermaidJs, options.assets.katexJs, options.assets.katexCss]
    .reduce((total, value) => total + (value ? utf8Bytes(value) : 0), 0);
  if (assetBytes > maxAssetBytes) throw new Error(`Offline WebView assets exceed ${maxAssetBytes} bytes`);
  const maxRetries = nonnegativeInteger(options.maxRetries, 1, 'maxRetries');
  const active = new Set<AbortController>();
  let disposed = false;
  let sequence = 0;
  const surfaces = new Set<string>();

  const releaseSurface = (surfaceId: string) => {
    if (!surfaces.delete(surfaceId)) return;
    options.transport.release(surfaceId);
  };

  const execute = async (request: Omit<OfflineBridgeRequest, 'id' | 'navigation' | 'links' | 'maxMessageBytes' | 'contentSecurityPolicy' | 'assetDigest'>) => {
    if (disposed) throw new Error('Offline WebView adapter is disposed');
    if (utf8Bytes(request.source) > maxSourceBytes) throw new Error(`Offline WebView source exceeds ${maxSourceBytes} bytes`);
    if (request.config && utf8Bytes(JSON.stringify(request.config)) > 20_000) throw new Error('Offline WebView config is too large');
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      active.add(controller);
      const id = `streamdown-rn-${++sequence}`;
      const timer = setTimeout(() => controller.abort(new Error('Offline WebView render timed out')), timeoutMs);
      try {
        const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => {
          reject(controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Offline WebView render cancelled'));
        }, { once: true }));
        const raw = await Promise.race([
          options.transport.render({
            ...request,
            id,
            navigation: 'disabled',
            links: 'disabled',
            maxMessageBytes,
            contentSecurityPolicy: "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
            assetDigest: options.assetDigest,
          }, controller.signal, options.assets),
          aborted,
        ]);
        if (disposed) throw new Error('Offline WebView adapter is disposed');
        return parseBridgeMessage(raw, id, maxMessageBytes);
      } catch (reason) {
        lastError = reason instanceof Error ? reason : new Error(String(reason));
        if (disposed) throw new Error('Offline WebView adapter is disposed');
      } finally {
        clearTimeout(timer);
        active.delete(controller);
      }
    }
    throw lastError;
  };

  const mermaid: MermaidAdapter = {
    families: ['*'],
    async render(request: MermaidRenderRequest) {
      const surfaceId = await execute({ kind: 'mermaid', source: request.source, config: request.config });
      surfaces.add(surfaceId);
      try {
        return { kind: 'native', content: options.renderSurface(surfaceId, 'mermaid'), release: () => releaseSurface(surfaceId) };
      } catch (error) { releaseSurface(surfaceId); throw error; }
    },
  };

  return {
    mermaid,
    /** Async controller; intentionally not assignable to the synchronous native MathNativeAdapter. */
    mathController: {
      async render(request: { source: string; display: boolean; errorColor?: string }) {
        const surfaceId = await execute({ kind: 'math', source: request.source, display: request.display, config: { errorColor: request.errorColor } });
        surfaces.add(surfaceId);
        try {
          return { kind: 'surface' as const, content: options.renderSurface(surfaceId, 'math'), release: () => releaseSurface(surfaceId) };
        } catch (error) { releaseSurface(surfaceId); throw error; }
      },
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const controller of active) controller.abort(new Error('Offline WebView adapter is disposed'));
      active.clear();
      for (const surfaceId of [...surfaces]) releaseSurface(surfaceId);
      options.transport.dispose();
    },
  };
}

export type { MermaidFamily };
