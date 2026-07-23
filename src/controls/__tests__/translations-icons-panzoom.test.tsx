import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { Streamdown } from '../../StreamdownRN';
import { PanZoomSurface } from '../PanZoomSurface';
import { defaultIcons } from '../icons';
import { defaultTranslations } from '../translations';
import { darkTheme } from '../../themes';

describe('translations and icons', () => {
  // parity:8e9091f14f86d336224612e3cee23022df1fb1405b752b1c620b67e38216a012
  it('exports complete defaults and replaces icons without changing names', () => {
    expect(defaultTranslations).toMatchObject({
      copyCode: 'Copy Code', downloadDiagramAsSvg: 'Download diagram as SVG',
      copyTableAsTsv: 'Copy table as TSV', imageNotAvailable: 'Image not available', openLink: 'Open link',
    });
    const markdown = '```txt\nhello\n```';
    const capabilities = { clipboard: { writeText: jest.fn() }, files: { save: jest.fn() } };
    const screen = render(<Streamdown mode="static" capabilities={capabilities} icons={{ copy: <Text testID="copy-icon">C</Text> }}>{markdown}</Streamdown>);
    expect(screen.getByRole('button', { name: 'Copy Code' })).toBeTruthy();
    expect(screen.getByTestId('copy-icon')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download file' })).toBeTruthy();
    expect(Object.values(defaultIcons).every(React.isValidElement)).toBe(true);
    expect(React.isValidElement(defaultIcons.check)).toBe(true);
    expect(screen.queryByText('↓')).toBeNull();

    screen.rerender(<Streamdown mode="static" capabilities={capabilities} icons={{ copy: <Text testID="next-copy-icon">N</Text> }}>{markdown}</Streamdown>);
    expect(screen.getByTestId('next-copy-icon')).toBeTruthy();
  });

  it('uses a custom check icon without removing other defaults', async () => {
    const screen = render(<Streamdown
      mode="static"
      capabilities={{ clipboard: { writeText: async () => ({ status: 'success' }) }, files: { save: jest.fn() } }}
      icons={{ check: <Text testID="custom-check">OK</Text> }}
    >{'```txt\nhello\n```'}</Streamdown>);
    expect(screen.getByRole('button', { name: 'Download file' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Copy Code' }));
    await waitFor(() => expect(screen.getByTestId('custom-check')).toBeTruthy());
  });

  it('keeps reference SVG controls visible in the dark theme', () => {
    const screen = render(<Streamdown mode="static" theme="dark">{'| A |\n|---|\n| value |\n\n```txt\nhello\n```'}</Streamdown>);
    expect(screen.queryByText('↓')).toBeNull();
    expect(screen.getAllByRole('button').every((button) => button.props.style)).toBe(true);
    expect(screen.getByRole('button', { name: 'View fullscreen' }).findByType(Svg).props.color).toBe(darkTheme.primitives!.mutedForeground);
    expect(screen.UNSAFE_getAllByType(View).some(({ props }) => {
      const style = StyleSheet.flatten(props.style);
      return style?.borderRadius === 12 && style?.backgroundColor === darkTheme.primitives!.sidebar && style?.borderColor === darkTheme.primitives!.sidebarBorder;
    })).toBe(true);
    expect(screen.getByText('A').props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ color: darkTheme.primitives!.foreground }),
      expect.objectContaining({ fontWeight: '600' }),
    ]));
  });
});

describe('native pan and zoom seam', () => {
  // parity:2cd4c87bde67ba169fa14850ef233892dcb719a8a595772c22edfea6a21e274f
  it('renders controls, clamps zoom, resets, and delegates gestures', () => {
    const renderPanZoom = jest.fn(({ children }) => children);
    const screen = render(
      <PanZoomSurface min={0.75} max={1.25} step={0.25} capabilities={{ gestures: { renderPanZoom } }} color={darkTheme.primitives!.mutedForeground} backgroundColor={darkTheme.primitives!.popover} borderColor={darkTheme.primitives!.border} radius={8} focusRingColor={darkTheme.primitives!.ring}>
        <Text>Diagram</Text>
      </PanZoomSurface>
    );
    expect(screen.getByText('Diagram')).toBeTruthy();
    const toolbar = screen.UNSAFE_getAllByType(View).find((node) => node.props.accessibilityRole === 'toolbar')!;
    expect(StyleSheet.flatten(toolbar.props.style)).toMatchObject({ backgroundColor: darkTheme.primitives!.popover, borderColor: darkTheme.primitives!.border, borderRadius: 8 });
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    expect(StyleSheet.flatten(zoomIn.props.style)).toMatchObject({ borderColor: 'transparent', borderRadius: 8 });
    fireEvent(zoomIn, 'focus');
    expect(StyleSheet.flatten(zoomIn.props.style).borderColor).toBe(darkTheme.primitives!.ring);
    fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(1.25);
    expect(screen.getByRole('button', { name: 'Zoom in' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(0.75);
    fireEvent.press(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(1);
    expect(renderPanZoom).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 1, onScaleChange: expect.any(Function) }));
  });
});

describe('case-specific icon, zoom, and translation proof', () => {
  const adapter = ({ children }: { children: React.ReactNode }) => children;
  const surface = (props: Record<string, unknown> = {}) => render(<PanZoomSurface capabilities={{ gestures: { renderPanZoom: adapter as never } }} {...props}><Text>Diagram</Text></PanZoomSurface>);
  // parity:41f36a386c21e9a9c10361f4f9cd37536ef41a8bf54585a071566ff8bc9a2fb2
  it('provides default icons when no overrides are given', () => expect(Object.values(defaultIcons).every(React.isValidElement)).toBe(true));
  // parity:463981f5a5e3969ebcf3e552300e8a5999877c9e2b0c71b211fcf43dc6d2f85c
  it('overrides one icon without removing defaults', () => {
    const screen = render(<Streamdown mode="static" capabilities={{ clipboard: { writeText: jest.fn() } }} icons={{ copy: <Text testID="override-copy">C</Text> }}>{'```txt\ncode\n```'}</Streamdown>);
    expect(screen.getByTestId('override-copy')).toBeTruthy();
  });
  // parity:d4a8d13b87b1028d512ecd7051ed9e76d037a351a3375fa5c1e7de65c90dba24
  it('recalculates icons when the prop value changes', () => {
    const capabilities = { clipboard: { writeText: jest.fn() } };
    const screen = render(<Streamdown mode="static" capabilities={capabilities} icons={{ copy: <Text testID="first-icon">A</Text> }}>{'```txt\ncode\n```'}</Streamdown>);
    screen.rerender(<Streamdown mode="static" capabilities={capabilities} icons={{ copy: <Text testID="second-icon">B</Text> }}>{'```txt\ncode\n```'}</Streamdown>);
    expect(screen.getByTestId('second-icon')).toBeTruthy();
  });
  // parity:d0ebdf2c901e57fdd0f73c2c5f489aaa16825d2390105b596610c591bc1660ca
  it('renders PanZoom children', () => expect(surface().getByText('Diagram')).toBeTruthy());
  // parity:02379a5eaf3d66e955e80ad49bbfe5129675ff08278462f09aeac086b2508ae7
  it('zooms in from the neutral scale', () => {
    const screen = surface(); fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(1.25);
  });
  // parity:264e584e034d6ecf8b47b3377a26858b9c06b41fa1a06b93a6faeb6bb20fb26a
  it('zooms out from the neutral scale', () => {
    const screen = surface(); fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(0.75);
  });
  // parity:f86915e114d9050add8eca477bb48d391d4ef5242550825a04e7dc15dcf98045
  it('respects the minimum zoom limit', () => {
    const screen = surface({ min: 1 }); expect(screen.getByRole('button', { name: 'Zoom out' }).props.accessibilityState.disabled).toBe(true);
  });
  // parity:05d81c1e058ed1ea2bda6380e9d61df631c832db9e0d10296c15d5987097b32d
  it('respects the maximum zoom limit', () => {
    const screen = surface({ max: 1 }); expect(screen.getByRole('button', { name: 'Zoom in' }).props.accessibilityState.disabled).toBe(true);
  });
  // parity:b42754dae9de6eb2b23818137a591734379cf578acd5b824e47bff17f5cf7969
  it('uses a custom zoom step', () => {
    const screen = surface({ step: 0.5 }); fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(1.5);
  });
  // parity:8f3096717fc1ef319941224adb7c08cf9d7dfff02debdbfd9c949786b558d965
  it('exports every required default translation', () => expect(defaultTranslations).toMatchObject({ copyCode: expect.any(String), downloadFile: expect.any(String), copyTable: expect.any(String), openLink: expect.any(String) }));
  // parity:cd70bc1eec600d5145d787b64b92aee14fca49d97812ec5a7c4cb892b4614ecf
  it('uses default translations when the host omits translation overrides', () => {
    const screen = render(<Streamdown mode="static" capabilities={{ clipboard: { writeText: jest.fn() } }}>{'```txt\ncode\n```'}</Streamdown>);
    expect(screen.getByRole('button', { name: defaultTranslations.copyCode })).toBeTruthy();
  });
});
