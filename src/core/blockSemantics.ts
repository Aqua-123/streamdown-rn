import { parseSemanticDocument } from './parser';
import type { Nodes, Root } from 'mdast';

const FOOTNOTE_REFERENCE = /\[\^[\w-]{1,200}\](?!:)/;
const FOOTNOTE_DEFINITION = /\[\^[\w-]{1,200}\]:/;
const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const TABLE_DELIMITER =
  /^\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?$/;

export function hasIncompleteCodeFence(markdown: string): boolean {
  let character: string | undefined;
  let length = 0;
  for (const line of markdown.split(/\r\n|\r|\n/)) {
    const match = CODE_FENCE.exec(line);
    if (!match) continue;
    const run = match[1];
    const suffix = match[2];
    if (!character) {
      if (run[0] === '`' && suffix.includes('`')) continue;
      character = run[0];
      length = run.length;
    } else if (run[0] === character && run.length >= length && suffix.trim() === '') {
      character = undefined;
      length = 0;
    }
  }
  return character !== undefined;
}

export function hasTable(markdown: string): boolean {
  return markdown.split(/\r\n|\r|\n/).some((line) => {
    const value = line.trim();
    return value.includes('|') && TABLE_DELIMITER.test(value);
  });
}

/** Footnotes stay in one tree; other top-level nodes can be finalized independently. */
export function partitionMarkdown(markdown: string): string[] {
  if (!markdown) return [];
  if (FOOTNOTE_REFERENCE.test(markdown) || FOOTNOTE_DEFINITION.test(markdown)) {
    return [markdown];
  }
  const tree = parseSemanticDocument(markdown);
  return tree.children.map((node, index) => {
    const start = node.position?.start.offset ?? 0;
    const next = tree.children[index + 1]?.position?.start.offset ?? markdown.length;
    return markdown.slice(start, next);
  });
}

export interface MarkdownBoundary {
  partitions: string[];
  retain: boolean;
  closedHtml: boolean;
}

/** Parse only a candidate block boundary and say whether its trailing root is still open. */
export function analyzeMarkdownBoundary(markdown: string): MarkdownBoundary {
  const tree = parseSemanticDocument(markdown);
  const references = new Set<string>();
  const definitions = new Set<string>();
  let emptyFootnote = false;

  visit(tree, (node) => {
    if (node.type === 'linkReference' || node.type === 'imageReference' || node.type === 'footnoteReference') {
      references.add(node.identifier.toLowerCase());
    }
    if (node.type === 'definition' || node.type === 'footnoteDefinition') {
      definitions.add(node.identifier.toLowerCase());
      if (node.type === 'footnoteDefinition' && node.children.length === 0) emptyFootnote = true;
    }
    if (node.type === 'text') {
      for (const match of node.value.matchAll(/!?\[[^\]\n]*\]\[([^\]\n]+)\]/g)) {
        references.add(match[1].toLowerCase());
      }
      for (const match of node.value.matchAll(/!?\[([^\]\n]+)\](?![([])/g)) {
        if (!match[1].startsWith('^')) references.add(match[1].toLowerCase());
      }
      for (const match of node.value.matchAll(/\[\^([\w-]{1,200})\](?!:)/g)) {
        references.add(match[1].toLowerCase());
      }
    }
  });

  const html = htmlBalance(markdown);
  const unresolved = [...references].some((identifier) => !definitions.has(identifier));
  const documentWide = definitions.size > 0 || (references.size > 0 && [...references].every((identifier) => definitions.has(identifier)));
  const partitions = documentWide || html.spansBlankLine
    ? [markdown]
    : partitionsFromTree(markdown, tree);
  const trailing = tree.children[tree.children.length - 1];

  return {
    partitions,
    retain: definitions.size > 0 || unresolved || emptyFootnote || html.open || trailing?.type === 'list',
    closedHtml: html.spansBlankLine && !html.open,
  };
}

function partitionsFromTree(markdown: string, tree: Root): string[] {
  return tree.children.map((node, index) => {
    const start = node.position?.start.offset ?? 0;
    const next = tree.children[index + 1]?.position?.start.offset ?? markdown.length;
    return markdown.slice(start, next);
  });
}

function visit(node: Nodes, callback: (node: Nodes) => void): void {
  callback(node);
  if ('children' in node) node.children.forEach((child) => visit(child, callback));
}

function htmlBalance(markdown: string): { open: boolean; spansBlankLine: boolean } {
  const stack: string[] = [];
  let sawTag = false;
  for (const match of markdown.matchAll(/<\s*(\/?)\s*([a-z][\w-]*)(?=\s|\/?>)[^>]*>/gi)) {
    const [, closing, rawName] = match;
    const name = rawName.toLowerCase();
    if (/\/\s*>$/.test(match[0]) || ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(name)) continue;
    sawTag = true;
    if (!closing) stack.push(name);
    else if (stack[stack.length - 1] === name) stack.pop();
  }
  return { open: stack.length > 0, spansBlankLine: sawTag && /(?:\r\n|\r|\n){2}/.test(markdown) };
}

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LETTER = /\p{L}/u;

export function detectTextDirection(text: string): 'ltr' | 'rtl' {
  const stripped = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*{1,3}|_{1,3})/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[\s>*\-+\d.]+/gm, '');
  for (const character of stripped) {
    if (RTL.test(character)) return 'rtl';
    if (LETTER.test(character)) return 'ltr';
  }
  return 'ltr';
}
