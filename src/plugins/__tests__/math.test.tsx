import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Streamdown } from '../../StreamdownRN';
import { mergeRemarkPlugins, parseSemanticDocument } from '../../core/parser';
import { createMathPlugin, math } from '../math';

describe('math plugin', () => {
  it('keeps the portable parser last and exposes independent configuration', () => {
    const first = createMathPlugin({ singleDollarTextMath: true, errorColor: '#f00' });
    const second = createMathPlugin();
    expect(first).not.toBe(second);
    expect(first).toMatchObject({ name: 'katex', type: 'math' });
    expect(Array.isArray(first.remarkPlugin)).toBe(true);
    expect(first.rehypePlugin).toBeUndefined();
    expect(first.getStyles).toBeUndefined();
    expect((first.remarkPlugin as [unknown, { singleDollarTextMath: boolean }])[1]).toEqual({ singleDollarTextMath: true });
    expect(first.errorColor).toBe('#f00');
    expect((second.remarkPlugin as [unknown, { singleDollarTextMath: boolean }])[1].singleDollarTextMath).toBe(false);
    expect(second.errorColor).toBeUndefined();
    expect(mergeRemarkPlugins({ supplied: [() => undefined], math: first.remarkPlugin }).at(-1)).toBe(first.remarkPlugin);
  });

  it('parses inline and block math while leaving currency alone by default', () => {
    const plugin = createMathPlugin({ singleDollarTextMath: true });
    const parsed = parseSemanticDocument('Inline $x^2$\n\n$$\nA_{ij}\n$$', { math: plugin.remarkPlugin });
    expect(JSON.stringify(parsed)).toContain('inlineMath');
    expect(JSON.stringify(parsed)).toContain('"type":"math"');
    const currency = parseSemanticDocument('That costs $20 today.', { math: math.remarkPlugin });
    expect(JSON.stringify(currency)).not.toContain('inlineMath');
  });

  it('uses the native adapter for inline, block, and matrix expressions', () => {
    const renderMath = jest.fn(({ source, display }: { source: string; display: boolean }) => (
      <Text testID={display ? 'block-math' : 'inline-math'}>{source}</Text>
    ));
    const plugin = createMathPlugin({ singleDollarTextMath: true, adapter: { render: renderMath } });
    render(<Streamdown mode="static" plugins={{ math: plugin }}>{'Inline $x^2$\n\n$$\n\\begin{matrix}a&b\\\\c&d\\end{matrix}\n$$'}</Streamdown>);
    expect(screen.getByTestId('inline-math')).toHaveTextContent('x^2');
    expect(screen.getByTestId('block-math')).toHaveTextContent(/begin\{matrix\}/);
    expect(renderMath).toHaveBeenCalledWith(expect.objectContaining({ source: 'x^2', display: false }));
    expect(renderMath).toHaveBeenCalledWith(expect.objectContaining({ source: expect.stringContaining('begin{matrix}'), display: true }));
  });

  it('always preserves readable source when the adapter fails or the expression is oversized', () => {
    const adapter = { render: jest.fn(() => { throw new Error('unsupported command'); }) };
    const plugin = createMathPlugin({ singleDollarTextMath: true, adapter, maxExpressionLength: 5 });
    render(<Streamdown mode="static" plugins={{ math: plugin }}>{'$\\unsupported{long}$'}</Streamdown>);
    expect(screen.getByText('\\unsupported{long}')).toBeTruthy();
    expect(adapter.render).not.toHaveBeenCalled();
  });

  it('keeps incomplete streamed delimiters readable', () => {
    const plugin = createMathPlugin({ singleDollarTextMath: true });
    render(<Streamdown mode="streaming" isAnimating plugins={{ math: plugin }}>{'Answer: $x +'}</Streamdown>);
    expect(screen.getByText(/Answer:/)).toBeTruthy();
  });
});
