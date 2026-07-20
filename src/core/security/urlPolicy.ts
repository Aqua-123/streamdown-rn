export type ResourceSink = 'link' | 'image';

export interface DataImagePolicy {
  mimeTypes: readonly string[];
  maxBytes: number;
}

export interface ResourcePolicy {
  /** Additional application-owned schemes. Built-in link schemes stay enabled. */
  allowedLinkSchemes?: readonly string[];
  /** Required before relative URLs can become native actions. */
  resolveRelativeUrl?: (url: string) => string | null | undefined;
  /** Data images are disabled unless both MIME and decoded size are bounded. */
  dataImages?: DataImagePolicy;
}

const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'sms']);
const NEVER_LINK_SCHEMES = new Set(['javascript', 'vbscript', 'file', 'content', 'data', 'blob']);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

function decodeForInspection(value: string): string | null {
  try {
    let decoded = value.replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (_match, hex, decimal) =>
      String.fromCodePoint(Number.parseInt(hex ?? decimal, hex ? 16 : 10))
    );
    for (let index = 0; index < 2; index += 1) {
      let next: string;
      try {
        next = decodeURIComponent(decoded);
      } catch {
        break;
      }
      if (next === decoded) break;
      decoded = next;
    }
    return decoded;
  } catch {
    return null;
  }
}

function dataImageAllowed(url: string, policy: DataImagePolicy | undefined): boolean {
  if (!policy || !Number.isFinite(policy.maxBytes) || policy.maxBytes < 0) return false;
  const match = /^data:([^;,]+);base64,([a-z\d+/]*={0,2})$/i.exec(url);
  if (!match) return false;
  const mime = match[1].toLowerCase();
  if (
    !mime.startsWith('image/') ||
    mime === 'image/svg+xml' ||
    !policy.mimeTypes.map((value) => value.toLowerCase()).includes(mime)
  ) {
    return false;
  }
  const payload = match[2];
  if (payload.length % 4 !== 0) return false;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return (payload.length * 3) / 4 - padding <= policy.maxBytes;
}

function isRelative(value: string): boolean {
  return !SCHEME.test(value);
}

/** Validate the final value immediately before it reaches a native URL sink. */
export function sanitizeResourceURL(
  value: string,
  sink: ResourceSink,
  policy: ResourcePolicy = {}
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || CONTROL_CHARACTERS.test(trimmed)) return null;

  const inspected = decodeForInspection(trimmed);
  if (!inspected || CONTROL_CHARACTERS.test(inspected)) return null;

  if (sink === 'image' && inspected.toLowerCase().startsWith('data:')) {
    return dataImageAllowed(inspected, policy.dataImages) ? trimmed : null;
  }

  if (isRelative(inspected)) {
    if (!policy.resolveRelativeUrl) return null;
    const resolved = policy.resolveRelativeUrl(trimmed);
    if (!resolved || isRelative(resolved)) return null;
    return sanitizeResourceURL(resolved, sink, { ...policy, resolveRelativeUrl: undefined });
  }

  const scheme = SCHEME.exec(inspected)?.[1].toLowerCase();
  if (!scheme) return null;
  if (sink === 'image') {
    if (scheme !== 'https') return null;
  } else {
    if (NEVER_LINK_SCHEMES.has(scheme)) return null;
    const declared = new Set([
      ...LINK_SCHEMES,
      ...(policy.allowedLinkSchemes ?? []).map((item) => item.replace(/:$/, '').toLowerCase()),
    ]);
    if (!declared.has(scheme)) return null;
  }

  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}
