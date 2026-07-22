import type { Content, Root } from 'mdast';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import type { Pluggable, PluggableList } from 'unified';
import { matchCodeBlockStart } from './splitter/blockPatterns';
import {
  preprocessCustomTags,
  preprocessLiteralTagContent,
} from './preprocessTags';

export interface SemanticPluginOrder {
  before?: PluggableList;
  defaults?: PluggableList;
  supplied?: PluggableList;
  after?: PluggableList;
  math?: Pluggable;
}

export interface SemanticParseOptions extends SemanticPluginOrder {
  customTags?: readonly string[];
  literalTags?: readonly string[];
  onError?: (error: Error) => void;
}

const DEFAULT_PLUGINS: PluggableList = [remarkGfm];
const PROCESSOR_CACHE_LIMIT = 100;
const MAX_SEMANTIC_TREE_DEPTH = 256;
const MAX_SEMANTIC_TREE_NODES = 50_000;
const MAX_MARKDOWN_PHYSICAL_LINES = 50_000;
const MAX_MARKDOWN_STRUCTURE_MARKERS = 25_000;
const MAX_PARSE_FALLBACK_LENGTH = 8 * 1024;
const pluginIds = new WeakMap<object, number>();
const processors = new Map<string, ReturnType<typeof remark>>();
const parseErrors = new WeakMap<Root, Error>();
let nextPluginId = 1;

const HTML_BLOCK_START_PATTERN = /^[ \t]*<[\w!/?-]/;
const HTML_LINE_INDENT_PATTERN = /(^|\n)[ \t]{4,}(?=<[\w!/?-])/g;

function assertBoundedMarkdownSource(markdown: string): void {
  let lines = markdown ? 1 : 0;
  let markers = 0;
  let fence = '';
  let fenceSize = 0;

  for (let lineStart = 0; lineStart < markdown.length;) {
    let lineEnd = lineStart;
    while (lineEnd < markdown.length && markdown[lineEnd] !== '\n' && markdown[lineEnd] !== '\r') lineEnd++;
    const line = markdown.slice(lineStart, lineEnd);
    const marker = matchCodeBlockStart(line);
    if (fence) {
      if (marker && marker[2][0] === fence && marker[2].length >= fenceSize && !marker[3].trim()) {
        fence = '';
        fenceSize = 0;
      }
    } else if (marker) {
      fence = marker[2][0];
      fenceSize = marker[2].length;
    } else {
      for (let index = lineStart; index < lineEnd; index++) {
        const char = markdown[index];
        if (char === '*' || char === '_' || char === '~' || char === '[' || char === ']' || char === '<') {
          if (++markers > MAX_MARKDOWN_STRUCTURE_MARKERS) {
            throw new RangeError(`Markdown source exceeds ${MAX_MARKDOWN_STRUCTURE_MARKERS} structural markers`);
          }
        }
      }
    }
    if (lineEnd === markdown.length) break;
    if (markdown[lineEnd] === '\r' && markdown[lineEnd + 1] === '\n') lineEnd++;
    if (++lines > MAX_MARKDOWN_PHYSICAL_LINES) {
      throw new RangeError(`Markdown source exceeds ${MAX_MARKDOWN_PHYSICAL_LINES} physical lines`);
    }
    lineStart = lineEnd + 1;
  }
}

function boundedFallback(markdown: string): string {
  if (markdown.length <= MAX_PARSE_FALLBACK_LENGTH) return markdown;
  const half = Math.floor(MAX_PARSE_FALLBACK_LENGTH / 2);
  return `${markdown.slice(0, half)}\n\n[Markdown preview truncated]\n\n${markdown.slice(-half)}`;
}

/** Prevent indented tags in an HTML-led document from becoming code blocks. */
export function normalizeHtmlIndentation(content: string): string {
  if (!content || !HTML_BLOCK_START_PATTERN.test(content)) return content;
  return content.replace(HTML_LINE_INDENT_PATTERN, '$1');
}

function valueId(value: unknown): string {
  if ((typeof value !== 'function' && typeof value !== 'object') || value === null) {
    return `${typeof value}:${String(value)}`;
  }
  const object = value as object;
  let id = pluginIds.get(object);
  if (!id) {
    id = nextPluginId++;
    pluginIds.set(object, id);
  }
  return `ref:${id}`;
}

function pluginId(plugin: Pluggable): string {
  if (!Array.isArray(plugin)) return valueId(plugin);
  return `${valueId(plugin[0])}:${valueId(plugin[1])}`;
}

/** CJK-before -> defaults/GFM -> CJK-after -> math, matching Streamdown. */
export function mergeRemarkPlugins(order: SemanticPluginOrder = {}): PluggableList {
  return [
    ...(order.before ?? []),
    ...(order.defaults ?? DEFAULT_PLUGINS),
    ...(order.supplied ?? []),
    ...(order.after ?? []),
    ...(order.math ? [order.math] : []),
  ];
}

function getProcessor(order: SemanticPluginOrder): ReturnType<typeof remark> {
  const plugins = mergeRemarkPlugins(order);
  const key = plugins.map(pluginId).join('|');
  const cached = processors.get(key);
  if (cached) return cached;

  const processor = remark().use(plugins);
  if (processors.size >= PROCESSOR_CACHE_LIMIT) {
    const oldest = processors.keys().next().value;
    if (oldest !== undefined) processors.delete(oldest);
  }
  processors.set(key, processor);
  return processor;
}

export function assertBoundedSemanticTree(root: Root): void {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: root, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    nodes++;
    if (nodes > MAX_SEMANTIC_TREE_NODES) throw new RangeError(`Markdown tree exceeds ${MAX_SEMANTIC_TREE_NODES} nodes`);
    if (depth > MAX_SEMANTIC_TREE_DEPTH) throw new RangeError(`Markdown tree exceeds depth ${MAX_SEMANTIC_TREE_DEPTH}`);
    const children = (node as { children?: unknown }).children;
    if (!Array.isArray(children)) continue;
    for (let index = children.length - 1; index >= 0; index--) stack.push({ node: children[index], depth: depth + 1 });
  }
}

/** Test-only visibility for the upstream cache-ceiling parity assertion. */
export function getProcessorCacheSizeForTests(): number {
  return processors.size;
}

/** Parse one complete semantic document, preserving every top-level node. */
export function parseSemanticDocument(
  markdown: string,
  options: SemanticParseOptions = {}
): Root {
  try {
    assertBoundedMarkdownSource(markdown);
    const processor = getProcessor(options);
    const literal = preprocessLiteralTagContent(markdown, options.literalTags ?? []);
    const prepared = preprocessCustomTags(literal, options.customTags ?? []);
    const tree = processor.parse(prepared);
    const root = processor.runSync(tree, prepared) as Root;
    assertBoundedSemanticTree(root);
    return root;
  } catch (error) {
    const parseError = error instanceof Error ? error : new Error(String(error));
    options.onError?.(parseError);
    console.warn('Remark parse error:', error);
    const preview = boundedFallback(markdown);
    const fallback: Root = preview
      ? {
          type: 'root',
          children: [{ type: 'paragraph', children: [{ type: 'text', value: preview }] }],
        }
      : { type: 'root', children: [] };
    parseErrors.set(fallback, parseError);
    return fallback;
  }
}

export function getSemanticParseError(root: Root): Error | undefined {
  return parseErrors.get(root);
}

export const parseMarkdown = parseSemanticDocument;

/** Return all block nodes rather than silently discarding siblings. */
export function parseBlockContents(content: string): Content[] {
  return content.trim() ? parseSemanticDocument(content).children : [];
}

/**
 * @deprecated Compatibility wrapper for older consumers. It intentionally
 * returns only the first node; new code should use parseSemanticDocument.
 */
export function parseBlockContent(content: string): Content | null {
  return parseBlockContents(content)[0] ?? null;
}

export function parseBlocks(markdown: string): Content[] {
  return parseSemanticDocument(markdown).children;
}

export function isValidMarkdown(markdown: string): boolean {
  try {
    assertBoundedMarkdownSource(markdown);
    getProcessor({}).parse(markdown);
    return true;
  } catch {
    return false;
  }
}

/** @deprecated Setext headings are valid CommonMark; input is no longer rewritten. */
export function escapeSetextUnderlines(markdown: string): string {
  return markdown;
}
