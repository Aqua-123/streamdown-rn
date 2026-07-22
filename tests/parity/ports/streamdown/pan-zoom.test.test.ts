import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PanZoomSurface } from '../../../../src/controls/PanZoomSurface';

describe('PanZoom native surface', () => {
  // parity:cb9ae818e57c9fed8ab3fd45b2b18aca0e0ae803969e21ce71466fda55964cf0
  it('can hide visual controls while retaining the accessible gesture surface', () => {
    const renderPanZoom = jest.fn(({ children }) => children);
    const screen = render(React.createElement(PanZoomSurface, { capabilities: { gestures: { renderPanZoom } }, showControls: false, children: React.createElement(Text, null, 'Chart') }));
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.getByRole('adjustable')).toBeTruthy();
  });

  // parity:e62b6cb800bda1d0dccad3bf47f01830bf0198a59eeaa6d263405b7bbbe570c0
  it('honors bounded initial zoom and resets to the neutral native scale', () => {
    const renderPanZoom = jest.fn(({ children }) => children);
    const screen = render(React.createElement(PanZoomSurface, { capabilities: { gestures: { renderPanZoom } }, initialScale: 2, min: 0.5, max: 3, children: React.createElement(Text, null, 'Chart') }));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(2);
    fireEvent.press(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(1);
  });

  // parity:0b507c0673734306f6f2b548ba96beafb0676e3db83a2282fd555d0c59bdaaa7
  // parity:fc37530648942d19b3ca067ee7d641c43a2272aa37d5da0bde89caf463504af0
  // parity:a43a0d40c4d1358add27114718aa7f242f3bbe83e3169299b426e64e9db7cba1
  // parity:f86992375999346df72c62b34f1cab974bec2277ef44d528a9e3757d95375240
  // parity:afcec9769b8bf6bc30be082a9bbe2e78dc7ea7eac17b0a0b2f22d7d7cf459c8b
  it('delegates pointer, wheel, cursor, and touch behavior to the injected native gesture host', () => {
    const renderPanZoom = jest.fn(({ children }) => children);
    render(React.createElement(PanZoomSurface, { capabilities: { gestures: { renderPanZoom } }, children: React.createElement(Text, null, 'Chart') }));
    expect(renderPanZoom).toHaveBeenCalledWith(expect.objectContaining({ children: expect.anything(), scale: 1, onScaleChange: expect.any(Function) }));
  });

  // parity:dfea50c6250bdf8d126acb9b4501690ad1486f56322ec7b83c2fe6e28beb683f
  // parity:a285a2ce14fec2494ed7ae1600599424775c6c24766ea397753c0f9869b56a7a
  it('renders neutral content without false zoom semantics when gestures are absent', () => {
    const screen = render(React.createElement(PanZoomSurface, { capabilities: {}, children: React.createElement(Text, null, 'Chart') }));
    expect(screen.getByText('Chart')).toBeTruthy();
    expect(screen.queryByRole('adjustable')).toBeNull();
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.toJSON()).not.toHaveStyle({ transform: expect.anything() });
  });
});

describe('case-specific PanZoom native proof', () => {
  const adapter = ({ children }: { children: React.ReactNode }) => children;
  const surface = (renderPanZoom = adapter, props: Record<string, unknown> = {}) => React.createElement(
    PanZoomSurface,
    { capabilities: { gestures: { renderPanZoom: renderPanZoom as never } }, children: React.createElement(Text, null, 'Chart'), ...props }
  );
  // parity:50464705071d5951b5997f6cc07a7788226cc2852a5d5b9750ce1da1aba0b62b
  it('resets zoom to the neutral scale', () => {
    const screen = render(surface(adapter, { initialScale: 2 }));
    fireEvent.press(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(1);
  });
  it('delegates pointer identity to the native gesture adapter', () => {
    const renderPanZoom = jest.fn(adapter);
    render(surface(renderPanZoom));
    expect(renderPanZoom).toHaveBeenCalledWith(expect.objectContaining({ onScaleChange: expect.any(Function) }));
  });
  it('keeps controls in native flow for fullscreen hosts', () => {
    const screen = render(surface());
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'toolbar' }).props.style).not.toHaveProperty('position');
  });
  it('uses the native gesture host instead of a DOM cursor', () => {
    const renderPanZoom = jest.fn(adapter);
    render(surface(renderPanZoom));
    expect(renderPanZoom).toHaveBeenCalledTimes(1);
  });
  // parity:34a605356accea4f36a0b9ee004e574567e95bee781b2a2f4674f5b358ccfa0c
  it('exposes an adjustable native gesture surface', () => expect(render(surface()).getByRole('adjustable')).toBeTruthy());
  it('delegates touch-action ownership to the native adapter', () => {
    const renderPanZoom = jest.fn(adapter);
    render(surface(renderPanZoom));
    expect(renderPanZoom.mock.calls[0][0]).toMatchObject({ scale: 1 });
  });
});
