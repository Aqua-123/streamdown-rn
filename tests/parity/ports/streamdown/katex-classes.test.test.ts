import React from 'react';
import { Text } from 'react-native';
import { createMathPlugin } from '../../../../src/plugins/math';
import { renderNative } from './native-cluster-helpers';

describe('native block math semantics', () => {
  const adapter = { render: ({ source }: { source: string }) => React.createElement(Text, null, source) };
  const plugin = createMathPlugin({ adapter });

  it.each([
    ['$$L = \\frac{1}{2} \\rho v^2 S C_L$$', ['L', 'frac']],
    ['$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$', ['x', '=']],
  ])('renders block math through a native adapter: %s', (markdown, expected) => {
    const text = renderNative(markdown, { plugins: { math: plugin } }).toJSON();
    expected.forEach((value) => expect(JSON.stringify(text)).toContain(value));
  });

  it('keeps math visually and semantically distinct from surrounding prose', () => {
    const screen = renderNative('Regular paragraph text.\n\n$$E = mc^2$$\n\nMore regular text.', { plugins: { math: plugin } });
    expect(screen.getByText('Regular paragraph text.')).toBeTruthy();
    expect(screen.getByLabelText('E = mc^2')).toBeTruthy();
    expect(screen.getByText('More regular text.')).toBeTruthy();
  });
});

/* pinned parity markers
 * parity:95b179237e39eee452116abfdf47cb500633070fd768d49bfddd5df1a2133c94 — KaTeX math rendering > should render block math equations with math plugin
 * parity:61c4df02281b49787f150a18a177cba12ba5d6d856ecb773f6fc7c421570bfaf — KaTeX math rendering > should render equations with fractions
 * parity:3a46a7e593eca06d0b36625bafaf9ee0b2b630e82389ed8fd3fa6090ea0de1c8 — KaTeX math rendering > should render math blocks distinctly from regular text
 */
