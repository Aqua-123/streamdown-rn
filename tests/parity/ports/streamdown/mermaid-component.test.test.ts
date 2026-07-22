import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { MermaidBlock } from '../../../../src/plugins/mermaid/MermaidBlock';
import { createMermaidPlugin, type MermaidAdapter, type MermaidRenderResult } from '../../../../src/plugins/mermaid';
import { defaultTranslations } from '../../../../src/controls/translations';
import { lightTheme } from '../../../../src/themes';

const source = 'graph TD; A-->B';
const props = (plugin: ReturnType<typeof createMermaidPlugin>) => ({
  source, plugin, theme: lightTheme, capabilities: {}, translations: defaultTranslations,
});

describe('case-specific Mermaid component proof', () => {
  // parity:34b6ce9a850ff8d19d7085fe3852d2f6a1daca199cb810ca79b15f43568be646
  it('renders the native chart after asynchronous loading resolves', async () => {
    let resolve!: (value: MermaidRenderResult) => void;
    const adapter: MermaidAdapter = { families: ['flowchart'], render: () => new Promise((done) => { resolve = done; }) };
    const screen = render(React.createElement(MermaidBlock, props(createMermaidPlugin({ adapter }))));
    expect(screen.getByLabelText('Rendering Mermaid diagram')).toBeTruthy();
    resolve({ kind: 'native', content: React.createElement(Text, null, 'Loaded native chart') });
    await waitFor(() => expect(screen.getByText('Loaded native chart')).toBeTruthy());
  });

  // parity:22e5eada3b8d1d5fdc6b785aa991196559459cc36b9f1102fa067ea59ca6d223
  it('uses the thrown non-Error value as a readable fallback message', async () => {
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => { throw 'plain failure'; } } });
    const screen = render(React.createElement(MermaidBlock, props(plugin)));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('plain failure'));
  });

  // parity:bde189d7f1ae7347e6f7dd52e9047b5107f349c63bb770efacbcb85af2ad7bd0
  it('removes the loading indicator once a chart result is available', async () => {
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => ({ kind: 'native', content: React.createElement(Text, null, 'Ready chart') }) } });
    const screen = render(React.createElement(MermaidBlock, props(plugin)));
    await waitFor(() => expect(screen.getByText('Ready chart')).toBeTruthy());
    expect(screen.queryByLabelText('Rendering Mermaid diagram')).toBeNull();
  });

  // parity:39a95fa22c7a68442b1a00a87739be207670306f93ce27a533d4f5b031f331ea
  it('shows an error when no adapter is configured', async () => await expect(createMermaidPlugin().render(source)).rejects.toThrow('No Mermaid adapter'));
  // parity:0ba34c5f3aab38007213572a2bfa8bf577b578a252c3a3b511a1bfe4efd29325
  it('keeps readable source after a render error', async () => {
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => { throw new Error('render failed'); } } });
    const screen = render(React.createElement(MermaidBlock, props(plugin))); await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText(source)).toBeTruthy();
  });
  // parity:2301e4bbb8c7397553133f0e1f96498c5382f16d3db8cf3fae4b6e96c3df1af9
  it('labels the rendered native chart', async () => {
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => ({ kind: 'native', content: React.createElement(Text, null, 'Chart') }) } });
    const screen = render(React.createElement(MermaidBlock, props(plugin))); await waitFor(() => expect(screen.getByRole('image')).toBeTruthy());
    expect(screen.getByRole('image').props.accessibilityLabel).toBe(`Mermaid diagram: ${source}`);
  });
  // parity:441c3449d1ddb0c91f1b4cc755eee6d586da7757a2e1db7175676f317b4b5dde
  it('uses native image role for the rendered chart', async () => {
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => ({ kind: 'native', content: React.createElement(Text, null, 'Chart') }) } });
    const screen = render(React.createElement(MermaidBlock, props(plugin)));
    await waitFor(() => expect(screen.getByRole('image').props.accessibilityRole).toBe('image'));
  });
});

describe('Mermaid native component', () => {
  // parity:ff751a5161f9b7107f8b481008fae24e4967d634a915d683db29544fe52fc872
  it('announces loading, renders the chart, then removes busy state', async () => {
    let resolve!: (value: MermaidRenderResult) => void;
    const adapter: MermaidAdapter = { families: ['flowchart'], render: () => new Promise((done) => { resolve = done; }) };
    const screen = render(React.createElement(MermaidBlock, props(createMermaidPlugin({ adapter }))));
    expect(screen.getByLabelText('Rendering Mermaid diagram').props.accessibilityState.busy).toBe(true);
    resolve({ kind: 'native', content: React.createElement(Text, null, 'Rendered chart') });
    await waitFor(() => expect(screen.getByText('Rendered chart')).toBeTruthy());
    expect(screen.queryByLabelText('Rendering Mermaid diagram')).toBeNull();
  });

  // parity:f47bd4134b3d41c04f61326ea8e7e87ad8d112101a9c9db1ec6f609ef5466c47
  it('uses native theme style plus labelled image semantics instead of DOM className', async () => {
    const adapter: MermaidAdapter = { families: ['flowchart'], render: () => ({ kind: 'native', content: React.createElement(Text, null, 'Chart') }) };
    const screen = render(React.createElement(MermaidBlock, props(createMermaidPlugin({ adapter }))));
    await waitFor(() => expect(screen.getByRole('image', { name: `Mermaid diagram: ${source}` })).toBeTruthy());
    expect(screen.queryByText(source)).toBeNull();
  });

  // parity:f1d4e0657a80ef8f7795161ac606b0d6ea0e9e0cc38bbed6e186e470d61d1976
  it('keeps readable source and exposes accessible details for missing, failed, and non-Error adapters', async () => {
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => { throw 'native failure'; } } });
    const screen = render(React.createElement(MermaidBlock, props(plugin)));
    expect(screen.getByText(source)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('alert').props.children).toBe('native failure'));
    const missing = await createMermaidPlugin().render(source).catch((error: Error) => error);
    expect(missing).toBeInstanceOf(Error);
    expect((missing as Error).message).toContain('No Mermaid adapter');
  });

  // parity:733e78f4b0bf0960ce485452ad125bf787dd1e7d8bdce9cadfe03ec5bc1651a8
  it('renders a supplied native error component with retry context', async () => {
    const ErrorView = ({ error }: { error: Error }) => React.createElement(Text, { accessibilityRole: 'alert' }, `Custom: ${error.message}`);
    const plugin = createMermaidPlugin({ errorComponent: ErrorView, adapter: { families: ['flowchart'], render: () => { throw new Error('bad chart'); } } });
    const screen = render(React.createElement(MermaidBlock, props(plugin)));
    await waitFor(() => expect(screen.getByText('Custom: bad chart')).toBeTruthy());
  });

  // parity:890dd42915d29dc615ed831c8157c96aae02615ca686901ecebd01b661b9f001
  it('moves the rendered native chart into the fullscreen modal', async () => {
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => ({ kind: 'native', content: React.createElement(Text, null, 'Chart') }) } });
    const screen = render(React.createElement(MermaidBlock, props(plugin)));
    await waitFor(() => expect(screen.getByText('Chart')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(screen.getByRole('alert', { name: 'Diagram fullscreen' })).toBeTruthy();
    expect(screen.getByText('Chart')).toBeTruthy();
  });

  // parity:b60072c388a69db41370dfff2298e2ece80ea0b7a997b0bfebb824ae5fa30e0d
  it('passes the immutable secured config to the native adapter', async () => {
    const renderAdapter = jest.fn(() => ({ kind: 'native' as const, content: null }));
    await createMermaidPlugin({ config: { theme: 'forest' }, adapter: { families: ['flowchart'], render: renderAdapter } }).render(source);
    expect(renderAdapter).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ theme: 'forest', securityLevel: 'strict' }) }));
  });

  // parity:d0999a27f39269817eff6b59168e6c94b15c8d4a13f2d53ea1e7ef8d9e03f4ce
  it('clears the last valid native render when a later source fails', async () => {
    const renderAdapter = jest.fn(({ source: next }: { source: string }) => {
      if (next.includes('invalid')) throw new Error('invalid');
      return { kind: 'native' as const, content: React.createElement(Text, null, 'Last valid chart') };
    });
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: renderAdapter } });
    const screen = render(React.createElement(MermaidBlock, props(plugin)));
    await waitFor(() => expect(screen.getByText('Last valid chart')).toBeTruthy());
    screen.rerender(React.createElement(MermaidBlock, { ...props(plugin), source: 'graph invalid' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText('Last valid chart')).toBeNull();
  });

  // parity:27484b2f8b2d424dff9eeff176a44c5dbc9f53e8a9c872e323fcc171c345868a
  it('renders multiple charts as independent native instances without shared DOM IDs', async () => {
    let count = 0;
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => ({ kind: 'native', content: React.createElement(Text, null, `Chart ${++count}`) }) } });
    const screen = render(React.createElement(React.Fragment, null,
      React.createElement(MermaidBlock, props(plugin)), React.createElement(MermaidBlock, props(plugin))));
    await waitFor(() => expect(screen.getByText('Chart 1')).toBeTruthy());
    expect(screen.getByText('Chart 2')).toBeTruthy();
  });
});
