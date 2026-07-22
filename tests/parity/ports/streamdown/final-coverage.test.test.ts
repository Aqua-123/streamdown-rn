import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src';
import { SafeImage } from '../../../../src/controls/SafeImage';
import { PanZoomSurface } from '../../../../src/controls/PanZoomSurface';
import { defaultTranslations } from '../../../../src/controls/translations';
import { createMermaidPlugin } from '../../../../src/plugins/mermaid';
import { darkTheme } from '../../../../src/themes';

const h = React.createElement;

const imageProps = {
  uri: 'https://example.com/cached.png',
  alt: 'cached',
  theme: darkTheme,
  translations: defaultTranslations,
};

describe('final upstream coverage through native semantics', () => {
  // parity:07035c5e3639c0e679e860cbd6460c7c28054468b54715f29543d7fa43fda715
  it('treats a native load event as a ready cached image', () => {
    const save = jest.fn();
    const screen = render(h(SafeImage, { ...imageProps, capabilities: { files: { save }, imageDownloads: { download: jest.fn() } } }));
    fireEvent(screen.getByRole('image', { name: 'cached' }), 'load');
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
  });

  // parity:ff5ba023dfebe333a74bde72c0713669862416ead1d64c8d7118f66dd56afc8a
  it('renders no native image when markdown has no source', () => {
    const screen = render(h(Streamdown, { mode: 'static' }, '![no-src]()'));
    expect(screen.queryByRole('image')).toBeNull();
  });

  // parity:7f35fc30dc6c78a0499e710dd4b1f8fcca4ee1e5d32a69635746a6583d64804f
  it('moves a failed cached image to the accessible retry state', () => {
    const screen = render(h(SafeImage, { ...imageProps, capabilities: {} }));
    fireEvent(screen.getByRole('image'), 'error');
    expect(screen.getByText('Image not available')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry image' })).toBeTruthy();
  });

  it('disables failed-image retry while streaming controls are disabled', () => {
    const screen = render(h(SafeImage, { ...imageProps, capabilities: {}, disabled: true }));
    fireEvent(screen.getByRole('image'), 'error');
    expect(screen.getByRole('button', { name: 'Retry image' }).props.accessibilityState.disabled).toBe(true);
  });

  // parity:9a8b67a561acc14d43118bf66ec990c4349af003d348a340a40aaa1c7974962b
  it('hides Mermaid controls and pan/zoom when the family is disabled', async () => {
    const plugin = createMermaidPlugin({ adapter: {
      families: ['flowchart'],
      render: async () => ({ kind: 'native', content: h(Text, null, 'diagram') }),
    } });
    const screen = render(h(Streamdown, { mode: 'static', plugins: { mermaid: plugin }, controls: { mermaid: false } }, '```mermaid\nflowchart LR\nA-->B\n```'));
    await waitFor(() => expect(screen.getByText('diagram')).toBeTruthy());
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByLabelText('Zoom')).toBeNull();
  });

  // parity:95d28942ed74aad6de44e0c2094f3e46678da9aa3dc556b7d1cb657b0dbfa3c6
  it('shows Mermaid pan/zoom when the family is enabled', async () => {
    const plugin = createMermaidPlugin({ adapter: {
      families: ['flowchart'],
      render: async () => ({ kind: 'native', content: h(Text, null, 'diagram') }),
    } });
    const screen = render(h(Streamdown, { mode: 'static', plugins: { mermaid: plugin }, controls: { mermaid: true }, capabilities: { gestures: { renderPanZoom: ({ children }) => children } } }, '```mermaid\nflowchart LR\nA-->B\n```'));
    await waitFor(() => expect(screen.getByLabelText('Zoom')).toBeTruthy());
  });

  // parity:fd0e1a28df5b6f5166e0a2ad623d8734606c905b13247c81be3f1fd5f9a9299e
  it('defaults undefined Mermaid control configuration to enabled', async () => {
    const plugin = createMermaidPlugin({ adapter: {
      families: ['flowchart'],
      render: async () => ({ kind: 'native', content: h(Text, null, 'diagram') }),
    } });
    const screen = render(h(Streamdown, { mode: 'static', plugins: { mermaid: plugin }, controls: {}, capabilities: { gestures: { renderPanZoom: ({ children }) => children } } }, '```mermaid\nflowchart LR\nA-->B\n```'));
    await waitFor(() => expect(screen.getByLabelText('Zoom')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'View fullscreen' })).toBeTruthy();
  });

  it('ignores unrelated accessibility actions while not zooming', () => {
    // parity:50b460bf65810234c75411008dfc53c39818094fbe46772574f111bde20cd9bd
    const screen = render(h(PanZoomSurface, {
      capabilities: { gestures: { renderPanZoom: ({ children }) => children } },
      children: h(Text, null, 'content'),
    }));
    const adjustable = screen.getByLabelText('Zoom');
    fireEvent(adjustable, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(adjustable.props.accessibilityValue.now).toBe(1);
  });

  // parity:f21afb7e2970b7f60e6a62418e3f0e06fdcfb22c4f45bf52cf5e9713dc1f21c0
  it('reports a thrown native table save through the accessible error state', async () => {
    const screen = render(h(Streamdown, { mode: 'static', capabilities: { files: { save: () => { throw new Error('Download failed'); } } } }, '| A |\n| --- |\n| Data |'));
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Download failed'));
  });

  // parity:0372750b061bbb24b8f5a777220d94f508d60e1746478827db8fd5e3b59370ce
  it('extracts fenced code into a native semantic pre override', () => {
    const Pre = ({ children, semantic }: any) => h(Text, { testID: 'pre' }, semantic.language, ':', children);
    const screen = render(h(Streamdown, { mode: 'static', components: { pre: Pre } }, '```javascript\nconst x = 42;\n```'));
    expect(screen.getByTestId('pre')).toHaveTextContent('javascript:const x = 42;');
  });
});
