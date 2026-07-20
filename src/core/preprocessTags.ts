const MARKDOWN_ESCAPE_RE = /([\\`*_~[\]|])/g;

function tagPattern(tagName: string): RegExp {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(<${escaped}(?=[\\s>/])[^>]*>)([\\s\\S]*?)(</${escaped}\\s*>)`,
    'gi'
  );
}

export function preprocessLiteralTagContent(
  markdown: string,
  tagNames: readonly string[]
): string {
  let result = markdown;
  for (const tagName of tagNames) {
    result = result.replace(tagPattern(tagName), (_match, open, content, close) => {
      const escaped = String(content)
        .replace(MARKDOWN_ESCAPE_RE, '\\$1')
        .replace(/\n\n/g, '&#10;&#10;');
      return `${open}${escaped}${close}`;
    });
  }
  return result;
}

export function preprocessCustomTags(
  markdown: string,
  tagNames: readonly string[]
): string {
  let result = markdown;
  for (const tagName of tagNames) {
    result = result.replace(tagPattern(tagName), (_match, open, content, close) => {
      const value = String(content);
      if (!value.includes('\n\n')) return `${open}${value}${close}`;
      const fixed = value.replace(/\n\n/g, '\n<!---->\n');
      const padded = `${fixed.startsWith('\n') ? '' : '\n'}${fixed}${
        fixed.endsWith('\n') ? '' : '\n'
      }`;
      return `${open}${padded}${close}\n\n`;
    });
  }
  return result;
}
