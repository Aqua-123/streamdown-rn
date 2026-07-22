import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NativeLink } from '../../../../src/controls/NativeLink';
import { Streamdown } from '../../../../src/StreamdownRN';

describe('native link safety', () => {
  // parity:7951e4898b329c9de2e6cfe6c17ce869c2b288bec86ca2b2e738956d56a31e27
  it('keeps unsafe and incomplete links inert', () => {
    const unsafe = render(<NativeLink url="javascript:alert(1)" capabilities={{ links: { approve: jest.fn(), open: jest.fn() } }}><Text>Unsafe</Text></NativeLink>);
    expect(unsafe.queryByRole('link')).toBeNull();
    const incomplete = render(<Streamdown>Read [unfinished](https://example</Streamdown>);
    expect(incomplete.queryByRole('link')).toBeNull();
  });
  // parity:7bed9de1ae1d28bb0d264fcd0432dbcf14d0b4426dd3af99c5ef6520a2424394
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

describe('case-specific native link approval proof', () => {
  const link = (capabilities: React.ComponentProps<typeof NativeLink>['capabilities']) => render(<NativeLink url="https://example.com" capabilities={capabilities}><Text>Example</Text></NativeLink>);
  // parity:2389f685a1379c3247483eb41a098b8a3765efc400c496d9ff7f5adebd3a68bb
  it('renders a safe link with native approval capability', () => expect(link({ links: { approve: async () => ({ status: 'success' }), open: jest.fn() } }).getByRole('link', { name: 'Example' })).toBeTruthy());
  it('requests approval before opening a guarded link', async () => {
    const approve = jest.fn().mockResolvedValue({ status: 'success' });
    const open = jest.fn().mockResolvedValue({ status: 'success' });
    const screen = link({ links: { approve, open } });
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('https://example.com', expect.any(Object)));
    expect(open).toHaveBeenCalledWith('https://example.com');
  });
  // parity:de0253e6f4ed3fc7031ab4d46043bfff68c6187aff21d362d7e2ed0e8429f512
  it('intercepts a guarded link press through the native approval boundary', async () => {
    const approve = jest.fn().mockResolvedValue({ status: 'cancelled' });
    const open = jest.fn();
    const screen = link({ links: { approve, open } });
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(approve).toHaveBeenCalled());
    expect(open).not.toHaveBeenCalled();
  });
  // parity:6182a059eca42c49d2c26e8d98d45c6e9d5e9dae679b8a0174bd0cbd67e94ebf
  it('closes through the native backdrop-equivalent cancellation action', async () => {
    const open = jest.fn();
    const screen = link({ links: { approve: async () => ({ status: 'cancelled' }), open } });
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Link cancelled'));
    expect(open).not.toHaveBeenCalled();
  });
  // parity:f365eeac03674717414c3cf04e498d708e4f513413653524dbb253d35f647808
  it('closes through the native Escape-equivalent cancellation action', async () => {
    const open = jest.fn();
    const screen = link({ links: { approve: async () => ({ status: 'cancelled' }), open } });
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Link cancelled'));
    expect(open).not.toHaveBeenCalled();
  });
  it('surfaces a failed custom approval policy', async () => {
    const screen = link({ links: { approve: async () => ({ status: 'failed', error: new Error('custom rejected') }), open: jest.fn() } });
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('custom rejected'));
  });
  // parity:11a877ac4fc8bff91bd7b9a9312335623a395e64381b21ce255ebe1f01edab5d
  it('calls confirm from the custom native approval policy', async () => {
    const open = jest.fn().mockResolvedValue({ status: 'success' });
    const screen = link({ links: { approve: async () => ({ status: 'success' }), open } });
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
  });
  // parity:3d44f4c39d920c167cdb3c340442877d3a1ac745ecca6ce2f8e33b37d60ac6a8
  it('calls close from the custom native approval policy', async () => {
    const open = jest.fn();
    const screen = link({ links: { approve: async () => ({ status: 'cancelled' }), open } });
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(screen.getByRole('link').props.accessibilityState).toEqual({ busy: false }));
    expect(open).not.toHaveBeenCalled();
  });
  it('keeps a dangerous URL inert even with custom capabilities', () => {
    const screen = render(<NativeLink url="javascript:alert(1)" capabilities={{ links: { approve: jest.fn(), open: jest.fn() } }}><Text>Unsafe</Text></NativeLink>);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
