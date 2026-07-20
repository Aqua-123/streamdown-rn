import {
  tableDataToCSV,
  tableDataToMarkdown,
  tableDataToTSV,
  type TableData,
} from '../core/tableSerialization';
import type { NativeFileRequest } from '../platform/capabilities';
import { sanitizeResourceURL } from '../core/security';

export type TableFormat = 'csv' | 'tsv' | 'markdown';

export function sanitizeBasename(value: string, fallback = 'download'): string {
  const safe = value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 80);
  return safe || fallback;
}

export function serializeTable(table: TableData, format: TableFormat): string {
  if (format === 'csv') return tableDataToCSV(table);
  if (format === 'tsv') return tableDataToTSV(table);
  return tableDataToMarkdown(table);
}

export function tableFileRequest(
  table: TableData,
  format: Exclude<TableFormat, 'tsv'>,
  basename = 'table'
): NativeFileRequest {
  const csv = format === 'csv';
  const content = serializeTable(table, format);
  return {
    basename: sanitizeBasename(basename, 'table'),
    extension: csv ? 'csv' : 'md',
    mimeType: csv ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8',
    content: csv ? `\uFEFF${content}` : content,
  };
}

const codeTypes: Record<string, [string, string]> = {
  javascript: ['js', 'text/javascript;charset=utf-8'], js: ['js', 'text/javascript;charset=utf-8'],
  typescript: ['ts', 'text/typescript;charset=utf-8'], ts: ['ts', 'text/typescript;charset=utf-8'],
  json: ['json', 'application/json;charset=utf-8'], html: ['html', 'text/html;charset=utf-8'],
  css: ['css', 'text/css;charset=utf-8'], markdown: ['md', 'text/markdown;charset=utf-8'], md: ['md', 'text/markdown;charset=utf-8'],
  python: ['py', 'text/x-python;charset=utf-8'], py: ['py', 'text/x-python;charset=utf-8'],
  shell: ['sh', 'text/x-shellscript;charset=utf-8'], bash: ['sh', 'text/x-shellscript;charset=utf-8'],
};

export function codeFileRequest(content: string, language?: string | null, basename = 'code'): NativeFileRequest {
  const [extension, mimeType] = codeTypes[(language ?? '').toLowerCase()] ?? ['txt', 'text/plain;charset=utf-8'];
  return { basename: sanitizeBasename(basename, 'code'), extension, mimeType, content };
}

const imageTypes: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif',
};

export function imageFileRequest(content: Uint8Array, mimeType: string, basename = 'image'): NativeFileRequest {
  const normalized = mimeType.split(';', 1)[0].toLowerCase();
  const extension = imageTypes[normalized];
  if (!extension) throw new TypeError(`Unsupported image MIME type: ${normalized || 'unknown'}`);
  const safeBasename = sanitizeBasename(basename, 'image').replace(/\.(?:png|jpe?g|gif|webp|avif)$/i, '') || 'image';
  return { basename: safeBasename, extension, mimeType: normalized, content };
}

const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function fetchImageFileRequest(
  uri: string,
  basename = 'image',
  maxBytes = DEFAULT_MAX_IMAGE_BYTES,
  timeoutMs = 15_000
): Promise<NativeFileRequest> {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive finite number');
  }
  const safe = sanitizeResourceURL(uri, 'image');
  if (!safe) throw new TypeError('Image download URL is not allowed');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(safe, { signal: controller.signal });
    if (!response.ok) throw new Error(`Image download failed (${response.status})`);
    if (response.url && !sanitizeResourceURL(response.url, 'image')) {
      throw new Error('Image download redirected to a disallowed URL');
    }
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Image download exceeds ${maxBytes} bytes`);
    }
    const mimeType = response.headers.get('content-type') ?? '';
    const content = new Uint8Array(await response.arrayBuffer());
    if (content.byteLength > maxBytes) {
      throw new Error(`Image download exceeds ${maxBytes} bytes`);
    }
    return imageFileRequest(content, mimeType, basename);
  } finally {
    clearTimeout(timeout);
  }
}
