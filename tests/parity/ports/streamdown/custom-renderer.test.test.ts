import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';

const Renderer = ({ code, language, isIncomplete, meta }: {
  code: string; language: string; isIncomplete: boolean; meta?: string;
}) => React.createElement(Text, { testID: `renderer-${language}` }, `${code}|${isIncomplete}|${String(meta)}`);

describe('adapted native custom renderers', () => {
  // parity:1b58d1122e379b831e5628d23b28f62cedd106233f06d4d8650854cdc89b0ec5
  // parity:401b017eb6df155ad93751c500dc9a379eb1e3cfaafc0948ab2aa04fa504aab5
  // parity:ba65b7188d0a2d1e27321d3a33d5e739cdc6d40b71689e60e7a59c86ab8648cf
  // parity:9caa53a2495d78c1ff394664554ae6af8e31405eaca4bcc3babb6454ccb77a92
  it('accepts upstream renderer arrays and passes native fence data', () => {
    const withMeta = render(React.createElement(Streamdown, {
      mode: 'static',
      plugins: { renderers: [{ language: 'vega', component: Renderer }] },
      children: '```vega title="chart"\nmark\n```',
    }));
    expect(withMeta.getByTestId('renderer-vega').props.children).toBe('mark|false|title="chart"');

    const withoutMeta = render(React.createElement(Streamdown, {
      mode: 'static',
      plugins: { renderers: [{ language: 'rust', component: Renderer }] },
      children: '```rust\nlet x = 1;\n```',
    }));
    expect(withoutMeta.getByTestId('renderer-rust').props.children).toBe('let x = 1;|false|undefined');
  });

  // parity:8a54b8075e77946166e11dd1876fce481bd43e0c0e22b6a0be12010de0d9cfb5
  // parity:2a61eca525a39623771141c9c15c466611300160609549976d863a4ee1ada93b
  it('keeps nonmatching and unconfigured code on the native fallback', () => {
    const configured = render(React.createElement(Streamdown, {
      mode: 'static',
      plugins: { renderers: [{ language: 'vega', component: Renderer }] },
      children: '```js\ncode\n```',
    }));
    expect(configured.queryByTestId('renderer-js')).toBeNull();
    expect(configured.getByText('code')).toBeTruthy();

    const plain = render(React.createElement(Streamdown, { mode: 'static', children: '```js\nplain\n```' }));
    expect(plain.getByText('plain')).toBeTruthy();
  });

  // parity:cbf2d2fd9150a0c1f9aa116060856bcfca89b1d632eabfa939730eeefc8d1d24
  // parity:9f0b7c6f28f120379ef3566ff626798ab77d30fe7c0ee102590efe1893d94a63
  it('matches multiple renderers and language arrays independently', () => {
    const result = render(React.createElement(Streamdown, {
      mode: 'static',
      plugins: { renderers: [
        { language: ['vega', 'vega-lite'], component: Renderer },
        { language: 'd2', component: Renderer },
      ] },
      children: '```vega-lite\na\n```\n\n```d2\nb\n```',
    }));
    expect(result.getByTestId('renderer-vega-lite')).toBeTruthy();
    expect(result.getByTestId('renderer-d2')).toBeTruthy();
  });
});
