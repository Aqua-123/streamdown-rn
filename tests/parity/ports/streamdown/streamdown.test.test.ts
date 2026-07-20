import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src';
import { createStreamingInstrumentation } from '../../../../src/core/streaming';
import { createMermaidPlugin } from '../../../../src/plugins/mermaid';

const element = (children?: unknown, props: Record<string, unknown> = {}) =>
  React.createElement(Streamdown, { ...props, children } as never);
const text = (children?: React.ReactNode, props: Record<string, unknown> = {}) =>
  React.createElement(Text, props, children);
const visibleText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return ((value as { children?: unknown[] }).children ?? []).map(visibleText).join('');
};

describe('Streamdown Component native parity', () => {
  it('renders markdown content with native heading semantics', () => {
    // parity:3d95edac1d28d9be41445be104e2f3b54cef270260e1db2ca9faa6ac71b4cfc1
    const screen = render(element('# Hello World', { mode: 'static' }));
    expect(screen.getByRole('header', { name: 'Hello World' })).toBeTruthy();
  });

  it('repairs incomplete markdown by default', () => {
    // parity:240da989cb7c8569b0cc56eb625e83db0d7be6730ba0036c9ec36bbe610900f3
    const Strong = ({ children }: { children?: React.ReactNode }) => text(children, { testID: 'strong' });
    const screen = render(element('Text with **incomplete bold', { components: { strong: Strong } }));
    expect(screen.getByTestId('strong').props.children).toEqual(['incomplete bold']);
  });

  it('leaves incomplete markdown literal when repair is disabled', () => {
    // parity:dbfd7aab2ddfc63f8b52b2e41861ac6b9d972209cb9b4505cfd7e2f6c545ab59
    const Strong = ({ children }: { children?: React.ReactNode }) => text(children, { testID: 'strong' });
    const screen = render(element('Text with **incomplete bold', {
      parseIncompleteMarkdown: false,
      components: { strong: Strong },
    }));
    expect(screen.queryByTestId('strong')).toBeNull();
    expect(screen.getByText('Text with **incomplete bold')).toBeTruthy();
  });

  it('treats non-string children as empty input', () => {
    // parity:976df1208d54acbcc576ae47c38a6a66660205fa8177f7d8c3e03090e01a1c6c
    expect(render(element(text('React Element'))).toJSON()).toBeNull();
  });

  it('merges a custom heading renderer with native defaults', () => {
    // parity:2787def0aae33ecdb0e93c0cc76fcb10624e8fd4cb62cec8fd38606a7d19f1b0
    const Heading = ({ children }: { children?: React.ReactNode }) => text(['custom:', children], { testID: 'custom-h1' });
    const Strong = ({ children }: { children?: React.ReactNode }) => text(children, { testID: 'custom-strong' });
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const screen = render(element('# Heading\n\nDefault **paragraph**', {
        mode: 'static',
        components: { h1: Heading, strong: Strong },
      }));
      expect(screen.getByTestId('custom-h1').props.children).toEqual(['custom:', ['Heading']]);
      expect(screen.getByTestId('custom-strong')).toHaveTextContent('paragraph');
      expect(errors.mock.calls.filter((call) => call.some((argument) =>
        typeof argument === 'string' && argument.includes('unique "key" prop')
      ))).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it('explicitly rejects the DOM-only rehype plugin seam', () => {
    // parity:ab30421f229ad5fa775d714196c2476a30a0c2490a69e52790735fc5879d1870
    expect(() => render(element('Content', { rehypePlugins: [() => undefined] })))
      .toThrow(/rehypePlugins.*DOM-only/i);
  });

  it('applies supplied remark plugins after built-ins', () => {
    // parity:13c5bfee3a1775fe48e055d598c76cba5f2ba6b3ccd0ba25c596a99cabe4bf17
    const replace = () => (tree: { children?: Array<{ children?: Array<{ value?: string }> }> }) => {
      const first = tree.children?.[0]?.children?.[0];
      if (first) first.value = 'plugin output';
    };
    expect(render(element('Content', { mode: 'static', remarkPlugins: [replace] })).getByText('plugin output')).toBeTruthy();
  });

  it('memoizes identical children and updates for changed children', () => {
    // parity:5aad26373bd3d4d9771473c3cdac64879e939bc1ace1bed2ee8559ebd128e4b0
    let renders = 0;
    const Paragraph = ({ children }: { children?: React.ReactNode }) => {
      renders++;
      return text(children);
    };
    const props = { mode: 'static', components: { p: Paragraph } };
    const screen = render(element('Content', props));
    expect(renders).toBe(1);
    screen.rerender(element('Content', props));
    expect(renders).toBe(1);
    screen.rerender(element('Different Content', props));
    expect(renders).toBe(2);
    expect(screen.getByText('Different Content')).toBeTruthy();
  });

  it('renders empty-string children as no native output', () => {
    // parity:589f9c4da9d8ea3f3eb6ccd1b9b2982cce9ce6889feed417307ecd9a9bde6ce3
    expect(render(element('')).toJSON()).toBeNull();
  });

  it('renders null children as no native output', () => {
    // parity:59a5b02e61d9ec4edba14d3b8d1f8ea0c732e1c7291d3cab5fc974a05447dffd
    expect(render(element(null)).toJSON()).toBeNull();
  });

  it('renders undefined children as no native output', () => {
    // parity:468e61655cb6708f10d26284062420957ed1b803937c6231bd4df44ba3b78d95
    expect(render(element()).toJSON()).toBeNull();
  });

  it('renders number children as no native output', () => {
    // parity:65314baaa54298a3191874b181f811c5944eba951ec4b0e02d6de2cd2ff3fbb5
    expect(render(element(123)).toJSON()).toBeNull();
  });

  it('repairs complex incomplete tokens while preserving complete formatting', () => {
    // parity:e8b826833c851d5715d8c7385a2a3f7c2905909c595218cb6a093323c5999400
    const source = [
      '# Heading',
      'This is **bold** and *italic* text.',
      "Here's an incomplete **bold",
      'And an incomplete [link',
    ].join('\n');
    const screen = render(element(source));
    expect(screen.getByRole('header', { name: 'Heading' })).toBeTruthy();
    const output = visibleText(screen.toJSON());
    expect(output.match(/bold/g)).toHaveLength(2);
    expect(screen.getByText('italic')).toBeTruthy();
    expect(screen.getByText('link')).toBeTruthy();
  });

  it('accepts configured Mermaid through the optional native plugin seam', () => {
    // parity:7477041d8b7d3f9e75187dad1c0dd59966692392aacbaf982ba12e1d42ebe910
    const mermaid = createMermaidPlugin({
      config: { theme: 'dark', themeVariables: { primaryColor: '#ff0000' } },
    });
    expect(render(element('Test content', { mode: 'static', plugins: { mermaid } })).getByText('Test content')).toBeTruthy();
  });

  it('renders without a Mermaid plugin', () => {
    // parity:40fb35f5a6273a0c08ef81769fa94857a584cb5b2ff48f65b68cef786b3af282
    expect(render(element('Test content', { mode: 'static' })).getByText('Test content')).toBeTruthy();
  });

  it('parses a static document once without streaming block work', () => {
    // parity:b38122962ff2c4226775c2d116c5b826d34a5b7dbe2fb7a65d6dff8c2891fcb2
    const metrics = createStreamingInstrumentation();
    const screen = render(element('# Hello\n\nThis is a paragraph.', { mode: 'static', instrumentation: metrics }));
    expect(screen.getByRole('header', { name: 'Hello' })).toBeTruthy();
    expect(screen.getByText('This is a paragraph.')).toBeTruthy();
    expect(metrics.snapshot()).toMatchObject({ documentParses: 1, activeParses: 0, stableParses: 0 });
  });

  it('uses streaming block parsing by default', () => {
    // parity:57702d053923625c9fcee06fbaa622c6566639420386ebe46cf1c9d5cf7d6acd
    const metrics = createStreamingInstrumentation();
    const screen = render(element('# Hello\n\nThis is a paragraph.', { instrumentation: metrics }));
    expect(screen.getByRole('header', { name: 'Hello' })).toBeTruthy();
    expect(screen.getByText('This is a paragraph.')).toBeTruthy();
    expect(metrics.snapshot()).toMatchObject({ documentParses: 0, stableParses: 1, activeParses: 1 });
  });

  it('uses streaming block parsing when explicitly requested', () => {
    // parity:dc086a900b94fca6a5c4663a34c63a1e5b80626ad2775dd22c46ebe7b3235b26
    const metrics = createStreamingInstrumentation();
    render(element('# Hello\n\nThis is a paragraph.', { mode: 'streaming', instrumentation: metrics }));
    expect(metrics.snapshot()).toMatchObject({ documentParses: 0, stableParses: 1, activeParses: 1 });
  });

  it('does not repair incomplete markdown in static mode', () => {
    // parity:159a7c6ce99b25b0aa8e920703b972722695da285d2fd09eface3199ece80130
    const Strong = ({ children }: { children?: React.ReactNode }) => text(children, { testID: 'strong' });
    const screen = render(element('Text with **incomplete bold', { mode: 'static', components: { strong: Strong } }));
    expect(screen.queryByTestId('strong')).toBeNull();
    expect(screen.getByText('Text with **incomplete bold')).toBeTruthy();
  });

  it('changes parsing strategy when mode changes', () => {
    // parity:ec659ea99e4cb796bb112c96a8bb5f4780f5189ef5089614d41b2993390cdc60
    const metrics = createStreamingInstrumentation();
    const source = '# Hello\n\nContent';
    const screen = render(element(source, { mode: 'streaming', instrumentation: metrics }));
    expect(metrics.snapshot().documentParses).toBe(0);
    screen.rerender(element(source, { mode: 'static', instrumentation: metrics }));
    expect(metrics.snapshot().documentParses).toBe(1);
    expect(screen.getByRole('header', { name: 'Hello' })).toBeTruthy();
  });
});

describe('animation callback native parity', () => {
  it('fires callbacks across multiple animation cycles', () => {
    // parity:ea6f80a5659a755912edc367a92eed8f66342e9df4372b5b03f65d20a643e34f
    const onAnimationStart = jest.fn();
    const onAnimationEnd = jest.fn();
    const props = { onAnimationStart, onAnimationEnd };
    const screen = render(element('content', { ...props, isAnimating: false }));
    screen.rerender(element('content', { ...props, isAnimating: true }));
    screen.rerender(element('content', { ...props, isAnimating: false }));
    screen.rerender(element('content', { ...props, isAnimating: true }));
    screen.rerender(element('content', { ...props, isAnimating: false }));
    expect(onAnimationStart).toHaveBeenCalledTimes(2);
    expect(onAnimationEnd).toHaveBeenCalledTimes(2);
  });

  it('does not throw when animation callbacks are omitted', () => {
    // parity:bedab1eaa9a7f2ce883f22abbe9e961aee6935a1db27a184af417e462d198db3
    const screen = render(element('content', { isAnimating: false }));
    expect(() => {
      screen.rerender(element('content', { isAnimating: true }));
      screen.rerender(element('content', { isAnimating: false }));
    }).not.toThrow();
  });
});
