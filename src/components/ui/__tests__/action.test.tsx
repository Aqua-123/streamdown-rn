import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, Text, type View } from 'react-native';
import { ActionButton } from '../../../controls/ActionButton';
import { Action } from '../Action';

describe('ActionButton compatibility', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('handles sync and async success and reports each result', async () => {
    const onResult = jest.fn();
    const view = render(<ActionButton label="Save" successMessage="Saved" onAction={() => ({ status: 'success' })} onResult={onResult} />);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Saved'));
    expect(onResult).toHaveBeenLastCalledWith({ status: 'success' });

    view.rerender(<ActionButton label="Save" onAction={async () => ({ status: 'success' })} onResult={onResult} />);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['thrown', () => { throw new Error('thrown failure'); }, 'thrown failure'],
    ['rejected', async () => { throw new Error('rejected failure'); }, 'rejected failure'],
  ])('normalizes %s failures', async (_kind, onAction, message) => {
    const onResult = jest.fn();
    render(<ActionButton label="Run" successIcon={<Text testID="success-icon">check</Text>} onAction={onAction} onResult={onResult} />);
    fireEvent.press(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
    expect(screen.getByRole('alert').props.accessibilityLiveRegion).toBe('polite');
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: expect.any(Error) }));
    expect(screen.queryByTestId('success-icon')).toBeNull();
  });

  it('suppresses overlapping presses while busy', async () => {
    let finish: ((value: { status: 'success' }) => void) | undefined;
    const pending = new Promise<{ status: 'success' }>((resolve) => { finish = resolve; });
    const onAction = jest.fn(() => pending);
    render(<ActionButton label="Run" onAction={onAction} />);
    const button = screen.getByRole('button', { name: 'Run' });
    fireEvent.press(button);
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    fireEvent.press(button);
    expect(onAction).toHaveBeenCalledTimes(1);
    await act(async () => finish?.({ status: 'success' }));
  });

  it('shows the success icon during feedback, restores the original icon, and keeps its accessible name', async () => {
    jest.useFakeTimers();
    const clear = jest.spyOn(global, 'clearTimeout');
    const view = render(<ActionButton
      label="Save"
      icon={<Text testID="save-icon">save</Text>}
      successIcon={<Text testID="success-icon">check</Text>}
      successMessage="Saved"
      resetAfterMs={50}
      onAction={() => ({ status: 'success' })}
    />);
    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.press(button);
    expect(screen.getByRole('alert')).toHaveTextContent('Saved');
    expect(screen.getByTestId('success-icon')).toBeTruthy();
    expect(screen.queryByTestId('save-icon')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBe(button);
    act(() => jest.advanceTimersByTime(50));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('save-icon')).toBeTruthy();
    expect(screen.queryByTestId('success-icon')).toBeNull();

    fireEvent.press(button);
    view.unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  it('preserves disabled and expanded accessibility state', () => {
    const onAction = jest.fn(() => ({ status: 'success' as const }));
    render(<ActionButton label="Details" disabled expanded icon="+" onAction={onAction} />);
    const button = screen.getByRole('button', { name: 'Details' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: false, expanded: true });
    expect(screen.getByText('+')).toBeTruthy();
    fireEvent.press(button);
    expect(onAction).not.toHaveBeenCalled();
  });

  it.each([
    ['unavailable', 'Unavailable'],
    ['denied', 'Action denied'],
    ['cancelled', 'Action cancelled'],
    ['failed', 'Action failed'],
  ] as const)('preserves the default %s message', async (status, message) => {
    render(<ActionButton label="Run" successIcon={<Text testID="success-icon">check</Text>} onAction={() => ({ status })} />);
    fireEvent.press(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
    expect(screen.queryByTestId('success-icon')).toBeNull();
  });

  it('preserves ref, color, radius, and focus ring composition', () => {
    let ref: View | null = null;
    render(<ActionButton
      label="Styled"
      buttonRef={(node) => { ref = node; }}
      color="#123456"
      radius={7}
      focusRingColor="#abcdef"
      onAction={() => ({ status: 'success' })}
    />);
    const button = screen.getByRole('button', { name: 'Styled' });
    expect(ref).toBeTruthy();
    expect(screen.getByText('Styled').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: '#123456' })]));
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ borderRadius: 7, borderColor: 'transparent' });
    fireEvent(button, 'focus');
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ borderRadius: 7, borderColor: '#abcdef' });
  });
});

describe('Action', () => {
  it('shares one async lifecycle and render state between Trigger and Status', async () => {
    const onResult = jest.fn();
    const states: import('../Action').ActionState[] = [];
    render(<Action.Root onAction={async () => ({ status: 'denied' })} onResult={onResult}>{(state) => {
      states.push(state);
      return <>
        <Action.Trigger accessibilityLabel="Run">Run</Action.Trigger>
        <Action.Status testID="status" />
      </>;
    }}</Action.Root>);
    fireEvent.press(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Action denied'));
    expect(onResult).toHaveBeenCalledWith({ status: 'denied' });
    expect(states).toEqual(expect.arrayContaining([
      expect.objectContaining({ busy: true, disabled: false, result: null, message: null, run: expect.any(Function) }),
      expect.objectContaining({ busy: false, result: { status: 'denied' }, message: 'Action denied', run: expect.any(Function) }),
    ]));
  });

  it('owns async busy gating and ignores completion after unmount', async () => {
    let finish: ((value: { status: 'success' }) => void) | undefined;
    const onAction = jest.fn(() => new Promise<{ status: 'success' }>((resolve) => { finish = resolve; }));
    const onResult = jest.fn();
    const view = render(<Action.Root onAction={onAction} onResult={onResult} successMessage="Done">
      <Action.Trigger accessibilityLabel="Run">Run</Action.Trigger>
      <Action.Status />
    </Action.Root>);
    const trigger = screen.getByRole('button', { name: 'Run' });
    fireEvent.press(trigger);
    fireEvent.press(trigger);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(trigger.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    view.unmount();
    const schedule = jest.spyOn(global, 'setTimeout');
    await act(async () => finish?.({ status: 'success' }));
    expect(onResult).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
    schedule.mockRestore();
  });

  it('isolates nested roots', async () => {
    render(<Action.Root onAction={() => ({ status: 'failed', error: new Error('outer') })}>
      <Action.Trigger accessibilityLabel="Outer">Outer</Action.Trigger>
      <Action.Status testID="outer-status" />
      <Action.Root onAction={() => ({ status: 'failed', error: new Error('inner') })}>
        <Action.Trigger accessibilityLabel="Inner">Inner</Action.Trigger>
        <Action.Status testID="inner-status" />
      </Action.Root>
    </Action.Root>);
    fireEvent.press(screen.getByRole('button', { name: 'Inner' }));
    await waitFor(() => expect(screen.getByTestId('inner-status')).toHaveTextContent('inner'));
    expect(screen.queryByTestId('outer-status')).toBeNull();
  });
});
