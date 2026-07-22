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
    '`````\nx\n````\ny\n`````',
    '```\na\n````\nnext',
    '   ```ts\ncode\n   ```\n\nafter',
    'before\n\n\n\nafter',
    'one\r\n\r\ntwo',
    'a\n\r\r\n#\r',
    '+ .',
    '***<>',
    ' - a\r',
    '# Heading\r\nafter',
    '```ts\r\ncode\r\n```\r\nafter',
    '- item\r\n\r\nafter',
    '> quote\r\n\r\nafter',
    '[{c:"Card",p:{}}]\r\nafter',
    '# Heading\rafter',
    '```ts\rcode\r```\rafter',
    '- item\r\rafter',
    '> quote\r\rafter',
    '[{c:"Card",p:{}}]\rafter',
  ];

  it.each(documents)('is chunk-invariant for %p', (source) => {
    const everyCharacter = Array.from({ length: source.length }, (_, index) => index + 1);
    const chunked = stream(source, everyCharacter.filter((cut) => cut % 3 === 0));
    const single = stream(source, []);
    expect(chunked.source).toBe(source);
    expect(single.source).toBe(source);
    expect(registryShape(chunked)).toEqual(registryShape(single));
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

  it('keeps malformed carriage-return sequences invariant across a pending CR boundary', () => {
    const source = 'a\n\r\r\n#\r';
    expect(registryShape(stream(source, [3]))).toEqual(registryShape(stream(source, [])));
  });

  it.each(['+ .', '***<>', ' - a\r'])('keeps ambiguous prefix %p character-invariant', (source) => {
    const characters = Array.from({ length: source.length }, (_, index) => index + 1);
    expect(registryShape(stream(source, characters))).toEqual(registryShape(stream(source, [])));
  });

  it.each([
    '`````\nx\n````\ny\n`````',
    '```\na\n````\nnext',
    '   ```ts\ncode\n   ```\n\nafter',
  ])('keeps fenced-code state chunk-invariant for %p', (source) => {
    const characters = Array.from({ length: source.length }, (_, index) => index + 1);
    expect(registryShape(stream(source, characters))).toEqual(registryShape(stream(source, [])));
  });

  it.each([
    '# Heading\rafter',
    '```ts\rcode\r```\rafter',
    '- item\r\rafter',
    '> quote\r\rafter',
    '[{c:"Card",p:{}}]\rafter',
  ])('keeps CR-only CommonMark blocks character-invariant for %p', (source) => {
    const characters = Array.from({ length: source.length }, (_, index) => index + 1);
    expect(registryShape(stream(source, characters))).toEqual(registryShape(stream(source, [])));
    expect(registryShape(stream(source, [])).cursor).toBe(source.length);
  });

  it.each([
    '######x\nnext',
    '```bad`info\ncode\n```\nnext',
    '\t```ts\ncode\n```\nnext',
    '[{c:"Card",p:{}}]\nnext',
    '[{c:"Card",p:{"x":"}]"}}]tail',
  ])('keeps disproven or explicit prefixes chunk-invariant for %p', (source) => {
    const characters = Array.from({ length: source.length }, (_, index) => index + 1);
    expect(registryShape(stream(source, characters))).toEqual(registryShape(stream(source, [])));
  });

  it.each([
    [' \n```ts\ncode\n```', 'codeBlock'],
    ['\t\n[{c:"Card",p:{}}]', 'component'],
  ])('ignores a whitespace-only line before %p', (source, type) => {
    const characters = Array.from({ length: source.length }, (_, index) => index + 1);
    for (const registry of [stream(source, []), stream(source, characters)]) {
      expect(registry.blocks[0]?.type ?? registry.activeBlock?.type).toBe(type);
      expect(registry.blocks[0]?.startPos ?? registry.activeBlock?.startPos).toBe(source.indexOf(type === 'codeBlock' ? '```' : '[{c:'));
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
    const previousBlocks = before.blocks;
    const stable = before.blocks[0];
    const after = processNewContent(before, '# Stable\n\nactive\n\nnext');
    expect(after.blocks[0]).toBe(stable);
    expect(before.blocks).toBe(previousBlocks);
    expect(before.blocks).toHaveLength(1);
    expect(after.blocks).toHaveLength(2);
  });

  it('stabilizes CRLF-delimited blocks like LF-delimited blocks', () => {
    const crlf = processNewContent(resetRegistry(), 'one\r\n\r\ntwo');
    expect(crlf.blocks[0]).toMatchObject({ type: 'paragraph', content: 'one' });
    expect(crlf.activeBlock?.content).toBe('two');
  });

  it.each([
    ['# Heading\r\nafter', 'heading'],
    ['```ts\r\ncode\r\n```\r\nafter', 'codeBlock'],
    ['- item\r\n\r\nafter', 'list'],
    ['> quote\r\n\r\nafter', 'blockquote'],
    ['[{c:"Card",p:{}}]\r\nafter', 'component'],
  ])('recognizes CRLF-delimited %s blocks', (source, type) => {
    const whole = processNewContent(resetRegistry(), source);
    const characters = Array.from({ length: source.length }, (_, index) => index + 1);
    const streamed = stream(source, characters);
    expect(whole.blocks[0]).toMatchObject({ type });
    expect(registryShape(streamed)).toEqual(registryShape(whole));
  });

  it.each([
    ['# Heading\rafter', 'heading'],
    ['```ts\rcode\r```\rafter', 'codeBlock'],
    ['- item\r\rafter', 'list'],
    ['> quote\r\rafter', 'blockquote'],
    ['[{c:"Card",p:{}}]\rafter', 'component'],
  ])('recognizes CR-only-delimited %s blocks', (source, type) => {
    const whole = processNewContent(resetRegistry(), source);
    const characters = Array.from({ length: source.length }, (_, index) => index + 1);
    expect(whole.blocks[0]).toMatchObject({ type });
    expect(registryShape(stream(source, characters))).toEqual(registryShape(whole));
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
    expect(completeFootnote.blocks).toHaveLength(0);
    expect(completeFootnote.activeBlock?.content).toBe('Text[^n]\n\n[^n]: note\n\nactive');

    const customTag = processNewContent(resetRegistry(), '<box>first\n\nsecond</box>');
    expect(customTag.blocks[0]?.content).toBe('<box>first\n\nsecond</box>');
    expect(customTag.activeBlock).toBeNull();
  });

  it.each(['[label]', '![label]'])('retains shortcut reference %s until its later definition arrives', (reference) => {
    const before = processNewContent(resetRegistry(), `${reference}\n\nnext`);
    expect(before.blocks).toHaveLength(0);

    const source = `${reference}\n\nnext\n\n[label]: https://example.com`;
    const after = processNewContent(before, source);
    expect(after.source).toBe(source);
    expect(parseSemanticDocument(source).children[0]?.type).toBe('paragraph');
    expect(JSON.stringify(parseSemanticDocument(source))).toContain('"referenceType":"shortcut"');
  });

  it.each([
    '[label]: https://example.com\n\n[label]',
    '[label]: https://example.com\n\n![label]',
    '[^note]: Definition\n\nText[^note]',
  ])('retains definition-first document semantics for %p', (source) => {
    const registry = stream(source, Array.from({ length: source.length }, (_, index) => index + 1));
    expect(registry.blocks).toHaveLength(0);
    expect(registry.activeBlock?.content).toBe(source);
    expect(JSON.stringify(parseSemanticDocument(registry.activeBlock!.content))).toMatch(/(?:Reference|footnoteReference)/);
  });

  it('reopens a closing fence when a later chunk extends its closing line', () => {
    for (const fence of ['```', '~~~']) {
      const closed = processNewContent(resetRegistry(), `${fence}js\ncode\n${fence}`);
      const source = `${fence}js\ncode\n${fence}x\nmore`;
      expect(registryShape(processNewContent(closed, source))).toEqual(registryShape(processNewContent(resetRegistry(), source)));
    }
  });
});
