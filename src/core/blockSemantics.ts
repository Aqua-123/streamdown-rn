import { parseSemanticDocument } from './parser';

const FOOTNOTE_REFERENCE = /\[\^[\w-]{1,200}\](?!:)/;
const FOOTNOTE_DEFINITION = /\[\^[\w-]{1,200}\]:/;
const CODE_FENCE = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/;
const TABLE_DELIMITER =
  /^\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?$/;

export function hasIncompleteCodeFence(markdown: string): boolean {
  let character: string | undefined;
  let length = 0;
  for (const line of markdown.split('\n')) {
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
  return markdown.split('\n').some((line) => {
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
