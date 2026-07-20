import type { Root } from 'mdast';
import { sanitizeProps } from '../core/sanitize';
import type { ResourcePolicy } from '../core/security';

type SemanticNode = {
  type: string;
  value?: string;
  children?: SemanticNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown>; literal?: boolean };
};

const OPEN_TAG = /^<([A-Za-z][\w.-]*)([^>]*)\/?\s*>$/;
const CLOSE_TAG = /^<\/([A-Za-z][\w.-]*)\s*>$/;
const ATTRIBUTE = /([:\w.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const HTML_TOKEN = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g;

function declaredTag(
  tag: string,
  allowedTags: Readonly<Record<string, readonly string[]>>
): string | undefined {
  const normalized = tag.toLowerCase();
  return Object.keys(allowedTags).find((candidate) => candidate.toLowerCase() === normalized);
}

function expandHtmlNodes(
  source: SemanticNode[],
  allowedTags: Readonly<Record<string, readonly string[]>>
): SemanticNode[] {
  return source.flatMap((node) => {
    if (node.type !== 'html' || !node.value || !HTML_TOKEN.test(node.value)) {
      HTML_TOKEN.lastIndex = 0;
      return [node];
    }
    HTML_TOKEN.lastIndex = 0;
    const tokens: SemanticNode[] = [];
    let from = 0;
    for (const match of node.value.matchAll(HTML_TOKEN)) {
      const at = match.index;
      const text = node.value.slice(from, at);
      if (text.trim()) tokens.push({ type: 'text', value: text });
      tokens.push({ type: 'html', value: match[0] });
      from = at + match[0].length;
    }
    const trailing = node.value.slice(from);
    if (trailing.trim()) tokens.push({ type: 'text', value: trailing });
    return tokens.some((token) => {
      const value = token.type === 'html' ? token.value?.trim() : undefined;
      const match = value ? OPEN_TAG.exec(value) ?? CLOSE_TAG.exec(value) : null;
      return match ? Boolean(declaredTag(match[1], allowedTags)) : false;
    }) ? tokens : [node];
  });
}

function attributes(
  source: string,
  allowed: readonly string[],
  policy: ResourcePolicy
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE.exec(source))) {
    if (allowed.includes(match[1])) result[match[1]] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return sanitizeProps(result, policy);
}

function transformChildren(
  source: SemanticNode[],
  allowedTags: Readonly<Record<string, readonly string[]>>,
  literalTags: readonly string[],
  policy: ResourcePolicy
): SemanticNode[] {
  source = expandHtmlNodes(source, allowedTags);
  const result: SemanticNode[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const original = source[index];
    const node = original.children
      ? { ...original, children: transformChildren(original.children, allowedTags, literalTags, policy) }
      : original;
    const open = node.type === 'html' && node.value ? OPEN_TAG.exec(node.value.trim()) : null;
    const sourceTag = open?.[1];
    const tag = sourceTag ? declaredTag(sourceTag, allowedTags) : undefined;
    if (!open || !tag) {
      result.push(node);
      continue;
    }

    const selfClosing = /\/\s*>$/.test(node.value ?? '');
    let end = index;
    if (!selfClosing) {
      let depth = 1;
      for (let candidate = index + 1; candidate < source.length; candidate += 1) {
        const value = source[candidate].type === 'html' ? source[candidate].value?.trim() : undefined;
        const candidateOpen = value ? OPEN_TAG.exec(value)?.[1] : undefined;
        const candidateClose = value ? CLOSE_TAG.exec(value)?.[1] : undefined;
        if (candidateOpen && value && declaredTag(candidateOpen, allowedTags) === tag && !/\/\s*>$/.test(value)) depth += 1;
        if (candidateClose && declaredTag(candidateClose, allowedTags) === tag) depth -= 1;
        if (depth === 0) { end = candidate; break; }
      }
    }
    const inner = end > index
      ? transformChildren(source.slice(index + 1, end), allowedTags, literalTags, policy)
        .filter((child) => !(child.type === 'html' && child.value?.trim() === '<!---->'))
      : [];
    result.push({
      type: 'customTag',
      children: inner,
      data: {
        hName: tag,
        hProperties: attributes(open[2], allowedTags[tag], policy),
        literal: literalTags.some((literalTag) => literalTag.toLowerCase() === tag.toLowerCase()),
      },
    });
    index = end;
  }
  return result;
}

/** Convert only explicitly declared inert HTML tags into native semantic nodes. */
export function materializeCustomTags(
  root: Root,
  allowedTags: Readonly<Record<string, readonly string[]>> = {},
  literalTags: readonly string[] = [],
  policy: ResourcePolicy = {}
): Root {
  if (Object.keys(allowedTags).length === 0) return root;
  return {
    ...root,
    children: transformChildren(
      root.children as unknown as SemanticNode[],
      allowedTags,
      literalTags,
      policy
    ) as Root['children'],
  };
}
