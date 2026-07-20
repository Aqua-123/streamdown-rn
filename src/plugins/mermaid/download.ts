import type { NativeFileRequest } from '../../platform/capabilities';
import type { MermaidRenderResult } from '.';

export type MermaidDownloadFormat = 'mmd' | 'svg' | 'png';

/** Builds a native save request without relying on browser canvas, Blob, or object URLs. */
export function mermaidFileRequest(
  source: string,
  result: MermaidRenderResult | undefined,
  format: MermaidDownloadFormat,
): NativeFileRequest {
  if (format === 'mmd') {
    return { basename: 'diagram', extension: 'mmd', mimeType: 'text/plain;charset=utf-8', content: source };
  }
  if (format === 'svg') {
    if (!result?.svg?.trim()) throw new Error('Mermaid SVG is unavailable');
    return { basename: 'diagram', extension: 'svg', mimeType: 'image/svg+xml;charset=utf-8', content: result.svg };
  }
  if (!result?.png?.byteLength) throw new Error('Mermaid PNG is unavailable');
  return { basename: 'diagram', extension: 'png', mimeType: 'image/png', content: result.png };
}
