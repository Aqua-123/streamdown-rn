import React from 'react';
import { SafeAreaView, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { FullscreenModal } from '../../../../src/controls';

const capabilities = (restore: jest.Mock) => ({ focus: { restore } });

describe('native modal containment substitutes for body scroll locking', () => {
  it('closes a single native modal and restores focus', () => {
    // parity:53a966aa3a07bf35c64c72fa62d72dbe37584086b8438de46be377f80233f903
    const close = jest.fn();
    const restore = jest.fn();
    const screen = render(React.createElement(FullscreenModal, { visible: true, label: 'Fullscreen', closeLabel: 'Close', capabilities: capabilities(restore), restoreTarget: 'opener', onClose: close, children: React.createElement(Text, null, 'content') }));
    fireEvent.press(screen.getByLabelText('Close'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith('opener');
  });

  it('contains fullscreen content inside the platform safe area', () => {
    const screen = render(React.createElement(FullscreenModal, { visible: true, label: 'Fullscreen', closeLabel: 'Close', capabilities: {}, onClose: jest.fn(), children: React.createElement(Text, null, 'content') }));
    expect(screen.UNSAFE_getByType(SafeAreaView)).toBeTruthy();
  });

  it('keeps a sibling native modal mounted when one closes', () => {
    // parity:95c1620c44cd85ac9a17714528265edce33596a5c0be990f378e522e33b0bc1b
    const closeA = jest.fn();
    const closeB = jest.fn();
    const screen = render(React.createElement(React.Fragment, null,
      React.createElement(FullscreenModal, { visible: true, label: 'A', closeLabel: 'Close A', capabilities: {}, onClose: closeA, children: React.createElement(Text, null, 'a') }),
      React.createElement(FullscreenModal, { visible: true, label: 'B', closeLabel: 'Close B', capabilities: {}, onClose: closeB, children: React.createElement(Text, null, 'b') }),
    ));
    fireEvent.press(screen.getByLabelText('Close A'));
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('B')).toBeTruthy();
    expect(closeB).not.toHaveBeenCalled();
  });

  it('has no mutable global lock count to underflow', () => {
    // parity:2b57308141a2a83cce158b0136b9c0a0ee049a1b18643d1cee80bc4a3bf222e8
    const close = jest.fn();
    const screen = render(React.createElement(FullscreenModal, { visible: false, label: 'Hidden', closeLabel: 'Close', capabilities: {}, onClose: close, children: React.createElement(Text, null, 'hidden') }));
    expect(screen.queryByLabelText('Hidden')).toBeNull();
    expect(screen.toJSON()).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });

  it('unwinds each native modal through its own close/focus lifecycle', () => {
    // parity:f41ce9b012ab151dcf739b527ee22e4d69b4b1aee3c1b8f0f83484d2f72feb0f
    const close = jest.fn();
    const restore = jest.fn();
    const screen = render(React.createElement(FullscreenModal, { visible: true, label: 'Nested', closeLabel: 'Exit', capabilities: capabilities(restore), onClose: close, children: React.createElement(Text, null, 'nested') }));
    fireEvent(screen.getByLabelText('Nested'), 'accessibilityAction', { nativeEvent: { actionName: 'escape' } });
    expect(close).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
