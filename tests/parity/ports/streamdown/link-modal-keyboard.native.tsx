import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Linking, Text } from 'react-native';
import { NativeLink } from '../../../../src/controls/NativeLink';
import { defaultNativeCapabilities } from '../../../../src/platform/defaults';

describe('link approval native modal behavior', () => {
  afterEach(() => jest.restoreAllMocks());
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
