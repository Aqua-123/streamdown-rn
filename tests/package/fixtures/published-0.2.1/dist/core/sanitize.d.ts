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
/**
 * Sanitize a URL by checking against allowed protocols.
 *
 * @param url - URL to sanitize
 * @returns The original URL if safe, null if dangerous
 *
 * @example
 * sanitizeURL('https://example.com')     // 'https://example.com'
 * sanitizeURL('javascript:alert(1)')     // null
 * sanitizeURL('/relative/path')          // '/relative/path'
 * sanitizeURL('data:text/html,...')      // null
 */
export declare function sanitizeURL(url: string): string | null;
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
export declare function sanitizeProps(props: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=sanitize.d.ts.map
