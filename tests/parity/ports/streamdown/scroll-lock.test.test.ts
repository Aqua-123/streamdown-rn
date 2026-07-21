import React, { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Modal, Platform, SafeAreaView, StatusBar, StyleSheet, Text } from 'react-native';
import { FullscreenModal } from '../../../../src/controls';

const originalPlatformOS = Platform.OS;
const capabilities = (restore: jest.Mock) => ({ focus: { restore } });

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  jest.useRealTimers();
});

function ControlledModal({ close, restore }: { close: jest.Mock; restore: jest.Mock }) {
  const [visible, setVisible] = useState(true);
  return React.createElement(FullscreenModal, {
    visible,
    label: 'Fullscreen',
    closeLabel: 'Close',
    capabilities: capabilities(restore),
    restoreTarget: 'opener',
    onClose: () => { close(); setVisible(false); },
    children: React.createElement(Text, null, 'content'),
  });
}

describe('native modal containment substitutes for body scroll locking', () => {
  it('restores focus after native dismissal and only once', () => {
    // parity:53a966aa3a07bf35c64c72fa62d72dbe37584086b8438de46be377f80233f903
    const close = jest.fn();
    const restore = jest.fn();
    const screen = render(React.createElement(ControlledModal, { close, restore }));
    fireEvent.press(screen.getByLabelText('Close'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
    expect(screen.queryByText('content')).toBeNull();
    expect(restore).not.toHaveBeenCalled();
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss');
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss');
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith('opener');
  });

  it('uses a post-render Android fallback and deduplicates a late dismissal event', () => {
    jest.useFakeTimers();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const close = jest.fn();
    const restore = jest.fn();
    const screen = render(React.createElement(ControlledModal, { close, restore }));
    fireEvent.press(screen.getByLabelText('Close'));
    expect(restore).not.toHaveBeenCalled();
    act(() => jest.runAllTimers());
    expect(restore).toHaveBeenCalledTimes(1);
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss');
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('contains default horizontal content inside iOS and Android safe areas', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const ios = render(React.createElement(FullscreenModal, { visible: true, label: 'iOS', closeLabel: 'Close', capabilities: {}, onClose: jest.fn(), children: React.createElement(Text, null, 'content') }));
    expect(ios.UNSAFE_getByType(SafeAreaView)).toBeTruthy();
    expect(StyleSheet.flatten(ios.UNSAFE_getByProps({ accessibilityViewIsModal: true }).props.style)).toMatchObject({ paddingTop: 16 });
    expect(ios.getByTestId('fullscreen-content-horizontal').props.horizontal).toBe(true);
    ios.unmount();

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const android = render(React.createElement(FullscreenModal, { visible: true, label: 'Android', closeLabel: 'Close', capabilities: {}, onClose: jest.fn(), children: React.createElement(Text, null, 'content') }));
    expect(StyleSheet.flatten(android.UNSAFE_getByProps({ accessibilityViewIsModal: true }).props.style)).toMatchObject({ paddingTop: (StatusBar.currentHeight ?? 0) + 16 });
  });

  it('preserves close color on a custom icon element', () => {
    const CloseIcon = ({ color }: { color?: string }) => React.createElement(Text, { testID: 'custom-close-icon', style: { color } }, 'custom');
    const screen = render(React.createElement(FullscreenModal, {
      visible: true,
      label: 'Fullscreen',
      closeLabel: 'Close',
      capabilities: {},
      onClose: jest.fn(),
      icons: { close: React.createElement(CloseIcon) },
      color: '#123456',
      children: React.createElement(Text, null, 'content'),
    }));
    expect(screen.getByTestId('custom-close-icon')).toHaveStyle({ color: '#123456' });
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

  it('unwinds through accessibility escape without restoring synchronously', () => {
    // parity:f41ce9b012ab151dcf739b527ee22e4d69b4b1aee3c1b8f0f83484d2f72feb0f
    const close = jest.fn();
    const restore = jest.fn();
    const screen = render(React.createElement(ControlledModal, { close, restore }));
    fireEvent(screen.getByLabelText('Fullscreen'), 'accessibilityAction', { nativeEvent: { actionName: 'escape' } });
    expect(close).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss');
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
