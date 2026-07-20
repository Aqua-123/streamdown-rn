import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NativeLink } from '../../../../src/controls/NativeLink';
import { Streamdown } from '../../../../src/StreamdownRN';

describe('native link safety', () => {
  it('keeps unsafe and incomplete links inert', () => {
    const unsafe = render(<NativeLink url="javascript:alert(1)" capabilities={{ links: { approve: jest.fn(), open: jest.fn() } }}><Text>Unsafe</Text></NativeLink>);
    expect(unsafe.queryByRole('link')).toBeNull();
    const incomplete = render(<Streamdown>Read [unfinished](https://example</Streamdown>);
    expect(incomplete.queryByRole('link')).toBeNull();
  });
  it('supports application-owned approval, confirm, cancel, and copy policies', async () => {
    const open = jest.fn().mockResolvedValue({ status: 'success' });
    const writeText = jest.fn().mockResolvedValue({ status: 'success' });
    const approve = jest.fn(async (url: string) => { await writeText(url); return { status: 'success' as const }; });
    const screen = render(<NativeLink url="https://example.com" capabilities={{ links: { approve, open }, clipboard: { writeText } }}><Text>Example</Text></NativeLink>);
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://example.com'));
    expect(writeText).toHaveBeenCalledWith('https://example.com');
    screen.rerender(<NativeLink url="https://example.com" capabilities={{ links: { approve: async () => ({ status: 'cancelled' }), open } }}><Text>Example</Text></NativeLink>);
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Link cancelled'));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
