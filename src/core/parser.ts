import type { Content, Root } from 'mdast';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import type { Pluggable, PluggableList } from 'unified';
import {
  preprocessCustomTags,
  preprocessLiteralTagContent,
} from './preprocessTags';

export interface SemanticPluginOrder {
  before?: PluggableList;
  defaults?: PluggableList;
  after?: PluggableList;
  math?: Pluggable;
}

export interface SemanticParseOptions extends SemanticPluginOrder {
  customTags?: readonly string[];
  literalTags?: readonly string[];
}

const DEFAULT_PLUGINS: PluggableList = [remarkGfm];
const pluginIds = new WeakMap<object, number>();
const processors = new Map<string, ReturnType<typeof remark>>();
let nextPluginId = 1;

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
  processors.set(key, processor);
  return processor;
}

/** Parse one complete semantic document, preserving every top-level node. */
export function parseSemanticDocument(
  markdown: string,
  options: SemanticParseOptions = {}
): Root {
  try {
    const processor = getProcessor(options);
    const literal = preprocessLiteralTagContent(markdown, options.literalTags ?? []);
    const prepared = preprocessCustomTags(literal, options.customTags ?? []);
    const tree = processor.parse(prepared);
    return processor.runSync(tree, prepared) as Root;
  } catch (error) {
    console.warn('Remark parse error:', error);
    return { type: 'root', children: [] };
  }
}

export const parseMarkdown = parseSemanticDocument;

/** Return all block nodes rather than silently discarding siblings. */
export function parseBlockContents(content: string): Content[] {
  return content.trim() ? parseSemanticDocument(content).children : [];
}

/**
 * @deprecated Compatibility wrapper for the pre-parity renderer. It returns only
 * the first node. U5 must migrate renderers to parseSemanticDocument.
 */
export function parseBlockContent(content: string): Content | null {
  return parseBlockContents(content)[0] ?? null;
}

export function parseBlocks(markdown: string): Content[] {
  return parseSemanticDocument(markdown).children;
}

export function isValidMarkdown(markdown: string): boolean {
  try {
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
