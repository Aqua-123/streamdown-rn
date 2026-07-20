import { partitionMarkdown } from '../../../../src/core/blockSemantics';
import { parseSemanticDocument } from '../../../../src/core/parser';
import { renderedText, semanticTypes } from './native-cluster-helpers';

describe('footnote semantics', () => {
  it('renders references and definitions with numeric, alpha, hyphen, and underscore identifiers', () => {
    for (const identifier of ['1', 'note1', 'my-note', 'my_note']) {
      const markdown = `Reference[^${identifier}].\n\n[^${identifier}]: Footnote ${identifier}.`;
      const types = semanticTypes(markdown);
      expect(types).toEqual(expect.arrayContaining(['footnoteReference', 'footnoteDefinition']));
      expect(renderedText(markdown)).toContain(`Footnote ${identifier}`);
      expect(partitionMarkdown(markdown)).toHaveLength(1);
    }
  });

  it('preserves multiple and multiline definitions alongside GFM tables and task lists', () => {
    const markdown = `| Feature | GFM |
|---|---|
| Tables | yes |

- [x] implemented

First[^1], second[^2].

[^1]: First note.
[^2]: Multi-line note.
    More detail.`;
    const tree = parseSemanticDocument(markdown);
    expect(semanticTypes(markdown).filter((type) => type === 'footnoteReference')).toHaveLength(2);
    expect(semanticTypes(markdown).filter((type) => type === 'footnoteDefinition')).toHaveLength(2);
    expect(JSON.stringify(tree)).toContain('table');
    expect(renderedText(markdown)).toContain('More detail');
  });

  it('keeps an empty streamed definition non-crashing and reveals arriving content', () => {
    const empty = renderedText('Text[^1].\n\n[^1]:', { mode: 'streaming' });
    expect(empty).not.toContain('[1]');
    expect(renderedText('Text[^1].\n\n[^1]: This is the content', { mode: 'streaming' })).toContain('This is the content');
  });

  it('does not mistake regex negated classes or table code for footnotes', () => {
    for (const markdown of [
      '# Regex\n\n```js\nconst a = /[^>]+/; const b = /[^)]/;\n```\n\nAfter.',
      '| Pattern | Meaning |\n|---|---|\n| `[^\\s]+` | token |\n\nAfter.',
    ]) expect(partitionMarkdown(markdown).length).toBeGreaterThan(1);
  });
});

/* pinned parity markers
 * parity:c1cbe105dee9eeeb26e1084862eede02602af63aee92e9fe58007e5e36761221 — Footnotes > should render footnote references and definitions correctly
 * parity:99e20fb02f8d3966cf229e02d76e9a9cde2edb553edfb34bf7dd32e728efbf4e — Footnotes > should handle multiple footnote references
 * parity:59def1ecd4f0035057f75772b8f1c1dfaea5ecd45abc5620d5e554351dbc6c68 — Footnotes > should handle footnotes with alphanumeric labels
 * parity:fa6592b7094972e39e97e2f87a72d8e67537cdc0d37391381baf4043ce4a5220 — Footnotes > should render complex markdown with tables and footnotes
 * parity:1d5246db684fdb52dab652d3013ab2328298905ef693fa7cb1bfc49a96b53d2f — Footnotes > should filter out empty footnotes during streaming
 * parity:5c709a6768420d49508181b773e52e18d48313d27953020835b0226b5d328398 — Footnotes > should show footnotes once content arrives
 * parity:e5275589160f44dfd3b7d43a0582f3ab7a61713d65d7ed16c3ec5818125b9e0e — Footnote detection (parseMarkdownIntoBlocks) > should not treat regex negated character classes as footnotes
 * parity:83e7dd88456a5dc7ce679a445896353d7fa3e12850315f847ac2938399c2d048 — Footnote detection (parseMarkdownIntoBlocks) > should not match [^>] or similar short patterns as footnotes
 * parity:e6db0912826ee97b5a5447c6532986e3dcd96cbbd41b259f7800bbeb870a7291 — Footnote detection (parseMarkdownIntoBlocks) > should still detect real footnotes with numeric identifiers
 * parity:d74df2cd77f585d36ccd297ce09033a65d44347e5b9009b3c8f6d3891ec97e9e — Footnote detection (parseMarkdownIntoBlocks) > should still detect real footnotes with alphanumeric identifiers
 * parity:c73f88c43382c371c21c768bb642eda809015ae8c2c0d4edaaddb473a0a4a030 — Footnote detection (parseMarkdownIntoBlocks) > should still detect real footnotes with hyphenated identifiers
 * parity:d2663844eafa381f6371ced4f7f95c00b0686228b32665a0887f7c4ac4852d25 — Footnote detection (parseMarkdownIntoBlocks) > should still detect real footnotes with underscored identifiers
 * parity:3a77da7b3ce1a49cf3ca6e3e0a862b55eb44c1a600f65ad8dfa604b8fbf73665 — Footnote detection (parseMarkdownIntoBlocks) > should handle markdown with tables containing inline code with special chars
 */
