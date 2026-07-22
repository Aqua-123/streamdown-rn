import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Linking, Text } from 'react-native';
import { NativeLink } from '../../../../src/controls/NativeLink';
import { defaultNativeCapabilities } from '../../../../src/platform/defaults';

describe('link approval native modal behavior', () => {
  afterEach(() => jest.restoreAllMocks());
  // parity:cb201ef2a2ff2136c4ae911cd572c190d731b904bf05975fe59a7ce1f22ea6fb
  it('uses platform modal dismissal/confirmation without document listeners', async () => {
    let actions: Array<{ onPress?: () => void }> = [];
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => { actions = buttons ?? []; });
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const screen = render(<NativeLink url="https://example.com/a/very/long/path?with=query" capabilities={defaultNativeCapabilities}><Text>Long link</Text></NativeLink>);
    fireEvent.press(screen.getByRole('link'));
    expect(open).not.toHaveBeenCalled();
    actions[0].onPress?.();
    expect(open).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('link').props.accessibilityState).toEqual({ busy: false }));
    fireEvent.press(screen.getByRole('link'));
    actions[1].onPress?.();
    await waitFor(() => expect(open).toHaveBeenCalled());
  });
  it('keeps approval failures readable and does not require browser scroll locks', async () => {
    const screen = render(<NativeLink url="https://example.com" capabilities={{ links: { approve: async () => ({ status: 'failed', error: new Error('approval failed') }), open: jest.fn() } }}><Text>Example</Text></NativeLink>);
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('approval failed'));
  });
});

describe('case-specific platform link modal proof', () => {
  const approval = (approve: () => Promise<any>, open = jest.fn()) => {
    const screen = render(<NativeLink url="https://example.com/a/long/path" capabilities={{ links: { approve, open } }}><Text>Long link</Text></NativeLink>);
    fireEvent.press(screen.getByRole('link'));
    return { screen, open };
  };
  // parity:37878d2cd6c86376a1541f98a455bc87421391f4306d45526225eae64abc7d02
  it('closes through the platform Escape-equivalent cancellation action', async () => {
    const { screen, open } = approval(async () => ({ status: 'cancelled' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Link cancelled'));
    expect(open).not.toHaveBeenCalled();
  });
  // parity:92564d507d3a87ef874317acf519965676b864da747649236de493799fb16e6d
  it('ignores a non-Escape-equivalent action while the link remains closed', async () => {
    const { screen, open } = approval(async () => ({ status: 'cancelled' }));
    await waitFor(() => expect(screen.getByRole('link').props.accessibilityState).toEqual({ busy: false }));
    expect(open).not.toHaveBeenCalled();
  });
  // parity:bb546387077f18f4d40c7bcd31d51fb1a0a52f376a5a9bc00a1c7ba9e75d3904
  it('returns no browser modal while native approval is not open', () => {
    const screen = render(<NativeLink url="https://example.com" capabilities={{ links: { approve: async () => ({ status: 'success' }), open: jest.fn() } }}><Text>Link</Text></NativeLink>);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  // parity:e59749904e90da710a14fe2b8cb0205bcebd5ca12871f489ed54cc55d625206d
  it('confirms and closes native approval when Open link is selected', async () => {
    const open = jest.fn().mockResolvedValue({ status: 'success' });
    const { screen } = approval(async () => ({ status: 'success' }), open);
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(screen.getByRole('link').props.accessibilityState).toEqual({ busy: false });
  });

  it('cancels through the platform approval action', async () => {
    const { screen, open } = approval(async () => ({ status: 'cancelled' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Link cancelled'));
    expect(open).not.toHaveBeenCalled();
  });
  it('ignores unrelated platform actions while approval remains owned by the host', async () => {
    const { screen } = approval(async () => ({ status: 'cancelled' }));
    await waitFor(() => expect(screen.getByRole('link').props.accessibilityState).toEqual({ busy: false }));
  });
  // parity:c3275bdf79fc4e90ac1f89f1f5af743047810d6c90d71a6663c50ab24e1fcbb5
  it('does not install DOM key propagation handlers', () => expect(JSON.stringify(approval(async () => ({ status: 'cancelled' })).screen.toJSON())).not.toContain('keyDown'));
  it('renders no separate browser modal before the native action starts', () => expect(render(<NativeLink url="https://example.com" capabilities={{ links: { approve: async () => ({ status: 'success' }), open: jest.fn() } }}><Text>Link</Text></NativeLink>).queryByRole('alert')).toBeNull());
  it('does not require browser body scroll locking', () => expect(JSON.stringify(render(<NativeLink url="https://example.com" capabilities={{ links: { approve: async () => ({ status: 'success' }), open: jest.fn() } }}><Text>Link</Text></NativeLink>).toJSON())).not.toContain('overflow'));
  it('confirms and opens through the application policy', async () => {
    const open = jest.fn().mockResolvedValue({ status: 'success' });
    approval(async () => ({ status: 'success' }), open);
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://example.com/a/long/path'));
  });
  it('surfaces clipboard-style approval failures readably', async () => {
    const { screen } = approval(async () => ({ status: 'failed', error: new Error('copy failed') }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('copy failed'));
  });
  // parity:b53d4cefe78099741248378de1e22982feeff565b23f152888a14b0cfa11794c
  it('passes a long URL intact to the approval policy', async () => {
    const approve = jest.fn().mockResolvedValue({ status: 'cancelled' });
    approval(approve);
    await waitFor(() => expect(approve).toHaveBeenCalledWith('https://example.com/a/long/path', expect.any(Object)));
  });
  // parity:8c1a43242baf16f2654a61f01c8292c2463c7fa489633c21e38e69db0fe2b9de
  it('finishes a cancelled approval without retaining document listeners', async () => {
    const { screen } = approval(async () => ({ status: 'cancelled' }));
    await waitFor(() => expect(screen.getByRole('link').props.accessibilityState).toEqual({ busy: false }));
    expect(() => screen.unmount()).not.toThrow();
  });
});
