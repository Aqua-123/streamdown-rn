import { renderedText } from './native-cluster-helpers';

describe('literal custom tag content', () => {
  // parity:dc78b68fe35251b88fe92b45666288322a33babfad29e64b9dc4eebd374d3f03
  it('returns ordinary markdown unchanged when no literal tags are declared', () => {
    expect(renderedText('**bold**')).toBe('bold');
  });

  // parity:3b26e953b937d0c2c64ac3f75ae002af375fcde414d06797bb15e724e881f8f6
  it('flattens matched tag children to literal text, including empty comments and mixed content', () => {
    const props = { allowedTags: { mention: [] }, literalTagContent: ['mention'] };
    expect(renderedText('<mention>**bold** and `code`</mention>', props)).toBe('**bold** and `code`');
    expect(renderedText('<mention><!----></mention>', props)).not.toContain('<!---->');
    expect(renderedText('<mention>before<!---->after</mention>', props)).toContain('beforeafter');
  });

  // parity:cb3d0ef2ef3cf0e9f21ef06b01979b37594c7921f0e5651f6d3971df777c0a76
  it('matches declared tag names case-insensitively', () => {
    expect(renderedText('<MENTION>**literal**</MENTION>', {
      allowedTags: { mention: [] },
      literalTagContent: ['mention'],
    })).toContain('**literal**');
  });

  // parity:12551da6f40ef3901b1436a828d06a679f6fbc3513db35aa9004b44cc02d4a77
  it('removes comment nodes inside a matched literal element', () => {
    expect(renderedText('<mention><!----></mention>', {
      allowedTags: { mention: [] }, literalTagContent: ['mention'],
    })).not.toContain('<!---->');
  });

  // parity:f37cfc1e2326c832a93ea896a95cb3a65467f63c329c2d71b01f1d1f1c32ff17
  it('joins mixed text around comments inside a matched literal element', () => {
    expect(renderedText('<mention>before<!---->after</mention>', {
      allowedTags: { mention: [] }, literalTagContent: ['mention'],
    })).toContain('beforeafter');
  });
});

/* pinned parity markers
 *  — rehypeLiteralTagContent > returns early when tagNames is empty
 *  — rehypeLiteralTagContent > replaces children of matched elements with plain text
 *  — rehypeLiteralTagContent > handles comment nodes inside matched elements (returns empty string)
 *  — rehypeLiteralTagContent > handles mixed text and comment nodes
 *  — rehypeLiteralTagContent > is case-insensitive for tag matching
 */
