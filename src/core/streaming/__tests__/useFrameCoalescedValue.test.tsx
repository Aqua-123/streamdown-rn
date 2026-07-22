import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useFrameCoalescedValue } from '../useFrameCoalescedValue';

function Harness({ value, enabled = true, streamKey = 'a' }: { value: string; enabled?: boolean; streamKey?: string }) {
  return <Text testID="value">{useFrameCoalescedValue(value, enabled, streamKey)}</Text>;
}

describe('useFrameCoalescedValue', () => {
  let pending: FrameRequestCallback | undefined;

  beforeEach(() => {
    pending = undefined;
    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      pending = callback;
      return 1;
    });
    global.cancelAnimationFrame = jest.fn();
  });

  it('presents multiple appends once on the next frame', () => {
    const screen = render(<Harness value="A" />);
    screen.rerender(<Harness value="AB" />);
    screen.rerender(<Harness value="ABC" />);
    expect(screen.getByTestId('value').props.children).toBe('A');
    act(() => pending?.(16));
    expect(screen.getByTestId('value').props.children).toBe('ABC');
  });

  it('flushes corrections, completion, and stream-key changes immediately', () => {
    const screen = render(<Harness value="alpha" />);
    screen.rerender(<Harness value="beta" />);
    expect(screen.getByTestId('value').props.children).toBe('beta');
    screen.rerender(<Harness value="beta done" enabled={false} />);
    expect(screen.getByTestId('value').props.children).toBe('beta done');
    screen.rerender(<Harness value="new" streamKey="b" />);
    expect(screen.getByTestId('value').props.children).toBe('new');
  });
});
