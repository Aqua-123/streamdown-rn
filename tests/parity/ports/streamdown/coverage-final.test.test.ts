import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { Streamdown } from '../../../../src';
import { parseSemanticDocument } from '../../../../src/core/parser';
import { processNewContent } from '../../../../src/core/splitter';
import { INITIAL_REGISTRY } from '../../../../src/core/types';

const h = React.createElement;

describe('final coverage native adaptations', () => {
  it('keeps direct, nested, formatted, and null-adjacent footnote content', () => {
    // parity:36273ddec26dc7c2a8fe67dfe300387df0b46dbe3df9877b5ab196079d2ca085
    // parity:b376ddce1d0b350779d9a68b927c97d920b870284b415c367f1b9340e11c5803
    // parity:d087ef1926e3711935392fda8a4eadad6371a495113c3c63f5100335d9a190d7
    // parity:513c30fd1005122922a72332a7a7267c2563438eb4146082d34c9f292ee52a7b
    // parity:86d42c964a5afa807ca6c9a4011ea27e737e7a7056610e8be460450cd26cf0b7
    const markdown = 'Direct[^a] and nested[^b].\n\n[^a]: Actual footnote content\n[^b]: **Bold text** and Some footnote text';
    const screen = render(h(Streamdown, { mode: 'static' }, markdown));
    expect(screen.getByText(/Actual footnote content/)).toBeTruthy();
    expect(screen.getByText('Bold text')).toBeTruthy();
    expect(screen.getByText(/Some footnote text/)).toBeTruthy();
    expect(screen.getByLabelText('Footnote a')).toBeTruthy();
  });

  it('extracts fenced code into the native code renderer', () => {
    // parity:699c242e7ddfe03171f2306ed98f94617ce69574abd65727567d1da87c74365f
    const screen = render(h(Streamdown, { mode: 'static' }, '```javascript\nconst x = 42;\n```'));
    expect(screen.getByText('const x = 42;')).toBeTruthy();
    expect(screen.getByText('javascript')).toBeTruthy();
  });

  it('models native image load and cached-failure outcomes accessibly', () => {
    // parity:2e344fa70c6a55a30c28578820e92ba19c7c1a1151c595ad9f1f54e49451cc46
    // parity:9607fa04301b3472463cd82d206060501e3b8d86f7fe310e382ffdb056f18e8c
    const save = jest.fn(async () => ({ status: 'success' as const }));
    const screen = render(h(Streamdown, { mode: 'static', capabilities: { files: { save } } }, '![cached](https://example.com/cached.png)'));
    const image = screen.getByRole('image', { name: 'cached' });
    fireEvent(image, 'load');
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
    fireEvent(image, 'error');
    expect(screen.getByText('Image not available')).toBeTruthy();
  });

  it('does not merge content after HTML void elements', () => {
    // parity:eb8602d4d80fc169cf476882328708e6a6d0f05520c5a818c109612bb9323631
    // parity:3b00d29f41be8a1ec4fb9730e57fd088c24ac78d72d898581bc95624d9daec7a
    // parity:2e9b9032a10769431ea803e3c83e3ff1649e7267b1445732490b2f0d7afffbb3
    for (const tag of ['<br>', '<img src="test.png">', '<hr>']) {
      const source = `${tag}\n\nContent after void.`;
      const registry = processNewContent(INITIAL_REGISTRY, source);
      expect(`${registry.blocks.map((block) => block.content).join('\n')}\n${registry.activeBlock?.content ?? ''}`).toContain('Content after void.');
      expect(render(h(Streamdown, { mode: 'static' }, source)).getByText('Content after void.')).toBeTruthy();
    }
  });

  it('reports native table-save failures through deterministic accessible feedback', async () => {
    // parity:e579b579ce0d1eaf91d14ab6c047007751121fd06e1d418373b9ad79136a6403
    const screen = render(h(Streamdown, { mode: 'static', capabilities: { files: { save: async () => { throw new Error('save failed'); } } } }, '| A |\n| - |\n| data |'));
    fireEvent.press(screen.getByRole('button', { name: 'Download table as CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('save failed');
  });

  it('preserves table row and cell semantics across parent rerenders', () => {
    // parity:dd91cc0b02eae35386528a4c2c07a6767a507ea361d1249a59fb290919d8a028
    // parity:a585e0eb3de940feedf8adb8f4d8d3369ae1de4bf77638ff4a08626b000527f5
    // parity:2e5115c0060e6169359a70ffae6bd915cdb9bab721d4708bf333d02789df443b
    const Cell = ({ children, semantic }: any) => h(Text, { testID: semantic.type }, children);
    const Row = ({ children }: any) => h(View, { testID: 'row' }, children);
    const props = { mode: 'static' as const, components: { tr: Row, td: Cell } };
    const screen = render(h(Streamdown, props, '| H |\n| - |\n| cell |'));
    expect(screen.getAllByTestId('row')).toHaveLength(2);
    screen.rerender(h(Streamdown, { ...props, style: { padding: 1 } }, '| H |\n| - |\n| cell |'));
    expect(screen.getByText('H')).toBeTruthy();
    expect(screen.getByText('cell')).toBeTruthy();
  });

  it('handles an invalid non-function plugin defensively before parsing', () => {
    // parity:0f7ea229cab0b37f3b782a8c1db19bcd43e85ac9ff41c1fd798feeb11421ff5b
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseSemanticDocument('Hello', { supplied: [['string-plugin' as never, { test: true }]] }).children).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps raw HTML inert by default and removes it with skipHtml', () => {
    // parity:e154023925baa70bc1ccae617e4021577c2529578ff9a0ad962a6b85791ddd7e
    // parity:a20a2a160b169e6b65eca676d889d2e86dbeaa418833cdf5ada1a52e76fe5edf
    const shown = render(h(Streamdown, { mode: 'static' }, '<b>test</b>'));
    expect(shown.getByText('<b>test</b>')).toBeTruthy();
    const hidden = render(h(Streamdown, { mode: 'static', skipHtml: true }, '<b>test</b>'));
    expect(hidden.queryByText(/<b>/)).toBeNull();
  });

  it('defaults Mermaid controls on when the family key is omitted', () => {
    // parity:b2098b403864b26a9732b51d9c3e052b5fcdaae7c6c2be05a9a778af602589cb
    const Diagram = ({ source, controls }: any) => h(Text, { testID: controls?.mermaid === undefined ? 'default-controls' : 'configured-controls' }, source);
    const plugin = { name: 'mermaid', type: 'diagram', language: 'mermaid', component: Diagram, render: jest.fn() } as any;
    const screen = render(h(Streamdown, { mode: 'static', controls: {}, plugins: { mermaid: plugin } }, '```mermaid\ngraph TD; A-->B\n```'));
    expect(screen.getByTestId('default-controls')).toHaveTextContent('graph TD; A-->B');
  });
});
