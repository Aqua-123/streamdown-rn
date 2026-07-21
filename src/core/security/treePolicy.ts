import type { Node, Parent, Root } from 'mdast';
import type { ResourcePolicy, ResourceSink } from './urlPolicy';
import { sanitizeResourceURL } from './urlPolicy';

type PolicyNode = Node & {
  children?: PolicyNode[];
  data?: { hName?: unknown };
  depth?: number;
  ordered?: boolean;
  url?: string;
  value?: string;
};

type PolicyParent = PolicyNode & { children: PolicyNode[] };

export type SemanticElementPredicate = (
  node: Readonly<Node>,
  index: number,
  parent: Readonly<Parent>
) => boolean | null | undefined;

export interface SecurityPolicyOptions extends ResourcePolicy {
  allowedElements?: readonly string[];
  disallowedElements?: readonly string[];
  allowElement?: SemanticElementPredicate;
  unwrapDisallowed?: boolean;
  skipHtml?: boolean;
  urlTransform?: (
    url: string,
    sink: ResourceSink,
    node: Readonly<Node>
  ) => string | null | undefined;
}

function elementName(node: PolicyNode, semanticElement?: string): string | null {
  const dataName = node.data?.hName;
  if (typeof dataName === 'string') return dataName;
  if (semanticElement) return semanticElement;
  switch (node.type) {
    case 'blockquote': return 'blockquote';
    case 'break': return 'br';
    case 'code': return 'pre';
    case 'delete': return 'del';
    case 'emphasis': return 'em';
    case 'footnoteReference': return 'sup';
    case 'heading': return `h${node.depth}`;
    case 'image':
    case 'imageReference': return 'img';
    case 'inlineCode': return 'code';
    case 'link':
    case 'linkReference': return 'a';
    case 'list': return node.ordered ? 'ol' : 'ul';
    case 'listItem': return 'li';
    case 'paragraph': return 'p';
    case 'strong': return 'strong';
    case 'table': return 'table';
    case 'tableCell': return 'td';
    case 'tableRow': return 'tr';
    case 'thematicBreak': return 'hr';
    default: return null;
  }
}

function sanitizeNodeURL(node: PolicyNode, options: SecurityPolicyOptions): PolicyNode {
  if (node.type !== 'link' && node.type !== 'image' && node.type !== 'definition') return node;
  const sink: ResourceSink = node.type === 'image' ? 'image' : 'link';
  const url = node.url ?? '';
  const transformed = options.urlTransform?.(url, sink, node) ??
    (options.urlTransform ? null : url);
  const safe = transformed == null ? null : sanitizeResourceURL(transformed, sink, options);
  return { ...node, url: safe ?? undefined } as PolicyNode;
}

function filterChildren(
  parent: PolicyParent,
  options: SecurityPolicyOptions,
  childSemanticElement?: string
): PolicyParent {
  const children: PolicyNode[] = [];
  parent.children.forEach((original, index) => {
    if (original.type === 'html') {
      if (!options.skipHtml) children.push({ type: 'text', value: original.value } as PolicyNode);
      return;
    }

    let node = sanitizeNodeURL(original, options);
    if ('children' in node && Array.isArray(node.children)) {
      const tableCellElement = node.type === 'tableRow' && parent.type === 'table'
        ? (index === 0 ? 'th' : 'td')
        : undefined;
      node = filterChildren(node as PolicyParent, options, tableCellElement);
    }

    const name = elementName(node, childSemanticElement);
    const disallowed = name !== null && (
      (options.allowedElements ? !options.allowedElements.includes(name) : false) ||
      (options.disallowedElements?.includes(name) ?? false) ||
      (options.allowElement ? !options.allowElement(node, index, parent as unknown as Parent) : false)
    );
    if (!disallowed) {
      children.push(node);
    } else if (options.unwrapDisallowed && 'children' in node && Array.isArray(node.children)) {
      children.push(...node.children);
    }
  });
  return { ...parent, children };
}

/** Clone, filter, and sanitize a parsed document before any renderer sees it. */
export function applySecurityPolicy(
  root: Root,
  options: SecurityPolicyOptions = {}
): Root {
  if (options.allowedElements && options.disallowedElements) {
    throw new TypeError('allowedElements and disallowedElements are mutually exclusive');
  }
  return filterChildren(root as unknown as PolicyParent, options) as unknown as Root;
}
