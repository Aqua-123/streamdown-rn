import React from 'react';
import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src';

function animatedText(screen: ReturnType<typeof render>): string[] {
  return screen.queryAllByTestId('streamdown-native-text').flatMap((node) => {
    const text = String(node.props.animationText ?? '');
    const ranges = JSON.parse(String(node.props.animationRanges ?? '[]')) as Array<{ start: number; end: number }>;
    return ranges.map((range) => text.slice(range.start, range.end));
  });
}

describe('native list animation identity', () => {
  // parity:286af219d9cf8f3b40dfb6f3a999aefd6840d0745c50fe0d3be45d385e4fca8e
  it('animates only the newly appended list suffix', () => {
    const props = { animated: { sep: 'word' as const }, isAnimating: true, reducedMotion: false };
    const screen = render(React.createElement(Streamdown, props, '- Alpha\n- Beta'));
    screen.rerender(React.createElement(Streamdown, props, '- Alpha\n- Beta\n- Gamma'));
    expect(animatedText(screen)).toContain('Gamma');
    expect(animatedText(screen)).not.toContain('Alpha');
  });

  // parity:72b7f92462c4db6ce1c34d512ee10e5341870c896ff2aad9bae71c2faff82c59
  it('keeps value-equivalent inline animation options from replaying old content', () => {
    const options = () => ({ animation: 'fadeIn' as const, duration: 700, easing: 'ease-in-out' as const, sep: 'char' as const });
    const screen = render(React.createElement(Streamdown, { animated: options(), isAnimating: true, reducedMotion: false }, '- AB'));
    screen.rerender(React.createElement(Streamdown, { animated: options(), isAnimating: true, reducedMotion: false }, '- ABCD'));
    expect(animatedText(screen)).toEqual(['C', 'D']);
  });
});
