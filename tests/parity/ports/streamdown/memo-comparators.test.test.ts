import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src';
import { controlEnabled } from '../../../../src/controls';

describe('native memo comparator outcomes', () => {
  it.each([
    ['parity:d4b9213ba6f42cc3fa57945f3b0d9449c22344addb516d4701cbdaec53604fbe', '`code`', 'inlineCode'],
    ['parity:388290e8650b64c54e71ae992c76658ea5ed4671c866efa0de0737314c69e491', '![alt](https://example.com/a.png)', 'img'],
  ] as const)('%s skips unchanged %s output', (_marker, markdown, key) => {
    let renders = 0;
    const Override = (props: { children?: React.ReactNode }) => { renders++; return React.createElement(Text, null, props.children ?? 'image'); };
    const components = { [key]: Override };
    const screen = render(React.createElement(Streamdown, { components, mode: 'static' }, markdown));
    const before = renders;
    screen.rerender(React.createElement(Streamdown, { components, mode: 'static' }, markdown));
    expect(renders).toBe(before);
  });

  it('renders the native footnote section', () => {
    // parity:452699e53de63a2f98bb3fc32e7d6756cc2dcbe3e40e4959f419e9711b82901c
    expect(render(React.createElement(Streamdown, { mode: 'static' }, 'ref[^n]\n\n[^n]: note')).getByLabelText('Footnote n')).toBeTruthy();
  });

  it('does not wrap block code as paragraph text', () => {
    // parity:7dd7b6999d9b430dc9c90f44675e77cc8727e705eefa509dc978f997c3d563ec
    expect(render(React.createElement(Streamdown, { mode: 'static' }, '```\nblock\n```')).getByText('block')).toBeTruthy();
  });

  it('passes extracted inline-code text to native overrides', () => {
    // parity:2d811f45fea528bea203f5bda58c6964de94826f291ae70a81e51290eb2caf8d
    const Override = ({ semantic }: { semantic: { value?: string } }) => React.createElement(Text, null, semantic.value);
    expect(render(React.createElement(Streamdown, { components: { inlineCode: Override as never }, mode: 'static' }, '`value`')).getByText('value')).toBeTruthy();
  });

  it('honors nested native Mermaid pan/zoom configuration', () => {
    // parity:c16e0cb5bfe707ecb296aecfdf667baeebdc241a7532023272166ebcd5fd220f
    expect(controlEnabled({ mermaid: { panZoom: false } }, 'mermaid', 'panZoom')).toBe(false);
    expect(controlEnabled({ mermaid: { panZoom: false } }, 'mermaid', 'copy')).toBe(true);
  });
});
