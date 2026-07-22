const MARKDOWN_ESCAPE_RE = /([\\`*_~[\]|])/g;

type Range = { start: number; end: number };

type TagNode = Range & {
  openEnd: number;
  closeStart: number;
  name: string;
  children: TagNode[];
  parent?: TagNode;
  matched?: boolean;
};

function findDeclaredTags(markdown: string, tagNames: readonly string[]): TagNode[] {
  const declared = new Set(tagNames.map((name) => name.toLowerCase()));
  const stack: TagNode[] = [];
  const matched: TagNode[] = [];

  for (let index = 0; index < markdown.length;) {
    const start = markdown.indexOf('<', index);
    if (start < 0) break;
    const end = markdown.indexOf('>', start + 1);
    if (end < 0) break;
    index = end + 1;

    if (markdown.startsWith('<!--', start)) {
      const commentEnd = markdown.indexOf('-->', start + 4);
      if (commentEnd < 0) break;
      index = commentEnd + 3;
      continue;
    }

    let cursor = start + 1;
    const closing = markdown[cursor] === '/';
    if (closing) cursor++;
    const nameStart = cursor;
    while (/[A-Za-z0-9:_-]/.test(markdown[cursor] ?? '')) cursor++;
    if (cursor === nameStart || !/[\s/>]/.test(markdown[cursor] ?? '')) continue;
    const name = markdown.slice(nameStart, cursor).toLowerCase();
    if (!declared.has(name)) continue;

    if (closing) {
      if (!/^\s*$/.test(markdown.slice(cursor, end))) continue;
      const node = stack[stack.length - 1];
      if (!node || node.name !== name) continue;
      stack.pop();
      node.closeStart = start;
      node.end = end + 1;
      node.matched = true;
      matched.push(node);
      continue;
    }
    if (/\/\s*$/.test(markdown.slice(cursor, end))) continue;
    const node: TagNode = {
      start,
      openEnd: end + 1,
      closeStart: markdown.length,
      end: markdown.length,
      name,
      children: [],
      parent: stack[stack.length - 1],
    };
    node.parent?.children.push(node);
    stack.push(node);
  }

  return matched.filter((node) => !node.parent?.matched);
}

function protectCode(markdown: string, unprotectedRanges: readonly Range[] = []): { markdown: string; restore: (value: string) => string } {
  let prefix = '\u0000streamdown-code-';
  while (markdown.includes(prefix)) prefix += '-';
  const protectedRanges: string[] = [];
  const token = (value: string) => {
    const index = protectedRanges.push(value) - 1;
    return `${prefix}${index}\u0000`;
  };

  let result = '';
  let index = 0;
  let lineStart = true;
  let rangeIndex = 0;
  const ranges = [...unprotectedRanges]
    .sort((left, right) => left.start - right.start)
    .reduce<Range[]>((merged, range) => {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
      else merged.push({ ...range });
      return merged;
    }, []);

  const isDeclaredLiteral = (offset: number) => {
    while (ranges[rangeIndex]?.end <= offset) rangeIndex++;
    const range = ranges[rangeIndex];
    return Boolean(range && range.start <= offset && offset < range.end);
  };

  while (index < markdown.length) {
    const isUnprotected = isDeclaredLiteral(index);
    if (markdown.startsWith('<!--', index)) {
      const close = markdown.indexOf('-->', index + 4);
      const end = close < 0 ? markdown.length : close + 3;
      result += token(markdown.slice(index, end));
      index = end;
      lineStart = markdown[index - 1] === '\n';
      continue;
    }
    if (lineStart && !isUnprotected) {
      const lineBreak = markdown.indexOf('\n', index);
      const lineEnd = lineBreak === -1 ? markdown.length : lineBreak + 1;
      const line = markdown.slice(index, lineEnd);

      // CommonMark indented code is literal too. Protect each physical line;
      // blank separator lines contain nothing for tag preprocessing to alter.
      if (/^(?: {4}|\t)/.test(line)) {
        result += token(line);
        index = lineEnd;
        lineStart = true;
        continue;
      }

      const opening = line.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)(?:\r?\n|$)/);
      if (opening) {
        const marker = opening[2][0];
        const minimumLength = opening[2].length;
        // Backticks are forbidden in the info string of a backtick fence.
        // Treat such a line as ordinary Markdown, matching the block parser.
        if (marker === '`' && opening[3].includes('`')) {
          result += opening[1] + opening[2];
          index += opening[1].length + opening[2].length;
          lineStart = false;
          continue;
        } else {
          let end = index + opening[0].length;
          while (end < markdown.length) {
            const closingBreak = markdown.indexOf('\n', end);
            const closingEnd = closingBreak === -1 ? markdown.length : closingBreak + 1;
            const candidate = markdown.slice(end, closingEnd);
            end = closingEnd;
            const closing = candidate.match(/^ {0,3}(`+|~+)[ \t]*(?:\r?\n|$)/);
            if (closing && closing[1][0] === marker && closing[1].length >= minimumLength) break;
          }
          result += token(markdown.slice(index, end));
          index = end;
          lineStart = true;
          continue;
        }
      }
    }

    if (!isUnprotected && markdown[index] === '`') {
      let runEnd = index + 1;
      while (markdown[runEnd] === '`') runEnd++;
      const delimiter = markdown.slice(index, runEnd);
      let close = markdown.indexOf(delimiter, runEnd);
      while (
        close !== -1
        && (markdown[close - 1] === '`' || markdown[close + delimiter.length] === '`')
      ) {
        close = markdown.indexOf(delimiter, close + delimiter.length);
      }
      if (close !== -1) {
        const end = close + delimiter.length;
        const code = markdown.slice(index, end);
        result += token(code);
        lineStart = code.endsWith('\n');
        index = end;
        continue;
      }
    }

    const character = markdown[index++];
    result += character;
    lineStart = character === '\n';
  }

  return {
    markdown: result,
    restore: (value) => value.replace(
      new RegExp(`${prefix}(\\d+)\\u0000`, 'g'),
      (_match, protectedIndex) => protectedRanges[Number(protectedIndex)]
    ),
  };
}

function outsideCode(markdown: string, transform: (value: string) => string, unprotectedRanges: readonly Range[] = []): string {
  const protectedMarkdown = protectCode(markdown, unprotectedRanges);
  return protectedMarkdown.restore(transform(protectedMarkdown.markdown));
}

function declaredTagContentRanges(markdown: string, tagNames: readonly string[]): Range[] {
  return findDeclaredTags(markdown, tagNames).map((node) => ({
    start: node.openEnd,
    end: node.closeStart,
  }));
}

function transformDeclaredTags(
  markdown: string,
  tagNames: readonly string[],
  transform: (content: string, hasChildren: boolean) => { content: string; suffix?: string }
): string {
  const roots = findDeclaredTags(markdown, tagNames);
  if (roots.length === 0) return markdown;
  let placeholderPrefix = '\u0001streamdown-tag-';
  while (markdown.includes(placeholderPrefix)) placeholderPrefix += '-';

  const render = (node: TagNode): string => {
    let content = '';
    let cursor = node.openEnd;
    const children: string[] = [];
    for (const child of node.children) {
      if (!child.matched) continue;
      const placeholder = `${placeholderPrefix}${children.length}\u0002`;
      children.push(render(child));
      content += markdown.slice(cursor, child.start) + placeholder;
      cursor = child.end;
    }
    content += markdown.slice(cursor, node.closeStart);
    const transformed = transform(content, children.length > 0);
    const restored = transformed.content.replace(
      new RegExp(`${placeholderPrefix}(\\d+)\\u0002`, 'g'),
      (_match, childIndex) => children[Number(childIndex)]
    );
    return markdown.slice(node.start, node.openEnd)
      + restored
      + markdown.slice(node.closeStart, node.end)
      + (transformed.suffix ?? '');
  };

  let result = '';
  let cursor = 0;
  for (const root of roots) {
    result += markdown.slice(cursor, root.start) + render(root);
    cursor = root.end;
  }
  return result + markdown.slice(cursor);
}

export function preprocessLiteralTagContent(
  markdown: string,
  tagNames: readonly string[]
): string {
  if (tagNames.length === 0) return markdown;
  return outsideCode(markdown, (protectedValue) => {
    return transformDeclaredTags(protectedValue, tagNames, (content) => ({
      content: content
        .replace(MARKDOWN_ESCAPE_RE, '\\$1')
        .replace(/\n\n/g, '&#10;&#10;'),
    }));
  }, declaredTagContentRanges(markdown, tagNames));
}

export function preprocessCustomTags(
  markdown: string,
  tagNames: readonly string[]
): string {
  if (tagNames.length === 0) return markdown;
  return outsideCode(markdown, (protectedValue) => {
    return transformDeclaredTags(protectedValue, tagNames, (content, hasChildren) => {
      if (!hasChildren && !content.includes('\n\n')) return { content };
      const fixed = content.replace(/\n\n/g, '\n<!---->\n');
      return {
        content: `${fixed.startsWith('\n') ? '' : '\n'}${fixed}${
          fixed.endsWith('\n') ? '' : '\n'
        }`,
        suffix: '\n\n',
      };
    });
  });
}
