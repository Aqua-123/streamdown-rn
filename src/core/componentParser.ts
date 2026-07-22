/**
 * Component Parser
 * 
 * Pure logic for parsing [{c:...}] component syntax.
 * No React dependencies - safe for testing.
 */

import { sanitizeProps } from './sanitize';
import type { ResourcePolicy } from './security';

// ============================================================================
// Types
// ============================================================================

/**
 * Component data extracted from DSL syntax
 */
export interface ComponentData {
  name: string;
  props: Record<string, unknown>;
  /** CSS Grid-like style for layout (gridColumn, gridRow, etc.) */
  style?: Record<string, unknown>;
  children?: ComponentData[];
}

const MAX_COMPONENT_DEPTH = 32;
const MAX_COMPONENT_NODES = 1024;
const MAX_COMPONENT_INPUT_LENGTH = 256 * 1024;

function isWithinComponentLimits(content: string): boolean {
  if (content.length > MAX_COMPONENT_INPUT_LENGTH) return false;
  let depth = 0;
  let nodes = 0;
  let inString = false;
  let escaped = false;
  for (const character of content) {
    if (escaped) { escaped = false; continue; }
    if (character === '\\' && inString) { escaped = true; continue; }
    if (character === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (character === '{' || character === '[') {
      depth++;
      nodes++;
      if (depth > MAX_COMPONENT_DEPTH || nodes > MAX_COMPONENT_NODES) return false;
    } else if (character === '}' || character === ']') {
      depth = Math.max(0, depth - 1);
    }
  }
  return true;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert DSL-style JSON (with unquoted keys) to valid JSON.
 * e.g., {c:"Card",p:{}} -> {"c":"Card","p":{}}
 */
function normalizeToJSON(dsl: string): string {
  let normalized = '';
  let inString = false;
  let escaped = false;
  const containers: Array<'{' | '['> = [];

  for (let index = 0; index < dsl.length;) {
    const character = dsl[index];
    if (inString) {
      normalized += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      index++;
      continue;
    }
    if (character === '"') {
      inString = true;
      normalized += character;
      index++;
      continue;
    }
    if (character === '{' || character === '[') containers.push(character);
    else if (character === '}' || character === ']') containers.pop();

    normalized += character;
    index++;
    if ((character !== '{' && character !== ',') || containers[containers.length - 1] !== '{') continue;

    const whitespaceStart = index;
    while (/\s/.test(dsl[index] ?? '')) index++;
    normalized += dsl.slice(whitespaceStart, index);
    const keyStart = index;
    if (!/[A-Za-z_]/.test(dsl[index] ?? '')) continue;
    index++;
    while (/[A-Za-z0-9_]/.test(dsl[index] ?? '')) index++;
    const keyEnd = index;
    while (/\s/.test(dsl[index] ?? '')) index++;
    if (dsl[index] !== ':') {
      normalized += dsl.slice(keyStart, index);
      continue;
    }
    normalized += `"${dsl.slice(keyStart, keyEnd)}"${dsl.slice(keyEnd, index)}:`;
    index++;
  }
  return normalized;
}

/**
 * Close unclosed string values in JSON.
 * Enables progressive prop rendering (e.g., {"title":"On-call → {"title":"On-call")
 */
function closeUnclosedStrings(json: string): string {
  const { inString, escaped } = scanJsonStructure(json);
  
  // If we ended inside a string, close it
  if (inString) {
    // A lone trailing escape would escape the quote we add. Complete the
    // escaped backslash first, then close the progressive string.
    return json + (escaped ? '\\' : '') + '"';
  }
  
  return json;
}

function scanJsonStructure(json: string) {
  const openStructures: Array<'{' | '['> = [];
  let inString = false;
  let escaped = false;
  for (const char of json) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') openStructures.push(char);
    else if (char === '}' && openStructures[openStructures.length - 1] === '{') openStructures.pop();
    else if (char === ']' && openStructures[openStructures.length - 1] === '[') openStructures.pop();
  }
  return { openStructures, inString, escaped };
}

/**
 * Try to repair and parse incomplete JSON by closing open braces/brackets.
 * Now also handles partial string values for progressive prop rendering.
 */
export function tryParseIncompleteJSON(json: string): unknown | null {
  // Normalize DSL syntax to valid JSON
  let normalized = normalizeToJSON(json);
  
  // First try direct parse
  try {
    return JSON.parse(normalized);
  } catch {
    let repaired = normalized;
    
    // Step 1: Close any unclosed string values
    // This enables progressive prop rendering (e.g., "title":"On → "title":"On")
    repaired = closeUnclosedStrings(repaired);
    
    // Step 2: Remove trailing comma (common in streaming)
    repaired = repaired.replace(/,\s*$/, '');
    
    // Step 3: Remove incomplete keys (no value started yet)
    // Match: comma, whitespace, quoted key, optional colon, then END
    // This removes ,"key" and ,"key": but NOT ,"key":"..." (already closed) or ,"key":123
    repaired = repaired.replace(/,\s*"[^"]*"\s*:?\s*$/g, '');
    
    // Step 4: Remove trailing commas before closing braces/brackets
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');
    
    // Step 5: Count and close unbalanced braces/brackets
    const { openStructures } = scanJsonStructure(repaired);

    // Close structures in their actual nesting order. Counting braces and
    // brackets independently produces invalid repairs for partial children.
    for (let index = openStructures.length - 1; index >= 0; index--) {
      repaired += openStructures[index] === '{' ? '}' : ']';
    }
    
    try {
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

/**
 * Recursively extract children from nested component arrays (complete JSON).
 * Props are sanitized to prevent XSS via malicious URLs.
 */
export function extractChildrenRecursive(
  children: unknown[],
  policy: ResourcePolicy = {},
  depth = 0,
  budget = { remaining: MAX_COMPONENT_NODES }
): ComponentData[] {
  if (depth >= MAX_COMPONENT_DEPTH || budget.remaining <= 0) return [];
  return children
    .filter((child): child is { c: string; p?: Record<string, unknown>; style?: Record<string, unknown>; children?: unknown[] } => 
      typeof child === 'object'
      && child !== null
      && 'c' in child
      && typeof child.c === 'string'
    )
    .slice(0, budget.remaining)
    .map(child => {
      budget.remaining--;
      return ({
      name: child.c,
      props: sanitizeProps(child.p ?? {}, policy),
      style: child.style ? sanitizeProps(child.style, policy) : undefined,
      children: Array.isArray(child.children)
        ? extractChildrenRecursive(child.children, policy, depth + 1, budget)
        : undefined,
      });
    });
}

/**
 * Find balanced closing brace/bracket position.
 * Returns -1 if not found (still streaming).
 */
function findBalancedClose(content: string, openChar: string, closeChar: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < content.length; i++) {
    if (inString) {
      if (escaped) escaped = false;
      else if (content[i] === '\\') escaped = true;
      else if (content[i] === '"') inString = false;
      continue;
    }
    if (content[i] === '"') { inString = true; continue; }
    if (content[i] === openChar) depth++;
    if (content[i] === closeChar) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Extract a single component's props and style from partial content.
 * Content should start at the opening { of the component.
 * Props are sanitized to prevent XSS via malicious URLs.
 */
function extractSingleComponentData(
  content: string,
  policy: ResourcePolicy
): { props: Record<string, unknown>; style?: Record<string, unknown> } {
  let props: Record<string, unknown> = {};
  let style: Record<string, unknown> | undefined;
  
  // Look for p:{...}
  const pMatch = content.match(/p:\s*/);
  if (pMatch) {
    const pStart = pMatch.index! + pMatch[0].length;
    const afterP = content.slice(pStart);
    const pEnd = findBalancedClose(afterP, '{', '}');
    
    if (pEnd > 0) {
      const pJson = afterP.slice(0, pEnd);
      const parsed = tryParseIncompleteJSON(pJson);
      if (parsed && typeof parsed === 'object') {
        props = parsed as Record<string, unknown>;
      }
    } else {
      // p is incomplete, try to repair
      const parsed = tryParseIncompleteJSON(afterP);
      if (parsed && typeof parsed === 'object') {
        props = parsed as Record<string, unknown>;
      }
    }
  }
  
  // Look for style:{...} (layout style, separate from props.style)
  const styleMatch = content.match(/,\s*style:\s*/);
  if (styleMatch) {
    const styleStart = styleMatch.index! + styleMatch[0].length;
    const afterStyle = content.slice(styleStart);
    const styleEnd = findBalancedClose(afterStyle, '{', '}');
    
    if (styleEnd > 0) {
      const styleJson = afterStyle.slice(0, styleEnd);
      const parsed = tryParseIncompleteJSON(styleJson);
      if (parsed && typeof parsed === 'object') {
        style = parsed as Record<string, unknown>;
      }
    }
  }
  
  // Sanitize props to prevent XSS
  return {
    props: sanitizeProps(props, policy),
    style: style ? sanitizeProps(style, policy) : undefined,
  };
}

/**
 * Extract partial children from streaming content.
 * Finds all {c:"Name" patterns and extracts available data for each.
 */
function extractPartialChildren(
  childrenContent: string,
  policy: ResourcePolicy,
  depth = 0,
  budget = { remaining: MAX_COMPONENT_NODES }
): ComponentData[] {
  if (depth >= MAX_COMPONENT_DEPTH || budget.remaining <= 0) return [];
  const children: ComponentData[] = [];
  
  for (const childContent of directChildObjects(childrenContent)) {
    if (budget.remaining-- <= 0) break;
    const nameMatch = childContent.match(/^\s*\{c:\s*"([^"]+)"/);
    if (!nameMatch) continue;
    const childName = nameMatch[1];
    
    // Extract props and style for this child
    const { props, style } = extractSingleComponentData(childContent, policy);
    
    // Recursively extract nested children if present
    let nestedChildren: ComponentData[] | undefined;
    const nestedChildrenMatch = childContent.match(/children:\s*\[/);
    if (nestedChildrenMatch) {
      const nestedStart = nestedChildrenMatch.index! + nestedChildrenMatch[0].length;
      const nestedContent = childContent.slice(nestedStart);
      nestedChildren = extractPartialChildren(nestedContent, policy, depth + 1, budget);
      if (nestedChildren.length === 0) nestedChildren = undefined;
    }
    
    children.push({
      name: childName,
      props,
      style,
      children: nestedChildren,
    });
  }
  
  return children;
}

function directChildObjects(content: string): string[] {
  const objects: string[] = [];
  let objectStart = -1;
  let objectDepth = 0;
  let arrayDepth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index++) {
    const character = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === '[') { arrayDepth++; continue; }
    if (character === ']') { if (arrayDepth > 0) arrayDepth--; continue; }
    if (character === '{') {
      if (objectDepth === 0 && arrayDepth === 0) objectStart = index;
      objectDepth++;
      continue;
    }
    if (character === '}' && objectDepth > 0) {
      objectDepth--;
      if (objectDepth === 0 && objectStart >= 0) {
        objects.push(content.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }
  if (objectStart >= 0) objects.push(content.slice(objectStart));
  return objects;
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Extract component data from DSL syntax.
 * Supports: [{c:"Name",p:{...},children:[...]}]
 * 
 * Works for both complete and streaming (partial) content.
 * Props are sanitized to prevent XSS via malicious URLs.
 */
export function extractComponentData(
  content: string,
  policy: ResourcePolicy = {}
): ComponentData {
  if (!isWithinComponentLimits(content)) return { name: '', props: {} };
  const nameMatch = content.match(/\[\{c:\s*"([^"]+)"/);
  if (!nameMatch) {
    return { name: '', props: {} };
  }
  
  const name = nameMatch[1];
  let props: Record<string, unknown> = {};
  let children: ComponentData[] | undefined;
  let style: Record<string, unknown> | undefined;
  
  // Try to extract the full component object (complete JSON)
  const fullMatch = content.match(/\[\{([\s\S]*)\}\]/);
  
  if (fullMatch) {
    // Complete component - parse as JSON
    const innerJson = `{${fullMatch[1]}}`;
    const parsed = tryParseIncompleteJSON(innerJson) as Record<string, unknown> | null;
    
    if (parsed) {
      props = (parsed.p as Record<string, unknown>) ?? {};
      style = parsed.style as Record<string, unknown> | undefined;
      
      // Extract children if present (already sanitized in extractChildrenRecursive)
      if (Array.isArray(parsed.children)) {
        children = extractChildrenRecursive(parsed.children, policy);
      }
    }
  } else {
    // Streaming - extract what we can from partial content
    const componentContent = content.slice(nameMatch.index! + nameMatch[0].length);
    const partial = tryParseIncompleteJSON(content);
    const partialRoot = Array.isArray(partial) && partial[0] && typeof partial[0] === 'object'
      ? partial[0] as { p?: Record<string, unknown>; style?: Record<string, unknown>; children?: unknown[] }
      : undefined;
    if (partialRoot) {
      props = partialRoot.p ?? {};
      style = partialRoot.style;
      if (Array.isArray(partialRoot.children)) children = extractChildrenRecursive(partialRoot.children, policy);
    }
    
    // Extract props using shared helper
    const pMatch = componentContent.match(/,\s*p:\s*/);
    if (!partialRoot && pMatch) {
      const pStart = pMatch.index! + pMatch[0].length;
      const afterP = componentContent.slice(pStart);
      const pEnd = findBalancedClose(afterP, '{', '}');
      
      if (pEnd > 0) {
        // Complete p:{...}
        const pJson = afterP.slice(0, pEnd);
        const parsed = tryParseIncompleteJSON(pJson);
        if (parsed && typeof parsed === 'object') {
          props = parsed as Record<string, unknown>;
        }
      } else {
        // Incomplete p - try to repair
        const parsed = tryParseIncompleteJSON(afterP);
        if (parsed && typeof parsed === 'object') {
          props = parsed as Record<string, unknown>;
        }
      }
    }
    
    // Extract layout style (top-level, not in props)
    const styleMatch = componentContent.match(/,\s*style:\s*\{/);
    if (!partialRoot && styleMatch) {
      const styleStart = styleMatch.index! + styleMatch[0].length - 1; // Include the {
      const afterStyle = componentContent.slice(styleStart);
      const styleEnd = findBalancedClose(afterStyle, '{', '}');
      
      if (styleEnd > 0) {
        const styleJson = afterStyle.slice(0, styleEnd);
        const parsed = tryParseIncompleteJSON(styleJson);
        if (parsed && typeof parsed === 'object') {
          style = parsed as Record<string, unknown>;
        }
      }
    }
    
    // Extract children (even if partial) - already sanitized in extractPartialChildren
    const childrenMatch = componentContent.match(/,\s*children:\s*\[/);
    if (!children && childrenMatch) {
      const childrenStart = childrenMatch.index! + childrenMatch[0].length;
      const childrenContent = componentContent.slice(childrenStart);
      children = extractPartialChildren(childrenContent, policy);
      if (children.length === 0) children = undefined;
    }
  }
  
  // Sanitize props to prevent XSS via malicious URLs
  return {
    name,
    props: sanitizeProps(props, policy),
    style: style ? sanitizeProps(style, policy) : undefined,
    children,
  };
}
