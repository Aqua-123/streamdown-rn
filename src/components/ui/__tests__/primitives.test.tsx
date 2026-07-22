import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Modal, StyleSheet, Text, type View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button, Dropdown } from '..';
import * as ui from '..';
import * as root from '../../../index';

function menu(onSelect: () => void | Promise<void>, root: React.ComponentProps<typeof Dropdown.Root> = {}) {
  return <Dropdown.Root {...root}>
    <Dropdown.Trigger accessibilityLabel="Formats">Open</Dropdown.Trigger>
    <Dropdown.Popup accessibilityLabel="Formats"><Dropdown.Item onSelect={onSelect}>SVG</Dropdown.Item></Dropdown.Popup>
  </Dropdown.Root>;
}

describe('UI primitives', () => {
  it('exposes the exact supported UI inventory and keeps root aliases identical', () => {
    expect(Object.keys(ui).sort()).toEqual([
      'Action',
      'ActionButton',
      'ActionRoot',
      'ActionStatus',
      'ActionTrigger',
      'Button',
      'Dropdown',
      'DropdownItem',
      'DropdownPopup',
      'DropdownRoot',
      'DropdownTrigger',
      'FullscreenModal',
      'NativeLink',
      'PanZoomSurface',
      'Toolbar',
      'ToolbarButton',
      'ToolbarRoot',
    ]);
    for (const name of Object.keys(ui) as Array<keyof typeof ui>) {
      expect(root[name]).toBe(ui[name]);
    }
    expect(ui).not.toHaveProperty('CodeControls');
    expect(ui).not.toHaveProperty('TableControls');
    expect(ui).not.toHaveProperty('SafeImage');
  });

  it('merges button accessibility state with its disabled prop', () => {
    render(<Button disabled accessibilityState={{ selected: true }}>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState).toEqual({ selected: true, disabled: true });
  });

  it('preserves static content, style, target size, role, ref, and disabled press suppression', () => {
    const onPress = jest.fn();
    let ref: View | null = null;
    render(<Button ref={(node) => { ref = node; }} accessibilityLabel="Static" accessibilityState={{ disabled: true }} style={{ marginTop: 3 }} onPress={onPress}>7</Button>);
    const button = screen.getByRole('button', { name: 'Static' });
    expect(ref).toBeTruthy();
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minHeight: 44, minWidth: 44, marginTop: 3 });
    expect(screen.getByText('7')).toBeTruthy();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('colors currentColor SVG children at the shared button boundary', () => {
    render(<Button accessibilityLabel="Icon" foregroundColor="#fafafa"><Svg testID="icon"><Path fill="currentColor" d="M0 0" /></Svg></Button>);
    expect(screen.getByTestId('icon').props.color).toBe('#fafafa');
  });

  it('reserves and applies the focus ring without changing radius', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    render(<Button accessibilityLabel="Focus" radius={8} focusRingColor="#737373" onFocus={onFocus} onBlur={onBlur}>Focus</Button>);
    const button = screen.getByRole('button', { name: 'Focus' });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ borderRadius: 8, borderWidth: 1, borderColor: 'transparent' });
    fireEvent(button, 'focus');
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ borderRadius: 8, borderWidth: 1, borderColor: '#737373' });
    fireEvent(button, 'blur');
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ borderRadius: 8, borderWidth: 1, borderColor: 'transparent' });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('exposes pressed, focused, hovered, and effective disabled state while composing events once', () => {
    const states: Array<{ pressed: boolean; focused: boolean; hovered: boolean; disabled: boolean }> = [];
    const styles: typeof states = [];
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const onHoverIn = jest.fn();
    const onHoverOut = jest.fn();
    const view = render(<Button
      accessibilityLabel="State"
      onFocus={onFocus}
      onBlur={onBlur}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={(state) => { styles.push(state); return { opacity: state.hovered ? 0.8 : 1 }; }}
    >{(state) => { states.push(state); return state.focused ? 'Focused' : 'Idle'; }}</Button>);
    const button = screen.getByRole('button', { name: 'State' });
    expect(states[states.length - 1]).toEqual({ pressed: false, focused: false, hovered: false, disabled: false });
    expect(styles[styles.length - 1]).toEqual(states[states.length - 1]);

    fireEvent(button, 'focus');
    expect(screen.getByText('Focused')).toBeTruthy();
    fireEvent(button, 'hoverIn');
    expect(states[states.length - 1]).toMatchObject({ focused: true, hovered: true, disabled: false });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ opacity: 0.8 });
    fireEvent(button, 'hoverOut');
    fireEvent(button, 'blur');
    expect(screen.getByText('Idle')).toBeTruthy();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onHoverIn).toHaveBeenCalledTimes(1);
    expect(onHoverOut).toHaveBeenCalledTimes(1);

    view.rerender(<Button accessibilityLabel="Disabled state" accessibilityState={{ disabled: true }}>{(state) => state.disabled ? 'Disabled' : 'Enabled'}</Button>);
    expect(screen.getByText('Disabled')).toBeTruthy();

    view.rerender(<Button accessibilityLabel="Pressed" testOnly_pressed>{(state) => state.pressed ? 'Pressed' : 'Idle'}</Button>);
    expect(screen.getByText('Pressed')).toBeTruthy();
  });

  it('applies text wrapping and icon color after resolving callback children', () => {
    const children = jest.fn(() => 'Ready');
    const view = render(<Button accessibilityLabel="Callback text">{children}</Button>);
    expect(children).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(screen.getByText('Ready').props.style)).toMatchObject({ fontSize: 14 });
    view.rerender(<Button accessibilityLabel="Callback icon" foregroundColor="#abc">{() => <Svg testID="callback-icon"><Path fill="currentColor" d="M0 0" /></Svg>}</Button>);
    expect(screen.getByTestId('callback-icon').props.color).toBe('#abc');
  });

  it('opens before measurement completes and exposes menu semantics', () => {
    render(menu(jest.fn()));
    const trigger = screen.getByRole('button', { name: 'Formats' });
    expect(trigger.props.accessibilityState.expanded).toBe(false);
    fireEvent.press(trigger);
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'menu', accessibilityLabel: 'Formats' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'SVG' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Formats' }).props.accessibilityState.expanded).toBe(true);
  });

  it('keeps callback children and styles working through Dropdown trigger and item', () => {
    const onSelect = jest.fn();
    render(<Dropdown.Root>
      <Dropdown.Trigger accessibilityLabel="State formats" style={({ focused }) => ({ opacity: focused ? 0.8 : 1 })}>{({ pressed }) => pressed ? 'Opening' : 'Open'}</Dropdown.Trigger>
      <Dropdown.Popup accessibilityLabel="State formats"><Dropdown.Item onSelect={onSelect}>{({ disabled }) => disabled ? 'Unavailable' : 'SVG'}</Dropdown.Item></Dropdown.Popup>
    </Dropdown.Root>);
    fireEvent.press(screen.getByRole('button', { name: 'State formats' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'SVG' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('requests controlled dismissal and restores focus only after the menu actually closes', () => {
    jest.useFakeTimers();
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
    const schedule = jest.spyOn(global, 'setTimeout');
    const onOpenChange = jest.fn();
    const view = render(menu(jest.fn(), { open: true, onOpenChange }));

    fireEvent.press(screen.UNSAFE_getByProps({ testID: 'dropdown-dismiss' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, { reason: 'outside-press' });
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'menu' })).toBeTruthy();
    act(() => jest.runOnlyPendingTimers());
    expect(focus).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
    onOpenChange.mockClear();
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    expect(onOpenChange).toHaveBeenCalledWith(false, { reason: 'system-dismiss' });

    view.rerender(menu(jest.fn(), { open: false, onOpenChange }));
    expect(schedule).toHaveBeenCalledTimes(1);
    act(() => jest.runOnlyPendingTimers());
    schedule.mockRestore();
    focus.mockRestore();
    jest.useRealTimers();
  });

  it('keeps failed selections open with an alert and closes after async success', async () => {
    const failed = render(menu(async () => { throw new Error('Disk full'); }));
    fireEvent.press(screen.getByRole('button', { name: 'Formats' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'SVG' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Disk full'));
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'menu' })).toBeTruthy();
    failed.unmount();

    let finish: (() => void) | undefined;
    const selected = new Promise<void>((resolve) => { finish = resolve; });
    render(menu(() => selected));
    fireEvent.press(screen.getByRole('button', { name: 'Formats' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'SVG' }));
    expect(screen.getByRole('menuitem', { name: 'SVG' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await act(async () => finish?.());
    await waitFor(() => expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull());
  });

  it('clamps the popup and remeasures its trigger after viewport changes', async () => {
    const initial = Dimensions.get('window');
    let trigger: View | null = null;
    render(<Dropdown.Root>
      <Dropdown.Trigger ref={(node) => { trigger = node; }} accessibilityLabel="Formats">Open</Dropdown.Trigger>
      <Dropdown.Popup><Text>Item</Text></Dropdown.Popup>
    </Dropdown.Root>);
    const measure = jest.fn((callback: (x: number, y: number, width: number, height: number) => void) => callback(390, 780, 40, 40));
    if (!trigger) throw new Error('Expected dropdown trigger ref');
    trigger.measureInWindow = measure;
    fireEvent.press(screen.getByRole('button', { name: 'Formats' }));
    fireEvent(screen.getByTestId('dropdown-popup'), 'layout', { nativeEvent: { layout: { width: 180, height: 200 } } });

    act(() => Dimensions.set({ window: { ...initial, width: 220, height: 300 }, screen: { ...initial, width: 220, height: 300 } }));
    await waitFor(() => expect(measure.mock.calls.length).toBeGreaterThan(1));
    expect(StyleSheet.flatten(screen.getByTestId('dropdown-popup').props.style)).toMatchObject({ left: 32, top: 92, maxWidth: 204, maxHeight: 284 });
    act(() => Dimensions.set({ window: initial, screen: initial }));
  });
});
