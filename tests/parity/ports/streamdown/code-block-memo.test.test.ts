import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src';
import { createRendererPlugin } from '../../../../src/plugins/renderers';

describe('native code blocks in streaming mode', () => {
  it('does not re-render an unchanged finalized code block on later updates', () => {
    // parity:275810975ac3b44cc643d0907a2327fdbba9f775515806334ee3aa40c3fd47a4
    let codeBlockRenderCount = 0;
    const CodeBlock = ({ code }: { code: string }) => {
      codeBlockRenderCount += 1;
      return React.createElement(Text, null, code);
    };
    const initial = '```js\nconst a = 1;\n```\n\nParagraph one';
    const updated = '```js\nconst a = 1;\n```\n\nParagraph one plus';
    const props = {
      plugins: {
        renderers: createRendererPlugin([{ language: 'js', component: CodeBlock }]),
      },
    };
    const screen = render(React.createElement(Streamdown, props, initial));

    expect(screen.getByText('const a = 1;')).toBeTruthy();
    expect(screen.getByText('Paragraph one')).toBeTruthy();
    expect(codeBlockRenderCount).toBeGreaterThan(0);
    const initialRenderCount = codeBlockRenderCount;

    screen.rerender(React.createElement(Streamdown, props, updated));

    expect(screen.getByText('Paragraph one plus')).toBeTruthy();
    expect(codeBlockRenderCount).toBe(initialRenderCount);
  });
});
