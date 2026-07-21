import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { PanZoomRenderProps } from '../../../../src/platform/capabilities';
import { PanZoomSurface } from '../../../../src/controls/PanZoomSurface';

describe('PanZoom native interactions', () => {
  // parity:c41c8108614a764088fb192a8e0ae04ff41697d01dbf8db1f5fa8e91a60e31dc
  // parity:2c5c253d143ebaf5b2da1f29db33067de779ffef9267addc7a8405a0f48ce88d
  // parity:6c289f8724b9e283dc7a6598d451811e274db813df049da91cfb80a915a6983c
  // parity:b4fff4c992240bb43badb1675b88daa1ec5259b26838d723338f7e7d926384fa
  // parity:3c1146c70775a174ebeedac8069af77bb04eebb669aa3a1fac90f91803a451d5
  // parity:05582a66c69e8515f98284800a6a06d252b814bf1ba39ec2c908c6147ea81f29
  it('gives the native gesture adapter the content and a bounded scale callback', () => {
    let contract: PanZoomRenderProps | undefined;
    const renderPanZoom = jest.fn((props: PanZoomRenderProps) => { contract = props; return props.children; });
    const screen = render(React.createElement(PanZoomSurface, { capabilities: { gestures: { renderPanZoom } }, min: 0.75, max: 1.25, children: React.createElement(Text, null, 'Chart') }));
    expect(contract?.children).toBeTruthy();
    act(() => contract?.onScaleChange(99));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(1.25);
    act(() => contract?.onScaleChange(-99));
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(0.75);
  });

  // parity:fde7b979215bad5c9947342e5d66bc9abf5666e368bbe7a45c0eb699af78f66e
  it('provides a platform-neutral zoom-out action as the wheel-down substitute', () => {
    const renderPanZoom = ({ children }: PanZoomRenderProps) => children;
    const screen = render(React.createElement(PanZoomSurface, { capabilities: { gestures: { renderPanZoom } }, step: 0.25, children: React.createElement(Text, null, 'Chart') }));
    fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(0.75);
  });

  // parity:12205c696182c0807d4902e4c4c637276d369c66557d74185a6bf80c4efdcc86
  // parity:2ec99a7ab63743b448dc7f397ae9269bb8840776d84da0beeb11f29f9debe88f
  it('keeps controls in native flow rather than applying browser fullscreen coordinates', () => {
    const renderPanZoom = ({ children }: PanZoomRenderProps) => children;
    const screen = render(React.createElement(PanZoomSurface, { capabilities: { gestures: { renderPanZoom } }, children: React.createElement(Text, null, 'Chart') }));
    const toolbar = screen.UNSAFE_getByProps({ accessibilityRole: 'toolbar' });
    expect(toolbar.props.style).toEqual(expect.objectContaining({ flexDirection: 'row' }));
    expect(toolbar.props.style).not.toHaveProperty('position');
  });
});
