import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Modal, StyleSheet, Text, type View } from 'react-native';
import { Button, Dropdown } from '..';

function menu(onSelect: () => void | Promise<void>, root: React.ComponentProps<typeof Dropdown.Root> = {}) {
  return <Dropdown.Root {...root}>
    <Dropdown.Trigger accessibilityLabel="Formats">Open</Dropdown.Trigger>
    <Dropdown.Popup accessibilityLabel="Formats"><Dropdown.Item onSelect={onSelect}>SVG</Dropdown.Item></Dropdown.Popup>
  </Dropdown.Root>;
}

describe('UI primitives', () => {
  it('merges button accessibility state with its disabled prop', () => {
    render(<Button disabled accessibilityState={{ selected: true }}>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState).toEqual({ selected: true, disabled: true });
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
