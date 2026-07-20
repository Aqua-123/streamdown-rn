import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../StreamdownRN';
import { PanZoomSurface } from '../PanZoomSurface';
import { defaultTranslations } from '../translations';

describe('translations and icons', () => {
  // parity:8f3096717fc1ef319941224adb7c08cf9d7dfff02debdbfd9c949786b558d965
  // parity:cd70bc1eec600d5145d787b64b92aee14fca49d97812ec5a7c4cb892b4614ecf
  // parity:41f36a386c21e9a9c10361f4f9cd37536ef41a8bf54585a071566ff8bc9a2fb2
  // parity:463981f5a5e3969ebcf3e552300e8a5999877c9e2b0c71b211fcf43dc6d2f85c
  // parity:8e9091f14f86d336224612e3cee23022df1fb1405b752b1c620b67e38216a012
  // parity:d4a8d13b87b1028d512ecd7051ed9e76d037a351a3375fa5c1e7de65c90dba24
  it('exports complete defaults and replaces icons without changing names', () => {
    expect(defaultTranslations).toMatchObject({
      copyCode: 'Copy Code', downloadDiagramAsSvg: 'Download diagram as SVG',
      copyTableAsTsv: 'Copy table as TSV', imageNotAvailable: 'Image not available', openLink: 'Open link',
    });
    const markdown = '```txt\nhello\n```';
    const screen = render(<Streamdown mode="static" icons={{ copy: <Text testID="copy-icon">C</Text> }}>{markdown}</Streamdown>);
    expect(screen.getByRole('button', { name: 'Copy Code' })).toBeTruthy();
    expect(screen.getByTestId('copy-icon')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download file' })).toBeTruthy();
    expect(screen.getByText('↓')).toBeTruthy();

    screen.rerender(<Streamdown mode="static" icons={{ copy: <Text testID="next-copy-icon">N</Text> }}>{markdown}</Streamdown>);
    expect(screen.getByTestId('next-copy-icon')).toBeTruthy();
  });

  it('keeps default control glyphs visible in the dark theme', () => {
    const screen = render(<Streamdown mode="static" theme="dark">{'| A |\n|---|\n| value |\n\n```txt\nhello\n```'}</Streamdown>);
    expect(screen.getAllByText('↓').every((glyph) => glyph.props.style?.color === '#c9d1d9')).toBe(true);
    expect(screen.getByText('A').props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ color: '#c9d1d9' }),
      expect.objectContaining({ fontWeight: 'bold' }),
    ]));
  });
});

describe('native pan and zoom seam', () => {
  // parity:d0ebdf2c901e57fdd0f73c2c5f489aaa16825d2390105b596610c591bc1660ca
  // parity:2cd4c87bde67ba169fa14850ef233892dcb719a8a595772c22edfea6a21e274f
  // parity:02379a5eaf3d66e955e80ad49bbfe5129675ff08278462f09aeac086b2508ae7
  // parity:264e584e034d6ecf8b47b3377a26858b9c06b41fa1a06b93a6faeb6bb20fb26a
  // parity:f86915e114d9050add8eca477bb48d391d4ef5242550825a04e7dc15dcf98045
  // parity:05d81c1e058ed1ea2bda6380e9d61df631c832db9e0d10296c15d5987097b32d
  // parity:b42754dae9de6eb2b23818137a591734379cf578acd5b824e47bff17f5cf7969
  it('renders controls, clamps zoom, resets, and delegates gestures', () => {
    const renderPanZoom = jest.fn(({ children }) => children);
    const screen = render(
      <PanZoomSurface min={0.75} max={1.25} step={0.25} capabilities={{ gestures: { renderPanZoom } }}>
        <Text>Diagram</Text>
      </PanZoomSurface>
    );
    expect(screen.getByText('Diagram')).toBeTruthy();
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
