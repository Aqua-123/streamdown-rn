import { parseSemanticDocument } from '../core/parser';
import { processNewContent, resetRegistry } from '../core/splitter';
import type { BlockRegistry } from '../core/types';

function stream(source: string, cuts: number[]): BlockRegistry {
  let registry = resetRegistry();
  for (const cut of cuts) registry = processNewContent(registry, source.slice(0, cut));
  return processNewContent(registry, source);
}

function semanticTypes(source: string): string[] {
  return parseSemanticDocument(source).children.map((node) => node.type);
}

function registryShape(registry: BlockRegistry) {
  return {
    blocks: registry.blocks.map(({ type, content, startPos, endPos }) => ({ type, content, startPos, endPos })),
    activeBlock: registry.activeBlock,
    cursor: registry.cursor,
    blockCounter: registry.blockCounter,
  };
}

describe('stream source and semantic invariance', () => {
  const documents = [
    '',
    'one\n\ntwo',
    '```ts\nconst x = 1;\n```\n\nafter',
    '| a | b |\n| --- | --- |\n| 1 | 2 |',
    '$$\nx = 1\n$$\n\nafter',
    'Text[^n]\n\n[^n]: Note',
    '<box><box>A\n\nB</box></box>\n\nafter',
    'before\n\n\n\nafter',
  ];

  it.each(documents)('is chunk-invariant for %p', (source) => {
    const everyCharacter = Array.from({ length: source.length }, (_, index) => index + 1);
    const chunked = stream(source, everyCharacter.filter((cut) => cut % 3 === 0));
    const single = stream(source, []);
    expect(chunked.source).toBe(source);
    expect(single.source).toBe(source);
    expect(semanticTypes(chunked.source ?? '')).toEqual(semanticTypes(single.source ?? ''));
  });

  it('keeps exact splitter state across character, token, line, and whole chunks', () => {
    const source = [
      '# Heading',
      '',
      '```ts',
      'const value = 1;',
      '```',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '[{c:"Card",p:{"title":"A }] value"}}]',
      '',
      'tail\r\nwith CRLF',
    ].join('\n');
    const characters = Array.from({ length: source.length }, (_, index) => index + 1);
    const tokens = characters.filter((cut) => cut % 7 === 0);
    const lines = characters.filter((cut) => source[cut - 1] === '\n');
    const expected = registryShape(stream(source, []));

    for (const cuts of [characters, tokens, lines]) {
      expect(registryShape(stream(source, cuts))).toEqual(expected);
    }
  });

  it('ingests a whole 64 KiB paragraph in one range', () => {
    const source = 'a'.repeat(64 * 1024);
    const registry = processNewContent(resetRegistry(), source);
    expect(registry.cursor).toBe(source.length);
    expect(registry.activeBlock).toMatchObject({ type: 'paragraph', content: source, startPos: 0 });
  });

  it('keeps empty appends as identity and resets on shorter/equal/longer replacement', () => {
    const initial = processNewContent(resetRegistry(), '# First\n\nbody');
    expect(processNewContent(initial, '# First\n\nbody')).toBe(initial);

    for (const replacement of ['', 'replacement', 'a longer replacement document']) {
      const reset = processNewContent(initial, replacement);
      expect(reset.source).toBe(replacement);
      expect(semanticTypes(reset.source ?? '')).toEqual(semanticTypes(replacement));
    }
  });

  it('does not replace finalized block objects during a genuine append', () => {
    const before = processNewContent(resetRegistry(), '# Stable\n\nactive');
    const stable = before.blocks[0];
    const after = processNewContent(before, '# Stable\n\nactive grows');
    expect(after.blocks[0]).toBe(stable);
  });

  it('does not leak incomplete-tag state across an equal-length block boundary', () => {
    const before = processNewContent(resetRegistry(), '**open\n\n');
    const after = processNewContent(before, '**open\n\nplain!');
    expect(after.activeBlock?.content).toBe('plain!');
    expect(after.activeTagState.stack).toEqual([]);
  });

  it('changes incomplete constructs to their completed semantic form', () => {
    const incomplete = processNewContent(resetRegistry(), '```ts\nconst x = 1');
    const complete = processNewContent(incomplete, '```ts\nconst x = 1\n```');
    expect(incomplete.activeBlock?.type).toBe('codeBlock');
    expect(complete.blocks[0]).toMatchObject({ type: 'codeBlock' });
  });

  it.each(['1. ordered', '- item', '- unordered'])('finalizes a completed %s root before the following paragraph', (list) => {
    const registry = processNewContent(resetRegistry(), `${list}\n\nactive`);
    expect(registry.blocks[0]).toMatchObject({ type: 'list', content: list });
    expect(registry.activeBlock?.content).toBe('active');
  });

  it('keeps a loose-list continuation in one active root', () => {
    const source = '- first paragraph\n\n  second paragraph';
    const registry = processNewContent(resetRegistry(), source);
    expect(registry.blocks).toHaveLength(0);
    expect(registry.activeBlock?.content).toBe(source);
  });

  it('retains only open document-wide constructs and finalizes them on closure', () => {
    const emptyFootnote = processNewContent(resetRegistry(), 'Text[^n]\n\n[^n]:');
    expect(emptyFootnote.blocks).toHaveLength(0);
    expect(emptyFootnote.activeBlock?.content).toBe('Text[^n]\n\n[^n]:');

    const completeFootnote = processNewContent(emptyFootnote, 'Text[^n]\n\n[^n]: note\n\nactive');
    expect(completeFootnote.blocks[0]?.content).toBe('Text[^n]\n\n[^n]: note');
    expect(completeFootnote.activeBlock?.content).toBe('active');

    const customTag = processNewContent(resetRegistry(), '<box>first\n\nsecond</box>');
    expect(customTag.blocks[0]?.content).toBe('<box>first\n\nsecond</box>');
    expect(customTag.activeBlock).toBeNull();
  });
});
