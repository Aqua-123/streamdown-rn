import type { Root } from 'mdast';
import {
  escapeSetextUnderlines,
  mergeRemarkPlugins,
  parseBlockContent,
  parseBlockContents,
  parseMarkdown,
  parseSemanticDocument,
} from '../core/parser';

describe('portable semantic parser', () => {
  it('parses CommonMark setext headings without rewriting input', () => {
    const source = 'Heading\n=======';
    expect(escapeSetextUnderlines(source)).toBe(source);
    expect(parseMarkdown(source).children[0]).toMatchObject({ type: 'heading', depth: 1 });
  });

  it('preserves empty and multiple top-level nodes', () => {
    expect(parseBlockContents('')).toEqual([]);
    expect(parseBlockContents('# One\n\nTwo\n\n- three').map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'list',
    ]);
  });

  it('keeps the old single-node helper explicitly compatibility-only', () => {
    expect(parseBlockContent('# One\n\nTwo')?.type).toBe('heading');
  });

  it('parses GFM tables, tasks, autolinks, strikethrough, and footnotes', () => {
    const tree = parseSemanticDocument(
      '- [x] done\n\n| a | b |\n| :- | -: |\n| 1 | 2 |\n\n~~gone~~ <https://example.com>[^n]\n\n[^n]: note'
    );
    expect(tree.children.map((node) => node.type)).toEqual([
      'list',
      'table',
      'paragraph',
      'footnoteDefinition',
    ]);
    expect((tree.children[0] as { children: Array<{ checked?: boolean }> }).children[0].checked).toBe(true);
  });

  it('runs plugins in before/default/after/math order', () => {
    const calls: string[] = [];
    const plugin = (label: string) => () => (tree: Root) => {
      calls.push(label);
      return tree;
    };
    parseSemanticDocument('text', {
      before: [plugin('before')],
      defaults: [plugin('default')],
      after: [plugin('after')],
      math: plugin('math'),
    });
    expect(calls).toEqual(['before', 'default', 'after', 'math']);
  });

  it('does not collide same-named plugin functions in the processor cache', () => {
    const seen: string[] = [];
    const first = function collision() {
      return () => void seen.push('first');
    };
    const second = function collision() {
      return () => void seen.push('second');
    };
    parseSemanticDocument('a', { defaults: [first] });
    parseSemanticDocument('b', { defaults: [second] });
    expect(seen).toEqual(['first', 'second']);
  });

  it('does not collide one plugin configured with behaviorally distinct options', () => {
    const seen: string[] = [];
    const configurable = (options: { label: string }) => () => void seen.push(options.label);
    parseSemanticDocument('a', { defaults: [[configurable, { label: 'first' }]] });
    parseSemanticDocument('b', { defaults: [[configurable, { label: 'second' }]] });
    expect(seen).toEqual(['first', 'second']);
  });

  it('documents the plugin merge contract', () => {
    const before = () => undefined;
    const defaults = () => undefined;
    const after = () => undefined;
    const math = () => undefined;
    expect(mergeRemarkPlugins({ before: [before], defaults: [defaults], after: [after], math })).toEqual([
      before,
      defaults,
      after,
      math,
    ]);
  });
});
