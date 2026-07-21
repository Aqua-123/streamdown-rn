import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { createCodePlugin, type HighlightResult } from '../../../../src/plugins/code';

const renderResult = (result: HighlightResult, language = 'javascript') => render(
  React.createElement(Streamdown, {
    mode: 'static',
    controls: false,
    plugins: {
      code: createCodePlugin({
        provider: { languages: [language], highlight: () => result },
      }),
    },
    children: `\`\`\`${language}\nsource\n\`\`\``,
  })
);

const hasViewStyle = (property: string, value: string) =>
  [...screen.UNSAFE_getAllByType(View), ...screen.UNSAFE_getAllByType(ScrollView)]
    .some((view) => StyleSheet.flatten(view.props.style)?.[property] === value);
const hasTextStyle = (property: string, value: string) =>
  screen.UNSAFE_getAllByType(Text).some((text) => StyleSheet.flatten(text.props.style)?.[property] === value);

describe('CodeBlockBody native parity', () => {
  it('renders the language and basic highlighted result', () => {
    // parity:57b401b5b96284b935fdfc9e8496e35d3ac71720e68ef6bf4799b3ffb0524021
    renderResult({ tokens: [[{ content: 'const x = 1;', color: '#000' }]], bg: '#fff', fg: '#000' });
    expect(screen.getByText('javascript')).toBeTruthy();
    expect(screen.getByText('const x = 1;')).toHaveStyle({ color: '#000' });
  });

  it('maps result background and foreground colors to native styles', () => {
    // parity:6e213038bc2916b19bf6509294e9c0d35b9124b3446e4be4904d37726a781ae5
    renderResult({ tokens: [[{ content: 'plain token' }]], bg: '#1e1e1e', fg: '#d4d4d4' });
    expect(hasViewStyle('backgroundColor', '#1e1e1e')).toBe(true);
    expect(hasTextStyle('color', '#d4d4d4')).toBe(true);
  });

  it('accepts provider-normalized theme colors in place of web rootStyle variables', () => {
    // parity:660618ae9f39d3195536d4134baa96fba601033cb87225a7ef74d95c8ef03e19
    renderResult({ tokens: [[{ content: 'themed' }]], bg: '#222', fg: '#eee' });
    expect(hasViewStyle('backgroundColor', '#222')).toBe(true);
    expect(hasTextStyle('color', '#eee')).toBe(true);
  });

  it('uses already-normalized colors without CSS declaration parsing', () => {
    // parity:6146f27dbde957ab5606a0a14c4e44b8e92b960ad2d86180c1aaaa2baf1cea32
    renderResult({ tokens: [[{ content: 'normalized' }]], bg: 'red', fg: 'blue' });
    expect(hasViewStyle('backgroundColor', 'red')).toBe(true);
    expect(hasTextStyle('color', 'blue')).toBe(true);
  });

  it('renders readably when result colors are absent', () => {
    // parity:398b6ff6ec754fe804b91cf6202e19fe078d280a92404ddb77a6194e172718f2
    renderResult({ tokens: [[{ content: 'test' }]] }, 'text');
    expect(screen.getByText('test')).toBeTruthy();
  });

  it('maps normalized token color to a native Text style', () => {
    // parity:210a1ba95e6e5058dd168b26441746d84b52980dd6a8edbc459b732d2ec8539a
    renderResult({ tokens: [[{ content: 'const', color: '#ff0000' }]] });
    expect(screen.getByText('const')).toHaveStyle({ color: '#ff0000' });
  });

  it('maps normalized token background color to a native Text style', () => {
    // parity:a4281fb9994e76ddbe666e93b1a3dcf03fb72699924c8e15e2b283a184e87a62
    renderResult({ tokens: [[{ content: 'highlight', bgColor: '#ffff00' }]] });
    expect(screen.getByText('highlight')).toHaveStyle({ backgroundColor: '#ffff00' });
  });

  it('maps normalized non-color token properties to native Text styles', () => {
    // parity:07825deb969b31082a955a2987c66d44b160490aa7eb245f7307af3af7c92324
    renderResult({ tokens: [[{ content: 'text', fontStyle: 'italic' }]] });
    expect(screen.getByText('text')).toHaveStyle({ fontStyle: 'italic' });
  });

  it('supports the portable bgColor token property', () => {
    // parity:8c23a59db029d583d93b4be71755e61d30edbded8104afe003e217a9607c09e2
    renderResult({ tokens: [[{ content: 'bg', bgColor: '#00ff00' }]] });
    expect(screen.getByText('bg')).toHaveStyle({ backgroundColor: '#00ff00' });
  });

  it('renders one native line row and number per token row', () => {
    // parity:4c8a636c82aa527e0143015a62f24c28254caa4b1ab71fceee1f0a449a33ab6c
    renderResult({ tokens: [[{ content: 'line 1' }], [{ content: 'line 2' }], [{ content: 'line 3' }]] }, 'text');
    expect(screen.getAllByLabelText(/^Line \d+$/)).toHaveLength(3);
  });

  it('preserves a row represented by a single empty token', () => {
    // parity:351369a3ad854f674fa63ea905150ef6a66b8657d98883f04f5d4276794291e1
    renderResult({ tokens: [[{ content: 'line 1' }], [{ content: '' }], [{ content: 'line 3' }]] }, 'text');
    expect(screen.getAllByLabelText(/^Line \d+$/)).toHaveLength(3);
  });

  it('preserves a row represented by zero tokens', () => {
    // parity:ed01dc3e112f15e47758b02875be4400e346272fccf8c9dd58a3dfffa137f1f2
    renderResult({ tokens: [[{ content: 'line 1' }], [], [{ content: 'line 3' }]] }, 'text');
    expect(screen.getAllByLabelText(/^Line \d+$/)).toHaveLength(3);
  });

  it('supports the portable color token property', () => {
    // parity:897feb57ef6b4bc222d3026d9e227e14ae45724320becb1ae1bc7e47e0104644
    renderResult({ tokens: [[{ content: 'colored', color: '#abc123' }]] }, 'text');
    expect(screen.getByText('colored')).toHaveStyle({ color: '#abc123' });
  });
});
