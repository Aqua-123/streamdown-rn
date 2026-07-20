import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ActionButton } from '../../../../src/controls/ActionButton';

describe('TableCopyDropdown native outcome', () => {
  it('announces copied state, resets at the configured timeout, and cleans up', async () => {
    jest.useFakeTimers();
    const screen = render(<ActionButton label="Copy table" successMessage="Copied" resetAfterMs={50} onAction={() => ({ status: 'success' })} />);
    fireEvent.press(screen.getByRole('button'));
    expect(screen.getByText('Copied')).toBeTruthy();
    act(() => jest.advanceTimersByTime(50));
    expect(screen.queryByText('Copied')).toBeNull();
    screen.unmount();
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('uses custom native visual children without changing the accessible name', () => {
    const screen = render(<ActionButton label="Copy table" icon={<Text testID="custom-copy">C</Text>} onAction={() => ({ status: 'success' })} />);
    expect(screen.getByRole('button', { name: 'Copy table' })).toBeTruthy();
    expect(screen.getByTestId('custom-copy')).toBeTruthy();
  });
});
