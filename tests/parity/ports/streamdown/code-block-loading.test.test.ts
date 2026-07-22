import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Streamdown } from '../../../../src';
import {
  createCodePlugin,
  type HighlightResult,
} from '../../../../src/plugins/code';

describe('native code block loading behavior', () => {
  // parity:549ee0ddd902c9df90a7104b37994026914eec6900c055b3f0be6dc09de3d31f
  it('keeps plain code readable without a visual spinner while tokens load', () => {
    const plugin = createCodePlugin({
      provider: {
        languages: ['javascript'],
        highlight: () => new Promise<HighlightResult>(() => undefined),
      },
    });

    render(React.createElement(
      Streamdown,
      { mode: 'static', plugins: { code: plugin } },
      '```javascript\nconst x = 1;\n```'
    ));

    expect(screen.getByText('const x = 1;')).toBeTruthy();
    expect(screen.queryByText('Highlighting code')).toBeNull();
    expect(screen.getByLabelText('Highlighting code').props.accessibilityState).toEqual({ busy: true });
  });

  // parity:4286ae578d7e522b786c6c3cfd744f3be6ca18a8c4e875e28c2ad84858f4b718
  it('applies provider token styles only after asynchronous resolution', async () => {
    let resolve!: (result: HighlightResult) => void;
    const plugin = createCodePlugin({
      provider: {
        languages: ['javascript'],
        highlight: () => new Promise<HighlightResult>((done) => { resolve = done; }),
      },
    });

    render(React.createElement(
      Streamdown,
      { mode: 'static', plugins: { code: plugin } },
      '```javascript\nconst x = 1;\n```'
    ));

    const token = () => screen.getByText('const x = 1;');
    expect(token()).not.toHaveStyle({ color: '#ff0000' });

    resolve({ tokens: [[{ content: 'const x = 1;', color: '#ff0000' }]] });

    await waitFor(() => expect(token()).toHaveStyle({ color: '#ff0000' }));
    expect(screen.queryByLabelText('Highlighting code')).toBeNull();
  });
});
