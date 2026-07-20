import { renderedText } from './native-cluster-helpers';

describe('literal custom tag content', () => {
  it('returns ordinary markdown unchanged when no literal tags are declared', () => {
    expect(renderedText('**bold**')).toBe('bold');
  });

  it('flattens matched tag children to literal text, including empty comments and mixed content', () => {
    const props = { allowedTags: { mention: [] }, literalTagContent: ['mention'] };
    expect(renderedText('<mention>**bold** and `code`</mention>', props)).toBe('**bold** and `code`');
    expect(renderedText('<mention><!----></mention>', props)).not.toContain('<!---->');
    expect(renderedText('<mention>before<!---->after</mention>', props)).toContain('beforeafter');
  });

  it('matches declared tag names case-insensitively', () => {
    expect(renderedText('<MENTION>**literal**</MENTION>', {
      allowedTags: { mention: [] },
      literalTagContent: ['mention'],
    })).toContain('**literal**');
  });
});

/* pinned parity markers
 * parity:dc78b68fe35251b88fe92b45666288322a33babfad29e64b9dc4eebd374d3f03 — rehypeLiteralTagContent > returns early when tagNames is empty
 * parity:3b26e953b937d0c2c64ac3f75ae002af375fcde414d06797bb15e724e881f8f6 — rehypeLiteralTagContent > replaces children of matched elements with plain text
 * parity:12551da6f40ef3901b1436a828d06a679f6fbc3513db35aa9004b44cc02d4a77 — rehypeLiteralTagContent > handles comment nodes inside matched elements (returns empty string)
 * parity:f37cfc1e2326c832a93ea896a95cb3a65467f63c329c2d71b01f1d1f1c32ff17 — rehypeLiteralTagContent > handles mixed text and comment nodes
 * parity:cb3d0ef2ef3cf0e9f21ef06b01979b37594c7921f0e5651f6d3971df777c0a76 — rehypeLiteralTagContent > is case-insensitive for tag matching
 */
