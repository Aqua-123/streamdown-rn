import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ActionButton } from '../../../../src/controls/ActionButton';
import { TableControls } from '../../../../src/controls/TableControls';
import { defaultTranslations } from '../../../../src/controls/translations';

const table = { headers: ['Name', 'City'], rows: [['Ada', 'London']] };

function copyControls(writeText = jest.fn().mockResolvedValue({ status: 'success' }), disabled = false) {
  return { writeText, screen: render(
    <TableControls table={table} capabilities={{ clipboard: { writeText } }} translations={defaultTranslations} disabled={disabled}>
      <Text>table</Text>
    </TableControls>
  ) };
}

describe('TableCopyDropdown native outcome', () => {
  // parity:77d755e0c4372bf527d48b23095de5e0bcd7088d4b7cff3efa9ae633beb17447
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

  // parity:50b0a384a70348cdf5c7fcc49ca803bed7391a233064f4f313ee2faff7468b04
  it('uses custom native visual children without changing the accessible name', () => {
    const screen = render(<ActionButton label="Copy table" icon={<Text testID="custom-copy">C</Text>} onAction={() => ({ status: 'success' })} />);
    expect(screen.getByRole('button', { name: 'Copy table' })).toBeTruthy();
    expect(screen.getByTestId('custom-copy')).toBeTruthy();
  });
});

describe('TableCopyDropdown case-specific native proof', () => {
  // parity:9cd465834749116f4b34ca655ea7a883b39dd9c09d94a156a7f54191b8970624
  it('renders an accessible copy dropdown button', () => expect(copyControls().screen.getByRole('button', { name: 'Copy table' })).toBeTruthy());
  // parity:75c3b9c433af97e35dda48eaf306feb8b9370187c0e9c80ed3c300dffcd0945b
  it('disables copy while animation is active', () => expect(copyControls(undefined, true).screen.getByRole('button', { name: 'Copy table' }).props.accessibilityState.disabled).toBe(true));
  // parity:9679f37b21e2b67cd1725fb15208b3963f040e426cf9cebf5558aa6a399333f5
  it('toggles the copy menu on button press', () => {
    const { screen } = copyControls();
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    expect(screen.getByTestId('dropdown-popup')).toBeTruthy();
  });
  // parity:99fac3b269ec549eab5320b840da4a34f432007d13860a00d11746604f07a8f6
  it('shows CSV and TSV menu options', () => {
    const { screen } = copyControls();
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    expect(screen.getByRole('menuitem', { name: 'Copy table as CSV' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Copy table as TSV' })).toBeTruthy();
  });
  // parity:30ee54240960bac29bbb6d1a6b48aa851708c19f5a02d429ca5bcc0a7507da99
  it('copies CSV from the selected option', async () => {
    const { screen, writeText } = copyControls();
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Name,City\nAda,London'));
  });
  // parity:2f5266d3c43b6f2b25c599a7909d00057e3d8509ce36b0119cddc3b9c2f3c904
  it('copies TSV from the selected option', async () => {
    const { screen, writeText } = copyControls();
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as TSV' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Name\tCity\nAda\tLondon'));
  });
  // parity:aaedb52f8c97784e2af7801952ff088321813780896026bc5c42d46cf4dd5077
  it('announces success after copying', async () => {
    const { screen } = copyControls();
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy());
  });
  it('shows a scoped custom check for every format and restarts the reset buffer', async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue({ status: 'success' });
    const screen = render(
      <TableControls
        table={table}
        capabilities={{ clipboard: { writeText } }}
        translations={defaultTranslations}
        icons={{ copy: <Text testID="table-copy">copy</Text>, check: <Text testID="table-check">check</Text> }}
      ><Text>table</Text></TableControls>
    );
    const select = async (name: string) => {
      fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
      fireEvent.press(screen.getByRole('menuitem', { name }));
      await act(async () => undefined);
      expect(screen.getByTestId('table-check')).toBeTruthy();
    };
    await select('Copy table as Markdown');
    act(() => jest.advanceTimersByTime(1500));
    await select('Copy table as CSV');
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByTestId('table-check')).toBeTruthy();
    await select('Copy table as TSV');
    expect(writeText).toHaveBeenNthCalledWith(1, '| Name | City |\n| --- | --- |\n| Ada | London |');
    expect(writeText).toHaveBeenNthCalledWith(2, 'Name,City\nAda,London');
    expect(writeText).toHaveBeenNthCalledWith(3, 'Name\tCity\nAda\tLondon');
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByTestId('table-copy')).toBeTruthy();
    expect(screen.queryByTestId('table-check')).toBeNull();
    jest.useRealTimers();
  });

  it('keeps the copy icon for rejected and non-success outcomes', async () => {
    const writeText = jest.fn()
      .mockResolvedValueOnce({ status: 'denied' })
      .mockRejectedValueOnce(new Error('copy failed'));
    const screen = render(
      <TableControls
        table={table}
        capabilities={{ clipboard: { writeText } }}
        translations={defaultTranslations}
        icons={{ copy: <Text testID="table-copy">copy</Text>, check: <Text testID="table-check">check</Text> }}
      ><Text>table</Text></TableControls>
    );
    for (const [index, message] of ['Action denied', 'copy failed'].entries()) {
      if (index === 0) fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
      fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
      await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
      expect(screen.getByTestId('table-copy')).toBeTruthy();
      expect(screen.queryByTestId('table-check')).toBeNull();
    }
  });

  it('keeps inline and fullscreen copy feedback scoped', async () => {
    const screen = render(
      <TableControls
        table={table}
        capabilities={{ clipboard: { writeText: jest.fn().mockResolvedValue({ status: 'success' }) } }}
        translations={defaultTranslations}
        icons={{ copy: <Text testID="table-copy">copy</Text>, check: <Text testID="table-check">check</Text> }}
      ><Text>table</Text></TableControls>
    );
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    const buttons = screen.getAllByRole('button', { name: 'Copy table' });
    fireEvent.press(buttons[1]);
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await act(async () => undefined);
    expect(buttons[0].findByProps({ testID: 'table-copy' })).toBeTruthy();
    expect(buttons[1].findByProps({ testID: 'table-check' })).toBeTruthy();
  });
  // parity:8137a275411e9f6934221677d90a36abf769830b90a96c744b82f70096d3d530
  it('closes the menu after copying', async () => {
    const { screen, writeText } = copyControls();
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('dropdown-popup')).toBeNull());
  });
  // parity:a3d3828417b75315875814a16a3e8248fcbcfefa217f2cf012ddebcdac5ba709
  it('closes the menu when its trigger is pressed again', () => {
    const { screen } = copyControls();
    const button = screen.getByRole('button', { name: 'Copy table' });
    fireEvent.press(button);
    fireEvent.press(button);
    expect(screen.queryByTestId('dropdown-popup')).toBeNull();
  });
  it('does not expose a copy action without table clipboard capability', () => {
    const screen = render(<TableControls table={table} capabilities={{}} translations={defaultTranslations}><Text>table</Text></TableControls>);
    expect(screen.queryByRole('button', { name: 'Copy table' })).toBeNull();
  });
  // parity:3f6d7ff7e370d030057b3c84254b9d5fddd4cbcb1def86f00db0e582c9c4ea39
  it('does not expose a copy action without a clipboard adapter', () => {
    const screen = render(<TableControls table={table} capabilities={{ files: { save: jest.fn() } }} translations={defaultTranslations}><Text>table</Text></TableControls>);
    expect(screen.queryByRole('button', { name: 'Copy table' })).toBeNull();
  });
  // parity:eab3cf2fa1b4ca7f98d1c610303bb6dc746236e8ca3dd34920ed4ae9538dd9a7
  it('surfaces clipboard write errors', async () => {
    const { screen } = copyControls(jest.fn().mockRejectedValue(new Error('copy failed')));
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(screen.getByText('copy failed')).toBeTruthy());
  });
  // parity:49893b21f2a968c4c6d066c7f4e6debb22b231a512ea5d32850a1da7cd44308a
  it('supports a custom native copy visual', () => {
    const screen = render(<ActionButton label="Copy table" icon={<Text testID="copy-visual">C</Text>} onAction={() => ({ status: 'success' })} />);
    expect(screen.getByTestId('copy-visual')).toBeTruthy();
  });
  // parity:c789fb70d25034b13ed8b2fcb1ec3b815e7ff642350e8e16a5d368d10f033d54
  it('cleans up copied-state timeout on unmount', () => {
    jest.useFakeTimers();
    const screen = render(<ActionButton label="Copy table" successMessage="Copied" resetAfterMs={20} onAction={() => ({ status: 'success' })} />);
    fireEvent.press(screen.getByRole('button'));
    screen.unmount();
    act(() => jest.runOnlyPendingTimers());
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
  // parity:c967e4bc04ff73beeef96f30a0da95a36e2f3a8373a83a4c4a03e3dddaea5a01
  it('unmounts an open native menu without pending interaction state', () => {
    const { screen } = copyControls();
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    expect(() => screen.unmount()).not.toThrow();
  });
});
