import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Root } from 'mdast';
import { Streamdown } from '../../StreamdownRN';
import { parseSemanticDocument } from '../../core/parser';
import {
  createCodePlugin,
  plainCodeResult,
  type HighlightResult,
  type TokenProvider,
} from '../code';
import { cjk, createCjkPlugin } from '../cjk';
import { createRendererPlugin } from '../renderers';

const themes = ['light', 'dark'] as const;

describe('optional code plugin', () => {
  it('renders deterministic plain code for unsupported, empty, and large inputs', () => {
    expect(plainCodeResult('')).toEqual({ tokens: [[{ content: '' }]] });
    expect(plainCodeResult('a\n\nb')).toEqual({
      tokens: [[{ content: 'a' }], [{ content: '' }], [{ content: 'b' }]],
    });
    const large = 'x'.repeat(20_000);
    expect(plainCodeResult(large).tokens[0][0].content).toBe(large);
  });

  it('loads provider tokens, supports aliases, and returns a cached result', async () => {
    const provider: TokenProvider = {
      languages: ['javascript'],
      aliases: { js: 'javascript' },
      highlight: async ({ code }) => ({ tokens: [[{ content: code, color: '#f00' }]] }),
    };
    const plugin = createCodePlugin({ provider, themes: [...themes] });
    expect(plugin.name).toBe('shiki');
    const callback = jest.fn();
    expect(plugin.supportsLanguage('js')).toBe(true);
    expect(plugin.supportsLanguage('unknown')).toBe(false);
    expect(plugin.highlight({ code: 'const x = 1', language: 'js', themes: [...themes] }, callback)).toBeNull();
    await waitFor(() => expect(callback).toHaveBeenCalled());
    expect(plugin.highlight({ code: 'const x = 1', language: 'js', themes: [...themes] })).toEqual(callback.mock.calls[0][0]);
  });

  it('keys the bounded cache by complete source, not matching edges', async () => {
    const seen: string[] = [];
    const provider: TokenProvider = {
      languages: ['text'],
      highlight: async ({ code }) => {
        seen.push(code);
        return { tokens: [[{ content: code }]] };
      },
    };
    const plugin = createCodePlugin({ provider, cacheSize: 2 });
    const first = `${'a'.repeat(100)}ONE${'z'.repeat(100)}`;
    const second = `${'a'.repeat(100)}TWO${'z'.repeat(100)}`;
    const results: HighlightResult[] = [];
    plugin.highlight({ code: first, language: 'text', themes: [...themes] }, (value) => results.push(value));
    plugin.highlight({ code: second, language: 'text', themes: [...themes] }, (value) => results.push(value));
    await waitFor(() => expect(results).toHaveLength(2));
    expect(results.map((result) => result.tokens[0][0].content)).toEqual([first, second]);
    expect(seen).toEqual([first, second]);
  });

  it('evicts by aggregate cache units as well as entry count', async () => {
    const highlight = jest.fn(async () => ({ tokens: [[{ content: '' }]] }));
    const plugin = createCodePlugin({ provider: { languages: ['text'], highlight }, cacheSize: 10, maxCacheUnits: 100 });
    const first = 'a'.repeat(20);
    const second = 'b'.repeat(20);
    const load = (code: string) => new Promise<HighlightResult>((resolve) => {
      const immediate = plugin.highlight({ code, language: 'text', themes: [...themes] }, resolve);
      if (immediate) resolve(immediate);
    });
    await load(first);
    await load(second);
    await load(first);
    expect(highlight).toHaveBeenCalledTimes(3);
  });

  it('falls back immediately for unsupported languages and provider failures', async () => {
    const provider: TokenProvider = {
      languages: ['js'],
      highlight: async () => { throw new Error('failed'); },
    };
    const plugin = createCodePlugin({ provider });
    expect(plugin.highlight({ code: 'hello', language: 'unknown', themes: [...themes] })).toEqual(plainCodeResult('hello'));
    const callback = jest.fn();
    plugin.highlight({ code: 'broken', language: 'js', themes: [...themes] }, callback);
    await waitFor(() => expect(callback).toHaveBeenCalledWith(plainCodeResult('broken')));
  });

  it('does not send over-limit code to the provider', () => {
    const highlight = jest.fn(() => plainCodeResult('wrong'));
    const plugin = createCodePlugin({ provider: { languages: ['text'], highlight }, maxCodeLength: 10 });
    const source = 'x'.repeat(11);
    expect(plugin.highlight({ code: source, language: 'text', themes: [...themes] })).toEqual(plainCodeResult(source));
    expect(highlight).not.toHaveBeenCalled();
    expect(() => createCodePlugin({ maxCacheUnits: 0 })).toThrow('maxCacheUnits must be a positive integer');
  });
});

describe('native code rendering and custom renderer precedence', () => {
  it('renders metadata, custom start lines, line-number opt-out, and highlighted tokens', async () => {
    const plugin = createCodePlugin({
      provider: {
        languages: ['js'],
        highlight: ({ code }) => ({ tokens: code.split('\n').map((line) => [{ content: line, color: '#f00' }]) }),
      },
    });
    render(
      <Streamdown mode="static" plugins={{ code: plugin }}>
        {'```js startLine=10 noLineNumbers title="sample"\nconst x = 1\n```'}
      </Streamdown>
    );
    expect(screen.getByText('js')).toBeTruthy();
    expect(screen.getByText('startLine=10 noLineNumbers title="sample"')).toBeTruthy();
    expect(screen.queryByText('10')).toBeNull();
    expect(screen.getByText('const x = 1')).toHaveStyle({ color: '#f00' });
  });

  it('renders line numbers by default and exposes readable loading fallback', async () => {
    let resolve!: (value: HighlightResult) => void;
    const plugin = createCodePlugin({
      provider: {
        languages: ['js'],
        highlight: () => new Promise((done) => { resolve = done; }),
      },
    });
    render(<Streamdown mode="static" plugins={{ code: plugin }}>{'```js startLine=3\na\nb\n```'}</Streamdown>);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByLabelText('Highlighting code')).toBeTruthy();
    resolve({ tokens: [[{ content: 'A' }], [{ content: 'B' }]] });
    await waitFor(() => expect(screen.getByText('A')).toBeTruthy());
  });

  it('does not restart highlighting when a provider returns a new theme tuple', async () => {
    const highlight = jest.fn(({ code }) => Promise.resolve(plainCodeResult(code)));
    const base = createCodePlugin({ provider: { languages: ['js'], highlight } });
    const plugin = { ...base, getThemes: () => ['light', 'dark'] as [string, string] };
    const { rerender } = render(<Streamdown mode="static" plugins={{ code: plugin }}>{'```js\na\n```'}</Streamdown>);
    await waitFor(() => expect(highlight).toHaveBeenCalledTimes(1));
    rerender(<Streamdown mode="static" plugins={{ code: plugin }}>{'```js\na\n```'}</Streamdown>);
    expect(highlight).toHaveBeenCalledTimes(1);
  });

  it('uses matching custom language renderers before the code provider and updates configuration', () => {
    const highlight = jest.fn(() => plainCodeResult('wrong'));
    const code = createCodePlugin({ provider: { languages: ['vega'], highlight } });
    const Vega = ({ code: source, language, isIncomplete, meta }: { code: string; language: string; isIncomplete: boolean; meta?: string }) => (
      <Text testID="custom">{`${language}:${source}:${isIncomplete}:${meta}`}</Text>
    );
    const D2 = ({ language }: { language: string }) => <Text testID="custom">{language}</Text>;
    const { rerender } = render(
      <Streamdown mode="static" plugins={{ code, renderers: createRendererPlugin([{ language: ['vega', 'vega-lite'], component: Vega }]) }}>
        {'```vega title="x"\nchart\n```'}
      </Streamdown>
    );
    expect(screen.getByTestId('custom')).toHaveTextContent('vega:chart:false:title="x"');
    expect(highlight).not.toHaveBeenCalled();
    rerender(
      <Streamdown mode="static" plugins={{ code, renderers: createRendererPlugin([{ language: 'vega', component: D2 }]) }}>
        {'```vega\nchart\n```'}
      </Streamdown>
    );
    expect(screen.getByTestId('custom')).toHaveTextContent('vega');
  });

  it('passes incomplete state to a custom renderer while streaming', () => {
    const Renderer = ({ isIncomplete }: { isIncomplete: boolean }) => <Text testID="incomplete">{String(isIncomplete)}</Text>;
    render(
      <Streamdown isAnimating plugins={{ renderers: createRendererPlugin([{ language: 'vega', component: Renderer }]) }}>
        {'```vega\nchart'}
      </Streamdown>
    );
    expect(screen.getByTestId('incomplete')).toHaveTextContent('true');
  });

  it('does not mark a closed active fence incomplete merely because streaming continues', () => {
    const Renderer = ({ isIncomplete }: { isIncomplete: boolean }) => <Text testID="incomplete">{String(isIncomplete)}</Text>;
    render(
      <Streamdown isAnimating plugins={{ renderers: createRendererPlugin([{ language: 'vega', component: Renderer }]) }}>
        {'```vega\nchart\n```'}
      </Streamdown>
    );
    expect(screen.getByTestId('incomplete')).toHaveTextContent('false');
  });

  it('keeps a fence with trailing non-whitespace incomplete', () => {
    const Renderer = ({ isIncomplete }: { isIncomplete: boolean }) => <Text testID="incomplete">{String(isIncomplete)}</Text>;
    render(
      <Streamdown isAnimating plugins={{ renderers: createRendererPlugin([{ language: 'vega', component: Renderer }]) }}>
        {'```vega\nchart\n```not-a-close'}
      </Streamdown>
    );
    expect(screen.getByTestId('incomplete')).toHaveTextContent('true');
  });

  it('defers token providers until a streamed code fence closes', () => {
    const highlight = jest.fn(({ code }) => plainCodeResult(code));
    const plugin = createCodePlugin({ provider: { languages: ['js'], highlight } });
    const { rerender } = render(<Streamdown isAnimating plugins={{ code: plugin }}>{'```js\na'}</Streamdown>);
    rerender(<Streamdown isAnimating plugins={{ code: plugin }}>{'```js\nab'}</Streamdown>);
    expect(highlight).not.toHaveBeenCalled();
    rerender(<Streamdown isAnimating plugins={{ code: plugin }}>{'```js\nab\n```'}</Streamdown>);
    expect(highlight).toHaveBeenCalledTimes(1);
  });
});

describe('portable CJK plugin', () => {
  const parse = (markdown: string): Root => parseSemanticDocument(markdown, {
    before: cjk.remarkPluginsBefore,
    after: cjk.remarkPluginsAfter,
  });

  it('provides independent before/default/after plugin arrays', () => {
    const first = createCjkPlugin();
    const second = createCjkPlugin();
    expect(first).not.toBe(second);
    expect(first.remarkPluginsBefore).not.toBe(second.remarkPluginsBefore);
    expect(first.remarkPluginsAfter).not.toBe(second.remarkPluginsAfter);
    expect(first.remarkPlugins).toEqual([...first.remarkPluginsBefore, ...first.remarkPluginsAfter]);
  });

  it.each(['。', '．', '，', '、', '？', '！', '：', '；', '（', '）', '【', '】', '「', '」', '『', '』', '〈', '〉', '《', '》'])(
    'splits literal autolinks at %s',
    (punctuation) => {
      const tree = parse(`访问 https://example.com${punctuation}后`);
      const paragraph = tree.children[0] as { children: Array<{ type: string; url?: string; value?: string }> };
      expect(paragraph.children.find((node) => node.type === 'link')?.url).toBe('https://example.com');
      expect(paragraph.children.map((node) => node.value ?? '').join('')).toContain(`${punctuation}后`);
    }
  );

  it('preserves explicit markdown links and supports CJK emphasis/strikethrough boundaries', () => {
    const explicit = parse('[链接](https://example.com。谢谢)');
    const link = (explicit.children[0] as { children: Array<{ url?: string }> }).children[0];
    expect(link.url).toBe('https://example.com。谢谢');
    expect(parse('中文_强调_中文').children[0]).toMatchObject({ children: expect.arrayContaining([expect.objectContaining({ type: 'emphasis' })]) });
    expect(parse('中文~~删除~~中文').children[0]).toMatchObject({ children: expect.arrayContaining([expect.objectContaining({ type: 'delete' })]) });
  });

  it('runs CJK-before, defaults, host plugins, then CJK-after', () => {
    const order: string[] = [];
    const recorder = (name: string) => () => () => { order.push(name); };
    parseSemanticDocument('text', {
      before: [recorder('before')],
      defaults: [recorder('default')],
      supplied: [recorder('host')],
      after: [recorder('after')],
    });
    expect(order).toEqual(['before', 'default', 'host', 'after']);
  });
});
