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
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(props)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    if (typeof value === 'string') {
      if (looksLikeURL(value) || isResourceKey(key)) {
        const safeUrl = sanitizeResourceURL(value, sinkForKey(key), policy);
        result[key] = safeUrl ?? '';
      } else {
        result[key] = value;
      }
    } else if (Array.isArray(value)) {
      // Recursively sanitize arrays
      result[key] = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return sanitizeProps(item as Record<string, unknown>, policy);
        }
        if (typeof item === 'string' && (looksLikeURL(item) || isResourceKey(key))) {
          return sanitizeResourceURL(item, sinkForKey(key), policy) ?? '';
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      result[key] = sanitizeProps(value as Record<string, unknown>, policy);
    } else {
      // Preserve primitives (numbers, booleans, null)
      result[key] = value;
    }
  }
  
  return result;
}
