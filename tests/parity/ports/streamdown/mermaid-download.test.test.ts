import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { MermaidBlock } from '../../../../src/plugins/mermaid/MermaidBlock';
import { createMermaidPlugin, mermaidFileRequest } from '../../../../src/plugins/mermaid';
import { defaultTranslations } from '../../../../src/controls/translations';
import { lightTheme } from '../../../../src/themes';
import type { CapabilityResult, NativeFileRequest } from '../../../../src/platform/capabilities';

const source = 'graph TD; A-->B';
const result = { kind: 'native' as const, content: React.createElement(Text, null, 'Chart'), svg: '<svg></svg>', png: new Uint8Array([1, 2, 3]) };
const renderBlock = (extra = {}) => {
  const save = jest.fn<CapabilityResult, [NativeFileRequest]>(() => ({ status: 'success' }));
  const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => result } });
  return { save, screen: render(React.createElement(MermaidBlock, {
    source, plugin, theme: lightTheme, capabilities: { files: { save } }, translations: defaultTranslations, ...extra,
  })) };
};

describe('Mermaid native downloads', () => {
  // parity:b059ab0f729b96460aa30f1651ac3c084fd3d1d19c808f7a00d2e2a1f10f5433
  // parity:482a1a7588e71a5bdaf9aafe2255e4003f7d1679406ec98badfa499cf62d023c
  it('opens one download menu with only the available formats', async () => {
    const { screen } = renderBlock();
    await waitFor(() => expect(screen.getByText('Chart')).toBeTruthy());
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Download diagram' }));
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'menu' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Download diagram as SVG' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Download diagram as MMD' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Download diagram as PNG' })).toBeTruthy();
  });

  // parity:6f7271eac73df04250edc95e1063decbca06fd67c0f4f9c80c6c496b325ec7bd
  // parity:e63daa3212f9a3378a6b4ed020b57bda1ee916b2e82ac9684a4ce38437df7697
  // parity:c7a846154dd23ab9779867955db79c8189c34230d26eebf1233df2f5f110aa53
  it('sends exact MMD, SVG, and PNG payloads to the native file capability', async () => {
    const { save, screen } = renderBlock();
    await waitFor(() => expect(screen.getByText('Chart')).toBeTruthy());
    for (const [index, name] of ['Download diagram as MMD', 'Download diagram as SVG', 'Download diagram as PNG'].entries()) {
      fireEvent.press(screen.getByRole('button', { name: 'Download diagram' }));
      fireEvent.press(screen.getByRole('menuitem', { name }));
      await waitFor(() => expect(save).toHaveBeenCalledTimes(index + 1));
    }
    expect(save.mock.calls[0][0]).toMatchObject({ extension: 'mmd', content: source });
    expect(save.mock.calls[1][0]).toMatchObject({ extension: 'svg', content: '<svg></svg>' });
    expect(save.mock.calls[2][0]).toMatchObject({ extension: 'png', content: result.png });
  });

  // parity:cb2f29da43db155a83f8d059ea3528bab843d3a814f4f7dc4ae9240a21175d80
  it('fails closed for an empty SVG rather than writing an invalid native file', () => {
    expect(() => mermaidFileRequest(source, { kind: 'native', content: null, svg: '' }, 'svg')).toThrow('Mermaid SVG is unavailable');
  });

  // parity:bf4fee54751ee9b1de7895bab59eabfed684fda316e87e03003cc427de811cb0
  // parity:1988312699736eeeeca4ea2ce9d439bd8fc1fc7cc8b5ba9f78391ab556d68334
  it('reports thrown and missing-adapter failures through the plugin error contract', async () => {
    const thrown = jest.fn();
    await expect(createMermaidPlugin({ onError: thrown, adapter: { families: ['flowchart'], render: () => { throw new Error('bad render'); } } }).render(source)).rejects.toThrow('bad render');
    expect(thrown).toHaveBeenCalled();
    const missing = jest.fn();
    await expect(createMermaidPlugin({ onError: missing }).render(source)).rejects.toThrow('No Mermaid adapter');
    expect(missing).toHaveBeenCalled();
  });

  // parity:885267c56b44aab79a11d59fcf89f15a9b05985dad58e6e0e04154e17f5601c3
  it('disables the download trigger while streaming animation is active', async () => {
    const { screen } = renderBlock({ disabled: true });
    await waitFor(() => expect(screen.getByText('Chart')).toBeTruthy());
    const trigger = screen.getByRole('button', { name: 'Download diagram' });
    expect(trigger.props.accessibilityState).toMatchObject({ disabled: true, expanded: false });
    fireEvent.press(trigger);
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();
  });

  it('hides downloads without a native file capability and keeps failed saves actionable', async () => {
    const unavailable = renderBlock({ capabilities: {} });
    await waitFor(() => expect(unavailable.screen.getByText('Chart')).toBeTruthy());
    expect(unavailable.screen.queryByRole('button', { name: 'Download diagram' })).toBeNull();
    unavailable.screen.unmount();

    const save = jest.fn(() => ({ status: 'unavailable' as const }));
    const failed = renderBlock({ capabilities: { files: { save } } });
    await waitFor(() => expect(failed.screen.getByText('Chart')).toBeTruthy());
    fireEvent.press(failed.screen.getByRole('button', { name: 'Download diagram' }));
    fireEvent.press(failed.screen.getByRole('menuitem', { name: 'Download diagram as MMD' }));
    await waitFor(() => expect(failed.screen.getByRole('alert')).toHaveTextContent('File saving unavailable'));
    expect(failed.screen.UNSAFE_getByProps({ accessibilityRole: 'menu' })).toBeTruthy();
  });
});
