import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Modal, Text } from 'react-native';
import { MermaidBlock } from '../../../../src/plugins/mermaid/MermaidBlock';
import {
  createMermaidPlugin,
  type MermaidAdapter,
  type MermaidRenderRequest,
  type MermaidRenderResult,
} from '../../../../src/plugins/mermaid';
import { defaultTranslations } from '../../../../src/controls/translations';
import { lightTheme } from '../../../../src/themes';
import type { CapabilityResult, NativeFileRequest } from '../../../../src/platform/capabilities';

const source = 'graph TD; A-->B';
const adapter = (render?: MermaidAdapter['render']): MermaidAdapter => ({
  families: ['flowchart'],
  render: render ?? (() => ({
    kind: 'native',
    content: React.createElement(Text, null, 'Native diagram'),
    svg: '<svg><path d="M0 0"/></svg>',
    png: new Uint8Array([137, 80, 78, 71]),
  })),
});
const block = (plugin: ReturnType<typeof createMermaidPlugin>, extra = {}) => React.createElement(MermaidBlock, {
  source, plugin, theme: lightTheme, capabilities: {}, translations: defaultTranslations, ...extra,
});

describe('Mermaid public native behavior', () => {
  // parity:48180259e4995b1da4207a6ba351dd33f2a82b2bd882850e17bc8e3c8aea3523
  // parity:aeae5fca691f2b8d8f4bd506a46d9d562405adeb21f4c00576faf2f741f7911d
  it('renders without crashing and applies native theme styling instead of className', async () => {
    const screen = render(block(createMermaidPlugin({ adapter: adapter() })));
    await waitFor(() => expect(screen.getByRole('image', { name: 'Mermaid diagram' })).toBeTruthy());
    expect(screen.getByText(source).props.style).toMatchObject({ color: lightTheme.colors.muted, fontFamily: lightTheme.fonts.mono });
  });

  // parity:d1784e4b85b0cd2d2045af0f4aec93f86718d2dd56113225f8e1e0affc203ee2
  // parity:fcb5b3363efc1f1408f749fe06f4250caa21f7ebbaeaac63bb2345eaf7f42c11
  // parity:f6b5faa50194d6b40071d4679ad35a9c401aa63f2f2c4a63ff383f3f4df1fd97
  it('merges default and custom config while enforcing strict security fields', async () => {
    const customRender = jest.fn<MermaidRenderResult, [MermaidRenderRequest]>(() => ({ kind: 'native', content: null }));
    const custom = createMermaidPlugin({ config: { theme: 'forest', flowchart: { curve: 'basis' } }, adapter: adapter(customRender) });
    await custom.render(source);
    expect(customRender).toHaveBeenCalledWith(expect.objectContaining({ config: {
      theme: 'forest', fontFamily: 'monospace', flowchart: { curve: 'basis' },
      startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
    } }));
    const defaultRender = jest.fn<MermaidRenderResult, [MermaidRenderRequest]>(() => ({ kind: 'native', content: null }));
    await createMermaidPlugin({ adapter: adapter(defaultRender) }).render(source);
    const defaultRequest = defaultRender.mock.calls[0]?.[0];
    if (!defaultRequest) throw new Error('Expected the default adapter to render');
    expect(defaultRequest.config).toMatchObject({ theme: 'default', fontFamily: 'monospace' });
  });

  // parity:d9f02e477f060ee8b12f230fa4b0a3477adbe2fc54366ebac9b780e0e4f1c8a7
  it('rejects function-valued config rather than executing untrusted browser callbacks', () => {
    expect(() => createMermaidPlugin({ config: { callback: () => 'unsafe' } })).toThrow('only JSON values');
  });

  // parity:5d164e6cc19feb5a1d187c095a93ef563a1784dc214172d649913d4ce5812ef8
  it('keeps config isolated across plugin instances', async () => {
    const first = jest.fn<MermaidRenderResult, [MermaidRenderRequest]>(() => ({ kind: 'native', content: null }));
    const second = jest.fn<MermaidRenderResult, [MermaidRenderRequest]>(() => ({ kind: 'native', content: null }));
    await Promise.all([
      createMermaidPlugin({ config: { theme: 'dark' }, adapter: adapter(first) }).render(source),
      createMermaidPlugin({ config: { theme: 'forest' }, adapter: adapter(second) }).render(source),
    ]);
    const firstRequest = first.mock.calls[0]?.[0];
    const secondRequest = second.mock.calls[0]?.[0];
    if (!firstRequest || !secondRequest) throw new Error('Expected both adapters to render');
    expect(firstRequest.config.theme).toBe('dark');
    expect(secondRequest.config.theme).toBe('forest');
  });

  // parity:afed512e7adb0fffcbe3918d108f7ecc1248e4b0ac05a2b27759b06a3101e2c2
  // parity:90b5b06cad701c511527475bbbbd4534de04ec3aafa202168e8dd389f35b1935
  // parity:12cea3c7c7733e3d638cebb526c79510c504c1d1ec11052258c91430b4afac65
  it('opens and closes a native fullscreen modal from accessible buttons', async () => {
    const screen = render(block(createMermaidPlugin({ adapter: adapter() })));
    await waitFor(() => expect(screen.getByText('Native diagram')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(screen.getByRole('alert', { name: 'Diagram fullscreen' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Exit fullscreen' }));
    expect(screen.queryByRole('alert', { name: 'Diagram fullscreen' })).toBeNull();
  });

  // parity:a331e5d04164eac08675d152f70827675c8c6a6c0b2b0d5cd504d125b7043ce5
  // parity:ba0b1352363bdee49ab821a35f35cda1db44d85b5b8e55e14410d5f523944ed4
  // parity:754b84f6d19de601e8315d20f2a15b9174850bcdee37fe5f121c5bc5641e1ef9
  // parity:61732dedcf7455b234a6d3d3c1ccb1bda22244b3229bd663a8fc9139c9b52f28
  it('uses native modal isolation and system-request close rather than DOM Escape/backdrop/body mutations', async () => {
    const screen = render(block(createMermaidPlugin({ adapter: adapter() })));
    await waitFor(() => expect(screen.getByText('Native diagram')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props).toMatchObject({ visible: true, transparent: false });
    fireEvent(screen.getByText('Native diagram'), 'press');
    expect(screen.getByRole('alert', { name: 'Diagram fullscreen' })).toBeTruthy();
    fireEvent(modal, 'requestClose');
    expect(screen.queryByRole('alert', { name: 'Diagram fullscreen' })).toBeNull();
  });

  // parity:b984647fc8e2bf177dbca9233c55343423913d34a9a5030f290fed22b252ee43
  // parity:7e293654c5ba97c0a587f4ea36d096f688b7d98309ab93a6b14e1168a30baa8d
  // parity:1d5ca25b6be182f130915af4ef02c9d2fd60e9923d6b0a50bc72b98edc251f84
  it('saves source, sanitized SVG, and adapter-provided PNG through native capabilities', async () => {
    const save = jest.fn<CapabilityResult, [NativeFileRequest]>(() => ({ status: 'success' }));
    const screen = render(block(createMermaidPlugin({ adapter: adapter() }), { capabilities: { files: { save } } }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download diagram as PNG' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Download diagram as MMD' }));
    fireEvent.press(screen.getByRole('button', { name: 'Download diagram as SVG' }));
    fireEvent.press(screen.getByRole('button', { name: 'Download diagram as PNG' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(save.mock.calls.map(([request]) => request.extension)).toEqual(['mmd', 'svg', 'png']);
  });

  // parity:966d4accc243bbda8b872753588e51e0a2ef9951af2a464e64384dbe3168d204
  it('reports render failures through onError while retaining readable source', async () => {
    const onError = jest.fn();
    const plugin = createMermaidPlugin({ onError, adapter: { families: ['flowchart'], render: () => { throw new Error('render failed'); } } });
    const screen = render(block(plugin));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'render failed' })));
    expect(screen.getByText(source)).toBeTruthy();
  });
});
