import type { Emphasis, Link, Root, Strong, Text } from 'mdast';
import type { Pluggable, Plugin } from 'unified';
import type { Parent } from 'unist';

export interface CjkPlugin {
  name: 'cjk';
  type: 'cjk';
  remarkPlugins: Pluggable[];
  remarkPluginsBefore: Pluggable[];
  remarkPluginsAfter: Pluggable[];
}

const BOUNDARIES = new Set(Array.from('。．，、？！：；（）【】「」『』〈〉《》'));
const AUTOLINK_PREFIX = /^(https?:\/\/|mailto:|www\.)/i;
const CJK = '[\\u2e80-\\u2fff\\u3040-\\u30ff\\u31f0-\\u31ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]';
const CJK_EMPHASIS = new RegExp(
  `(^|${CJK})(\\*\\*\\*|___|\\*\\*|__|\\*|_)([^\\n]+?)\\2(?=${CJK}|$)`,
  'gu'
);
const CJK_DELETE = new RegExp(`(${CJK})~~([^\\n]+?)~~(${CJK})`, 'gu');

function walk(parent: Parent, visitor: (node: Parent['children'][number], index: number, parent: Parent) => void): void {
  for (let index = 0; index < parent.children.length; index++) {
    const child = parent.children[index];
    visitor(child, index, parent);
    const current = parent.children[index] as Parent['children'][number] & { children?: Parent['children'] };
    if (current.children) walk(current as Parent, visitor);
  }
}

/** Converts CJK-adjacent emphasis that CommonMark treats as intraword text. */
const remarkCjkEmphasis: Plugin<[], Root> = () => (tree) => {
  walk(tree, (node, index, parent) => {
    if (node.type !== 'text') return;
    const value = (node as Text).value;
    const children: Parent['children'] = [];
    let from = 0;
    for (const match of value.matchAll(CJK_EMPHASIS)) {
      const at = match.index;
      if (at > from) children.push({ type: 'text', value: value.slice(from, at) } as Text);
      if (match[1]) children.push({ type: 'text', value: match[1] } as Text);
      const content = [{ type: 'text', value: match[3] } as Text];
      let formatted: Strong | Emphasis;
      if (match[2].length === 3) {
        formatted = { type: 'strong', children: [{ type: 'emphasis', children: content }] };
      } else if (match[2].length === 2) {
        formatted = { type: 'strong', children: content };
      } else {
        formatted = { type: 'emphasis', children: content };
      }
      children.push(formatted);
      from = at + match[0].length;
    }
    if (!children.length) return;
    if (from < value.length) children.push({ type: 'text', value: value.slice(from) } as Text);
    parent.children.splice(index, 1, ...children);
  });
};

const remarkCjkStrikethrough: Plugin<[], Root> = () => (tree) => {
  walk(tree, (node, index, parent) => {
    if (node.type !== 'text') return;
    const value = (node as Text).value;
    const match = CJK_DELETE.exec(value);
    CJK_DELETE.lastIndex = 0;
    if (!match || match.index === undefined) return;
    const before = value.slice(0, match.index);
    const after = value.slice(match.index + match[0].length);
    parent.children.splice(index, 1,
      ...(
        before ? [{ type: 'text', value: before } as Text] : []
      ),
      { type: 'text', value: match[1] } as Text,
      { type: 'delete', children: [{ type: 'text', value: match[2] }] } as Parent['children'][number],
      { type: 'text', value: match[3] } as Text,
      ...(after ? [{ type: 'text', value: after } as Text] : [])
    );
  });
};

function boundaryIndex(value: string): number | null {
  let index = 0;
  for (const character of value) {
    if (BOUNDARIES.has(character)) return index;
    index += character.length;
  }
  return null;
}

const remarkCjkAutolinkBoundary: Plugin<[], Root> = () => (tree) => {
  walk(tree, (candidate, index, parent) => {
    if (candidate.type !== 'link') return;
    const node = candidate as Link;
    if (node.children.length !== 1) return;
    const child = node.children[0];
    if (child.type !== 'text' || child.value !== node.url || !AUTOLINK_PREFIX.test(node.url)) return;
    const boundary = boundaryIndex(node.url);
    if (boundary === null || boundary === 0) return;
    const url = node.url.slice(0, boundary);
    const trailing: Text = { type: 'text', value: node.url.slice(boundary) };
    parent.children.splice(index, 1, { ...node, url, children: [{ type: 'text', value: url }] } as Link, trailing);
  });
};

export function createCjkPlugin(): CjkPlugin {
  const remarkPluginsBefore: Pluggable[] = [remarkCjkEmphasis];
  const remarkPluginsAfter: Pluggable[] = [remarkCjkAutolinkBoundary, remarkCjkStrikethrough];
  return {
    name: 'cjk',
    type: 'cjk',
    remarkPluginsBefore,
    remarkPluginsAfter,
    remarkPlugins: [...remarkPluginsBefore, ...remarkPluginsAfter],
  };
}

export const cjk = createCjkPlugin();
