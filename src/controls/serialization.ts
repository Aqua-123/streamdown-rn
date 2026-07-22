import {
  tableDataToCSV,
  tableDataToMarkdown,
  tableDataToTSV,
  type TableData,
} from '../core/tableSerialization';
import type { NativeFileRequest, NativeImageDownloadCapability } from '../platform/capabilities';
import { sanitizeResourceURL, type SecurityPolicyOptions } from '../core/security';

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
  jsx: ['jsx', 'text/javascript;charset=utf-8'],
  typescript: ['ts', 'text/typescript;charset=utf-8'], ts: ['ts', 'text/typescript;charset=utf-8'],
  tsx: ['tsx', 'text/typescript;charset=utf-8'],
  json: ['json', 'application/json;charset=utf-8'], html: ['html', 'text/html;charset=utf-8'],
  css: ['css', 'text/css;charset=utf-8'], markdown: ['md', 'text/markdown;charset=utf-8'], md: ['md', 'text/markdown;charset=utf-8'],
  python: ['py', 'text/x-python;charset=utf-8'], py: ['py', 'text/x-python;charset=utf-8'],
  shell: ['sh', 'text/x-shellscript;charset=utf-8'], bash: ['sh', 'text/x-shellscript;charset=utf-8'],
  shellscript: ['sh', 'text/x-shellscript;charset=utf-8'], sh: ['sh', 'text/x-shellscript;charset=utf-8'],
  c: ['c', 'text/x-c;charset=utf-8'], cpp: ['cpp', 'text/x-c++src;charset=utf-8'], 'c++': ['cpp', 'text/x-c++src;charset=utf-8'],
  csharp: ['cs', 'text/x-csharp;charset=utf-8'], 'c#': ['cs', 'text/x-csharp;charset=utf-8'],
  go: ['go', 'text/x-go;charset=utf-8'], java: ['java', 'text/x-java-source;charset=utf-8'],
  rust: ['rs', 'text/x-rust;charset=utf-8'], rs: ['rs', 'text/x-rust;charset=utf-8'],
};

export function codeFileRequest(content: string, language?: string | null, basename = 'code'): NativeFileRequest {
  const [extension, mimeType] = codeTypes[(language ?? '').toLowerCase()] ?? ['txt', 'text/plain;charset=utf-8'];
  return { basename: sanitizeBasename(basename, 'code'), extension, mimeType, content };
}

const imageTypes: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif',
};
const imageMimeTypes = Object.freeze(Object.keys(imageTypes));

export function imageFileRequest(content: Uint8Array, mimeType: string, basename = 'image'): NativeFileRequest {
  const normalized = mimeType.split(';', 1)[0].toLowerCase();
  const extension = imageTypes[normalized];
  if (!extension) throw new TypeError(`Unsupported image MIME type: ${normalized || 'unknown'}`);
  const safeBasename = sanitizeBasename(basename, 'image').replace(/\.(?:png|jpe?g|gif|webp|avif)$/i, '') || 'image';
  return { basename: safeBasename, extension, mimeType: normalized, content };
}

const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function fetchImageFileRequest(
  capability: NativeImageDownloadCapability,
  uri: string,
  basename = 'image',
  maxBytes = DEFAULT_MAX_IMAGE_BYTES,
  timeoutMs = 15_000,
  resourcePolicy: SecurityPolicyOptions = {}
): Promise<NativeFileRequest> {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive finite number');
  }
  const safe = sanitizeResourceURL(uri, 'image', resourcePolicy);
  if (!safe) throw new TypeError('Image download URL is not allowed');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number');
  }
  const request = await capability.download({
    uri: safe,
    basename: sanitizeBasename(basename, 'image'),
    maxBytes,
    timeoutMs,
    mimeTypes: imageMimeTypes,
    validateUrl: (url) => {
      if (sanitizeResourceURL(url, 'image', resourcePolicy) !== url) return false;
      if (url === safe || !resourcePolicy.urlTransform) return true;
      // A transform may sign or proxy a URL and is not safe to replay on redirects.
      // Keep redirects within the already-approved transformed origin instead.
      try {
        return new URL(url).origin === new URL(safe).origin;
      } catch {
        return false;
      }
    },
  });
  if (!(request.content instanceof Uint8Array)) {
    throw new TypeError('Image download capability must return Uint8Array content');
  }
  if (request.content.byteLength > maxBytes) {
    throw new Error(`Image download exceeds ${maxBytes} bytes`);
  }
  return imageFileRequest(request.content, request.mimeType, request.basename);
}
