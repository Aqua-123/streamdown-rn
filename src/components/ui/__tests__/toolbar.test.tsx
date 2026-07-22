import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Toolbar } from '../Toolbar';

describe('Toolbar', () => {
  it('labels and orients a native toolbar', () => {
    const states: import('../Toolbar').ToolbarState[] = [];
    render(<Toolbar.Root accessibilityLabel="Editor actions" orientation="vertical" testID="toolbar">{(state) => {
      states.push(state);
      return <Toolbar.Button accessibilityLabel="Save">Save</Toolbar.Button>;
    }}</Toolbar.Root>);
    const toolbar = screen.getByTestId('toolbar');
    expect(toolbar.props).toMatchObject({ accessibilityRole: 'toolbar', accessibilityLabel: 'Editor actions' });
    expect(StyleSheet.flatten(toolbar.props.style)).toMatchObject({ flexDirection: 'column' });
    expect(states).toEqual([{ disabled: false, orientation: 'vertical' }]);
  });

  it('propagates disabled state while preserving button events', () => {
    const onPress = jest.fn();
    const view = render(<Toolbar.Root disabled><Toolbar.Button accessibilityLabel="Save" onPress={onPress}>Save</Toolbar.Button></Toolbar.Root>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();

    view.rerender(<Toolbar.Root><Toolbar.Button accessibilityLabel="Save" onPress={onPress}>Save</Toolbar.Button></Toolbar.Root>);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('isolates nested providers', () => {
    const states: Array<[string, import('../Toolbar').ToolbarState]> = [];
    render(<Toolbar.Root disabled>
      <Toolbar.Button accessibilityLabel="Outer">Outer</Toolbar.Button>
      <Toolbar.Root>{(state) => {
        states.push(['inner', state]);
        return <Toolbar.Button accessibilityLabel="Inner">Inner</Toolbar.Button>;
      }}</Toolbar.Root>
    </Toolbar.Root>);
    expect(screen.getByRole('button', { name: 'Outer' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Inner' }).props.accessibilityState.disabled).toBe(false);
    expect(states).toEqual([['inner', { disabled: false, orientation: 'horizontal' }]]);
  });
});
