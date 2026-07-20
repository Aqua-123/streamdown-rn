import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { createCodePlugin } from '../../../../src/plugins/code';
import { createCjkPlugin } from '../../../../src/plugins/cjk';
import { createMathPlugin } from '../../../../src/plugins/math';
import { findCustomRenderer } from '../../../../src/plugins/renderers';

const Dummy = () => null;

describe('adapted explicit native plugin configuration', () => {
  // parity:d2c8a196fec41337d454836e9c814211d58355c91cd1c110bf4771aa41cebea5
  // parity:d06f07ffa9ad5235df5e50227db6d4245658dadc334d7397032abc50c9faa1c1
  // parity:a7c70eb897cbffc54f41061ac2cd14a2efd15678ed0ce57d051204921d75a01d
  // parity:f970ead02d8f684485855da596c73d96578e6af75a6fc31f0de12db7fee9aa58
  // parity:252b380c9fae5d491b2901ca48826ee862ca361895251db74c2b5609311dedf5
  it('needs no React context and preserves readable defaults without plugins', () => {
    const result = render(React.createElement(Streamdown, {
      mode: 'static',
      children: '```mermaid\nflowchart LR\nA-->B\n```',
    }));
    expect(result.getByText('flowchart LR')).toBeTruthy();
    expect(result.getByText('A-->B')).toBeTruthy();
    expect(findCustomRenderer(undefined, 'vega')).toBeUndefined();
  });

  // parity:fbf7dd24a27c162fc6dd7e104eb685318a9f30f6684fd7f9dc3d8626d5a34e3a
  // parity:da867294f609154db6bfe68917199462ea782b6af4068fc4e8ffc56a48e62ad5
  // parity:84bf842fa785e72db42fcba182f2350923f1bc60ebdde1cffcda4ee450b1fd5c
  // parity:030716cc29ca287b22fa51d9991f52dcd0177c5142952ceb78b3b9d1bfa63636
  // parity:541619d7b0668e8a135bf3c237ecb8d3ea7356f86045a6e027dd2dcb29af0ad7
  it('applies code, Mermaid, math, and CJK plugins supplied on the component', async () => {
    const code = createCodePlugin({ provider: {
      languages: ['js'],
      highlight: () => ({ tokens: [[{ content: 'highlighted' }]] }),
    } });
    const math = createMathPlugin({ singleDollarTextMath: true, adapter: {
      render: ({ source }) => React.createElement(Text, { testID: 'math' }, source),
    } });
    const cjk = createCjkPlugin();
    const Mermaid = ({ source }: { source: string }) => React.createElement(Text, { testID: 'diagram' }, source);
    const mermaid = {
      name: 'mermaid' as const, type: 'diagram' as const, language: 'mermaid' as const,
      component: Mermaid, maxSourceLength: 1000, maxSvgLength: 1000,
      getMermaid: () => ({ initialize: () => undefined, render: async () => ({ kind: 'native' as const, content: null }) }),
      render: async () => ({ kind: 'native' as const, content: null }),
    };

    const highlighted = render(React.createElement(Streamdown, {
      mode: 'static', plugins: { code }, children: '```js\nsource\n```',
    }));
    await waitFor(() => expect(highlighted.getByText('highlighted')).toBeTruthy());
    expect(render(React.createElement(Streamdown, {
      mode: 'static', plugins: { math }, children: '$x$',
    })).getByTestId('math')).toBeTruthy();
    expect(render(React.createElement(Streamdown, {
      mode: 'static', plugins: { mermaid }, children: '```mermaid\nflowchart LR\nA-->B\n```',
    })).getByTestId('diagram')).toBeTruthy();
    expect(render(React.createElement(Streamdown, {
      mode: 'static', plugins: { cjk }, children: '中文_强调_中文',
    })).getByText('强调')).toBeTruthy();
  });

  // parity:095887568e9691482d005c12a1b988343b1acdc01ff23d185cfc70d4444cc9bd
  // parity:e27f2da69baa8fc2291257e40c6eaa58c53c115c6be93993c61056712608472e
  // parity:e58f997ce51ffe80a8be9ec0e153c4e6a2c7711d6ae7b73bfaf50d9090bf5598
  // parity:6993592da0638d729dfcd27784ad04e514f26791d6b3f56bdc3cc7a935bf1c2c
  it('returns no renderer for absent, empty, or nonmatching configuration', () => {
    expect(findCustomRenderer(undefined, 'vega')).toBeUndefined();
    expect(findCustomRenderer([], 'vega')).toBeUndefined();
    expect(findCustomRenderer([{ language: 'vega', component: Dummy }], '')).toBeUndefined();
    expect(findCustomRenderer([{ language: 'vega', component: Dummy }], 'd2')).toBeUndefined();
  });

  // parity:ac878c5a3825a9683746b643ae41c9f36b6d332116cadeff5140bfe4367bf5ea
  // parity:5a93d29f065f6a1fb64e8d3d0699b23016ac8a5df96a923bac93242882fdb9dc
  // parity:53f362286da6689254866f2d74202eb4ca1f1f1d427667ce26df22f00a36f603
  it('selects the first string or array language match', () => {
    const first = { language: 'vega', component: Dummy };
    const second = { language: ['vega', 'vega-lite'], component: Dummy };
    expect(findCustomRenderer([first, second], 'vega')).toBe(first);
    expect(findCustomRenderer([second], 'VEGA-LITE')).toBe(second);
  });
});
