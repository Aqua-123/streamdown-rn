/**
 * URL Security Sanitization
 * 
 * Protects against XSS via malicious URL protocols in:
 * - Component props
 * - Markdown links
 * - Images
 * 
 * Uses a strict ALLOWLIST approach - only explicitly allowed protocols pass.
 * This is more secure than blocklists which can be bypassed.
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Protocols that are safe to allow.
 * Everything else is blocked.
 */
import {
  sanitizeResourceURL,
  type ResourcePolicy,
  type ResourceSink,
} from './security';

// ============================================================================
// URL Sanitization
// ============================================================================

/**
 * Sanitize a URL by checking against allowed protocols.
 * 
 * @param url - URL to sanitize
 * @returns The original URL if safe, null if dangerous
 * 
 * @example
 * sanitizeURL('https://example.com')     // 'https://example.com'
 * sanitizeURL('javascript:alert(1)')     // null
 * sanitizeURL('/relative/path')          // null (until a host resolver is supplied)
 * sanitizeURL('data:text/html,...')      // null
 */
export function sanitizeURL(url: string, policy: ResourcePolicy = {}): string | null {
  return sanitizeResourceURL(url, 'link', policy);
}

// ============================================================================
// Prop Sanitization
// ============================================================================

/**
 * Check if a string looks like a URL (has a protocol).
 * Only strings that look like URLs need sanitization.
 */
function looksLikeURL(value: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|%[\da-f]{2})/i.test(value);
}

function sinkForKey(key: string): ResourceSink {
  return /^(?:src|srcset|source|uri|images?|imageurl|thumbnails?|avatars?)$/i.test(key)
    ? 'image'
    : 'link';
}

function isResourceKey(key: string): boolean {
  return /(?:url|href|link|src|uri|source|image|avatar|thumbnail)s?$/i.test(key);
}

/**
 * Recursively sanitize component props.
 * 
 * Checks all string values that look like URLs and sanitizes them.
 * Preserves all other values unchanged.
 * 
 * @param props - Props object to sanitize
 * @returns Sanitized props with dangerous URLs replaced with empty strings
 * 
 * @example
 * sanitizeProps({ url: 'javascript:alert(1)', title: 'Safe' })
 * // { url: '', title: 'Safe' }
 */
export function sanitizeProps(
  props: Record<string, unknown>,
  policy: ResourcePolicy = {}
): Record<string, unknown> {
  const sanitized = sanitizeValue(props, '', policy, 0, {
    remaining: 4096,
    ancestry: new WeakSet(),
  });
  return sanitized && !Array.isArray(sanitized) && typeof sanitized === 'object'
    ? sanitized as Record<string, unknown>
    : {};
}

const MAX_PROP_DEPTH = 32;

interface SanitizeBudget {
  remaining: number;
  ancestry: WeakSet<object>;
}

function sanitizeValue(
  value: unknown,
  key: string,
  policy: ResourcePolicy,
  depth: number,
  budget: SanitizeBudget
): unknown {
  if (budget.remaining-- <= 0) return null;
  if (typeof value === 'string') {
    return looksLikeURL(value) || isResourceKey(key)
      ? sanitizeResourceURL(value, sinkForKey(key), policy) ?? ''
      : value;
  }
  if (typeof value !== 'object' || value === null) return value;
  if (depth > MAX_PROP_DEPTH || budget.ancestry.has(value)) return null;

  budget.ancestry.add(value);
  try {
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (const item of value) {
        if (budget.remaining <= 0) break;
        result.push(sanitizeValue(item, key, policy, depth + 1, budget));
      }
      return result;
    }

    const result: Record<string, unknown> = {};
    for (const nestedKey in value) {
      if (budget.remaining <= 0) break;
      if (!Object.prototype.hasOwnProperty.call(value, nestedKey)) continue;
      if (nestedKey === '__proto__' || nestedKey === 'prototype' || nestedKey === 'constructor') continue;
      result[nestedKey] = sanitizeValue(
        (value as Record<string, unknown>)[nestedKey],
        nestedKey,
        policy,
        depth + 1,
        budget
      );
    }
    return result;
  } finally {
    budget.ancestry.delete(value);
  }
}
