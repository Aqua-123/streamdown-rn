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
});
