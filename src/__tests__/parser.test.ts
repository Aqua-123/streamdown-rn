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

  it('preserves source as inert text and reports plugin parse failures', () => {
    const failure = new Error('plugin failed');
    const onError = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = () => () => {
      throw failure;
    };
    const tree = parseSemanticDocument('**keep this source**', { after: [broken], onError });

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: '**keep this source**' }],
    });
    expect(onError).toHaveBeenCalledWith(failure);
    warn.mockRestore();
  });

  it('falls back to inert text before recursive consumers see an over-deep tree', () => {
    const source = `${'> '.repeat(300)}nested`;
    const onError = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tree = parseSemanticDocument(source, { onError });

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: source }],
    });
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(RangeError);
    warn.mockRestore();
  });

  it('rejects emphasis and link bombs before remark plugins allocate a tree', () => {
    const after = jest.fn(() => undefined);
    const onError = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const source of ['*x*'.repeat(35_000), '[]()'.repeat(26_000)]) {
      const tree = parseSemanticDocument(source, { after: [after], onError });
      const preview = (tree.children[0] as { children: Array<{ value: string }> }).children[0].value;
      expect(preview.length).toBeLessThan(9_000);
      expect(preview).toContain('[Markdown preview truncated]');
    }
    expect(after).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('rejects a 250k-line fence before remark plugins allocate a tree', () => {
    const after = jest.fn(() => undefined);
    const onError = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tree = parseSemanticDocument(`\`\`\`txt\n${'x\n'.repeat(250_000)}\`\`\``, { after: [after], onError });
    const preview = (tree.children[0] as { children: Array<{ value: string }> }).children[0].value;
    expect(preview.length).toBeLessThan(9_000);
    expect(after).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('physical lines') }));
    warn.mockRestore();
  });

  it('accepts the physical-line boundary when it forms one fenced node', () => {
    const onError = jest.fn();
    const source = `\`\`\`txt\n${'x\n'.repeat(49_998)}\`\`\``;
    expect(parseSemanticDocument(source, { onError }).children[0]).toMatchObject({ type: 'code' });
    expect(onError).not.toHaveBeenCalled();
  });

  it('accepts the structural-marker boundary and ignores fenced source markers', () => {
    const onError = jest.fn();
    expect(parseSemanticDocument('*'.repeat(25_000), { onError }).children[0]).toMatchObject({ type: 'thematicBreak' });
    const fenced = `\`\`\`txt\n\`\`\`still code\n${'<'.repeat(30_000)}\n\`\`\``;
    expect(parseSemanticDocument(fenced, { onError }).children[0]).toMatchObject({ type: 'code' });
    expect(onError).not.toHaveBeenCalled();
  });
});
