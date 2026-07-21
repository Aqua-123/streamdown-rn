import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src';
import { SafeImage } from '../../../../src/controls/SafeImage';
import { defaultTranslations } from '../../../../src/controls/translations';
import { parseSemanticDocument } from '../../../../src/core/parser';
import { createCodePlugin } from '../../../../src/plugins/code';
import { createMermaidPlugin } from '../../../../src/plugins/mermaid';
import { createMathPlugin } from '../../../../src/plugins/math';
import { darkTheme } from '../../../../src/themes';

const h = React.createElement;

describe('remaining upstream coverage through native semantics', () => {
  it('renders an image-only paragraph as an accessible native image', () => {
    // parity:ee64a81c81141b4e6a613c2da6f38dca829dec5c73cddfa71e608bb5911f9987
    const screen = render(h(Streamdown, { mode: 'static' }, '![alt](https://example.com/img.png)'));
    expect(screen.getByRole('image', { name: 'alt' })).toBeTruthy();
    expect(screen.queryByText('[Image: alt]')).toBeNull();
  });

  it('keeps text paragraphs available to the p semantic override', () => {
    // parity:52996da3646c6291858225a4003a99ff068974f66ee121513f9e7da286c861f2
    const Paragraph = ({ children, semantic }: any) => h(Text, { testID: 'paragraph' }, semantic.type, ':', children);
    const screen = render(h(Streamdown, { mode: 'static', components: { p: Paragraph } }, 'Just some text'));
    expect(screen.getByTestId('paragraph')).toHaveTextContent('paragraph:Just some text');
  });

  it('honors per-action Mermaid control configuration', async () => {
    // parity:665a01d5c1e88e45eeb577bb8b71fb1f8208b00165900f2f0e19c75b2e7a4231
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: async () => ({ kind: 'native', content: h(Text, null, 'diagram') }) } });
    const screen = render(h(Streamdown, { mode: 'static', plugins: { mermaid: plugin }, controls: { mermaid: { copy: true, download: false, fullscreen: false, panZoom: false } } }, '```mermaid\nflowchart LR\nA-->B\n```'));
    await waitFor(() => expect(screen.getByText('diagram')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Copy diagram' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download diagram' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View fullscreen' })).toBeNull();
    expect(screen.queryByLabelText('Zoom')).toBeNull();
  });

  it('uses a synchronous code-provider result and its cache', () => {
    // parity:071dd605d249e5fb5d8d4aa3cead3fffceaa0a094a2d96487fa2eed74b5c0b90
    const highlight = jest.fn(() => ({ tokens: [[{ content: 'cached', color: '#f00' }]], bg: '#000', fg: '#fff' }));
    const plugin = createCodePlugin({ provider: { languages: ['js'], highlight } });
    const screen = render(h(Streamdown, { mode: 'static', plugins: { code: plugin } }, '```js\nconst x = 1;\n```'));
    expect(screen.getByText('cached')).toHaveStyle({ color: '#f00' });
    screen.rerender(h(Streamdown, { mode: 'static', plugins: { code: plugin } }, '```js\nconst x = 1;\n```'));
    expect(highlight).toHaveBeenCalledTimes(1);
  });

  it('preserves trailing whitespace under character animation', () => {
    // parity:a346e3bb6fdc635182645cbd63b85d249b771e9348c3d6f4e0a06d026bfb0f43
    const screen = render(h(Streamdown, { isAnimating: true, animated: { sep: 'char' }, reducedMotion: true }, 'A B '));
    expect(screen.getByText('A B ')).toBeTruthy();
  });

  it('does not animate inside a native math renderer', () => {
    // parity:e63fbacfa7e962dbc437a41cf48c9b2135c4f32b967ca0da62a238587aa542a0
    const renderMath = jest.fn(() => h(Text, { testID: 'math' }, 'equation'));
    const math = createMathPlugin({ singleDollarTextMath: true, adapter: { render: renderMath } });
    const screen = render(h(Streamdown, { mode: 'static', animated: { sep: 'char' }, plugins: { math } }, '$x^2$'));
    expect(screen.getByTestId('math')).toHaveTextContent('equation');
    expect(renderMath).toHaveBeenCalledWith(expect.objectContaining({ source: 'x^2', display: false }));
  });

  it('animates complex nested native content without losing siblings', () => {
    // parity:4b1ee800f37b770155525e06d9e604d64c0325f88fa882ec748d970b46892445
    const screen = render(h(Streamdown, { isAnimating: true, animated: true, reducedMotion: true }, '> Hello\n\n> World'));
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByText('World')).toBeTruthy();
  });

  it('keeps copy available after a completed native action', async () => {
    // parity:669051e2c9881f05177ca402eb798fd614d196bf935c5aed04a1c91c53036d96
    const writeText = jest.fn(() => ({ status: 'success' as const }));
    const screen = render(h(Streamdown, { mode: 'static', capabilities: { clipboard: { writeText } } }, '```text\ntest code\n```'));
    const copy = screen.getByRole('button', { name: 'Copy Code' });
    fireEvent.press(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(copy.props.accessibilityState).toMatchObject({ busy: false, disabled: false });
  });

  it('reports a rejected native clipboard action', async () => {
    // parity:c9218142b5fdaff30fab08b68c6b8ece03cb0cfdee848d30f7acfa8b222f1eb8
    const screen = render(h(Streamdown, { mode: 'static', capabilities: { clipboard: { writeText: async () => { throw new Error('Clipboard write failed'); } } } }, '```text\ntest code\n```'));
    fireEvent.press(screen.getByRole('button', { name: 'Copy Code' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Clipboard write failed'));
  });

  it('reports a native Markdown table save failure', async () => {
    // parity:d5420761bee463493be088fe8971f66b630e5d47e79732985e3974ef76a42623
    const screen = render(h(Streamdown, { mode: 'static', capabilities: { files: { save: () => { throw new Error('Markdown save failed'); } } } }, '| A | B |\n| --- | --- |\n| 1 | 2 |'));
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('button', { name: 'Download table as Markdown' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Markdown save failed'));
  });

  it('renders plain markdown when the tree has no HTML parent to escape', () => {
    // parity:c0d07698c90cba4ceb6c72b007d19e0651ddefa6f5e89158ed76bbf2ff3f33a6
    expect(render(h(Streamdown, { mode: 'static' }, 'Just text, no HTML')).getByText('Just text, no HTML')).toBeTruthy();
  });

  it('keeps void HTML elements inert and does not drop the block', () => {
    // parity:c629a23c00e1e097c9d2b38bc29de776b6584004bf7c97e3523480f6026ffd3e
    const root = parseSemanticDocument("<div><br/><hr/><img src='x'/></div>");
    expect(root.children).not.toHaveLength(0);
    expect(JSON.stringify(root)).toContain('<br/>');
  });

  it('moves an already available native image to loaded controls on load', () => {
    // parity:629e38e41056c0b8f4ae52038b6e5e41aea6d3b9b9151ac06849855dc2018c60
    const screen = render(h(SafeImage, { uri: 'https://example.com/cached.png', alt: 'test', theme: darkTheme, capabilities: { files: { save: jest.fn() } }, translations: defaultTranslations }));
    fireEvent(screen.getByRole('image'), 'load');
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
  });
});
