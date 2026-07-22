import { partitionMarkdown } from '../../../../src/core/blockSemantics';
import { parseSemanticDocument } from '../../../../src/core/parser';
import { math } from '../../../../src/plugins/math';
import { renderedText } from './native-cluster-helpers';

describe('dollar sign and math boundaries', () => {
  it.each([/* parity:51b32d9f1bd474bc7086411d04288c0154aa7018a6335b3809c14875b9ff1b05 */ ['$20 is a sum', '$20 is a sum'], /* parity:4e8bc417447f102a428ee6ec1c75086de012b4bd4c2a622150d7a3234a7ebc00 */ ['The price is $50 and discount $10', 'The price is $50 and discount $10'], /* parity:22f036f4f33e44b88b8f4a6f399caedab9631f0f08c772e66a5cabaf58060ad9 */ ['The cost is $', 'The cost is $'], /* parity:57f0316aa576c3754c36346ae0d3d8d2671c20e028bf787266281a481763e9d6 */ ['Use $variable', 'Use $variable'], /* parity:a5d9b56c86069b53dee1ad6bb9b089727c4f3bdb32955bec8fd07c3945c458aa */ ['This $x = y$ stays text', 'This $x = y$ stays text']])('preserves currency/text: %s', (content, expected) => {
    expect(renderedText(content, { plugins: { math } })).toContain(expected);
    expect(JSON.stringify(parseSemanticDocument(content, { math: math.remarkPlugin }))).not.toContain('inlineMath');
  });

  // parity:c7fe1a31500358792762638276b01a40bbc3967429e3d00aef892e901d3b78da
  it('parses double-dollar math while preserving adjacent currency', () => {
    const markdown = 'The price is $99.99 and $$x^2 + y^2 = z^2$$';
    const tree = parseSemanticDocument(markdown, { math: math.remarkPlugin });
    expect(JSON.stringify(tree)).toContain('"type":"inlineMath"');
    expect(renderedText(markdown, { plugins: { math } })).toContain('$99.99');
  });
  // parity:cb768d25b71092de57a3113f75e180d5a5fd665cb98ad4e5a20760884f6cb738
  it('preserves a dollar sign followed by non-numeric characters as text', () => {
    const markdown = 'Use $variable in this sentence';
    expect(renderedText(markdown, { plugins: { math } })).toContain(markdown);
    expect(JSON.stringify(parseSemanticDocument(markdown, { math: math.remarkPlugin }))).not.toContain('inlineMath');
  });

  // parity:1101a0cfc88151efecb8bfd0300d9eed08831d349e40bd1497af0889720dc18b
  it('does not split dollar signs inside code and keeps math blocks intact', () => {
    const markdown = '```bash\npstree -p $$\necho $$\n```\n\n$$\nx = y + z\n$$\n\nMore.';
    const blocks = partitionMarkdown(markdown);
    expect(blocks.find((block) => block.includes('pstree -p $$'))).toBeTruthy();
    expect(blocks.find((block) => block.includes('x = y + z'))?.match(/\$\$/g)).toHaveLength(2);
  });

  it('does not treat double dollar signs inside code blocks as math delimiters', () => {
    const blocks = partitionMarkdown('```bash\necho $$\n```');
    expect(blocks).toEqual(['```bash\necho $$\n```']);
  });

  // parity:29db1cc8e2bc684e1c0a5df7c4b02eff46163f408bf78234417cf7a768126d5f
  it('still merges a complete math block after ordinary text', () => {
    const blocks = partitionMarkdown('Before\n\n$$\nx = y\n$$\n\nAfter');
    expect(blocks.some((block) => block.includes('$$\nx = y\n$$'))).toBe(true);
  });

  // parity:7a12ed5d9504a761d420f2fc81f34872618b1bff537d8df90bead10100b9bbc9
  it('keeps a code block separate from the following math block', () => {
    const blocks = partitionMarkdown('```bash\necho $$\n```\n\n$$\nx = y\n$$');
    expect(blocks.find((block) => block.startsWith('```bash'))).toContain('echo $$');
    expect(blocks.find((block) => block.includes('x = y'))).toContain('$$');
  });
});

/* pinned parity markers
 *  — Dollar sign handling > should handle text with dollar sign followed by non-numeric characters
 *  — Dollar sign handling > should still render block math with double dollar signs
 *  — Dollar sign in code blocks (parseMarkdownIntoBlocks) > should not treat $$ inside code blocks as math delimiters
 *  — Dollar sign in code blocks (parseMarkdownIntoBlocks) > should still merge math blocks correctly
 *  — Dollar sign in code blocks (parseMarkdownIntoBlocks) > should handle code block followed by math block
 */
