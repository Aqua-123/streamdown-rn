import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Modal, Text } from 'react-native';
import { MermaidBlock } from '../../../../src/plugins/mermaid/MermaidBlock';
import { createMermaidPlugin } from '../../../../src/plugins/mermaid';
import { defaultTranslations } from '../../../../src/controls/translations';
import { lightTheme } from '../../../../src/themes';

const source = 'graph TD; A-->B';
const setup = (extra = {}) => {
  const restore = jest.fn();
  const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => ({
    kind: 'native' as const, content: React.createElement(Text, null, 'Fullscreen chart'),
  }) } });
  const screen = render(React.createElement(MermaidBlock, {
    source, plugin, theme: lightTheme, capabilities: { focus: { restore } }, translations: defaultTranslations, ...extra,
  }));
  return { restore, screen };
};

describe('Mermaid native fullscreen', () => {
  // parity:d6a8c46a69f61568b0a6640132716fe63a24784431b0b01f8fa298333a137de9
  // parity:feace3b9d1cfffb2f099d85d84085b3363c1fd2a4a0461105f099ca227cbac7c
  // parity:23cf6d7da908764972abc83ebf6f41f43f2d1c3cdce3b4591a711152389c6c76
  it('renders an accessible action and moves the chart into a native modal', async () => {
    const { screen } = setup();
    await waitFor(() => expect(screen.getByText('Fullscreen chart')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(true);
    expect(screen.getByText('Fullscreen chart')).toBeTruthy();
  });

  // parity:ba4aba987b9c4099b831410a7014d9543b92820eb349bc486e00c85851387e22
  // parity:ae31e976e35569b3efa5e0e0706e412b3c34da01ef53c53675e9c9c509b233c9
  it('uses full-screen native Modal isolation and releases it on close', async () => {
    const { screen } = setup();
    await waitFor(() => expect(screen.getByText('Fullscreen chart')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(screen.UNSAFE_getByType(Modal).props).toMatchObject({ transparent: false, visible: true });
    fireEvent.press(screen.getByRole('button', { name: 'Exit fullscreen' }));
    expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
  });

  // parity:0f7c1e1ba80470f9a4226cfe914ac9f7f7f94e502fcd539044a0058da6e14ad1
  // parity:00bfb89e3dee530b9870eedc7d7fbce46df39c910ce7dd50005ebc56bf7e2e37
  // parity:219259ff4d671ea9b51987235f3197a03c553777d8050dfa3aaacb5eb8f57d6e
  it('maps Escape and backdrop dismissal to the platform system-close request', async () => {
    const { restore, screen } = setup();
    await waitFor(() => expect(screen.getByText('Fullscreen chart')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  // parity:259ed77766069bc7aefc900624c0c83b5eb14ec0c2a7f11524a46c5a7e29a252
  it('closes from the accessible X action and restores opener focus', async () => {
    const { restore, screen } = setup();
    await waitFor(() => expect(screen.getByText('Fullscreen chart')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    fireEvent.press(screen.getByRole('button', { name: 'Exit fullscreen' }));
    expect(restore).toHaveBeenCalledTimes(1);
  });

  // parity:a99ea5775f06a72393cabe7cd8193e8a9f2e391d8b38badbf1aa894e96c93399
  // parity:6935aaa4b0fb0a1f092453f5b3c3e2b6c994b14e7b9797eed6872ca571ed5311
  it('does not attach close handlers to chart content interactions', async () => {
    const { screen } = setup();
    await waitFor(() => expect(screen.getByText('Fullscreen chart')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    fireEvent(screen.getByText('Fullscreen chart'), 'press');
    fireEvent(screen.getByText('Fullscreen chart'), 'keyDown', { nativeEvent: { key: 'Enter' } });
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(true);
  });

  // parity:8d967daee4fdf27752095c1fe8bd6052aa0545fbcbecd838869953db26053846
  it('disables the fullscreen action while streaming animation is active', async () => {
    const { screen } = setup({ disabled: true });
    await waitFor(() => expect(screen.getByText('Fullscreen chart')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'View fullscreen' }).props.accessibilityState.disabled).toBe(true);
  });
});
