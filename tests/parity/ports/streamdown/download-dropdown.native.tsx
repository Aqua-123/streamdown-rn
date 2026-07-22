import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TableControls } from '../../../../src/controls/TableControls';
import { defaultTranslations } from '../../../../src/controls/translations';
import { tableFileRequest } from '../../../../src/controls/serialization';

describe('TableDownload controls native outcomes', () => {
  const table = { headers: ['Name'], rows: [['Ada']] };
  it('uses fixed CSV/Markdown metadata and sanitized custom filenames', () => {
    expect(tableFileRequest(table, 'csv', '../people')).toMatchObject({ basename: 'people', extension: 'csv', mimeType: 'text/csv;charset=utf-8' });
    expect(tableFileRequest(table, 'markdown', 'people')).toMatchObject({ basename: 'people', extension: 'md', mimeType: 'text/markdown;charset=utf-8' });
  });
  it('renders default/custom visuals, disables while streaming, and invokes file adapters', async () => {
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const screen = render(<TableControls table={table} capabilities={{ files: { save } }} translations={defaultTranslations} icons={{ download: <Text testID="save-icon">S</Text> }} color="#123456"><Text>body</Text></TableControls>);
    expect(screen.getAllByTestId('save-icon')).toHaveLength(1);
    expect(screen.getByTestId('save-icon').props.color).toBe('#123456');
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ extension: 'csv' })));
    screen.rerender(<TableControls table={table} capabilities={{ files: { save } }} translations={defaultTranslations} disabled><Text>body</Text></TableControls>);
    expect(screen.getByRole('button', { name: 'Download table' }).props.accessibilityState.disabled).toBe(true);
  });
  // parity:14ebfb8a44fc6811f07bd1feb81790e2ceaeabf73ac043d619c8c3c5bf1ad82f
  it('uses CSV as the first default native download format', async () => {
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const screen = render(<TableControls table={table} capabilities={{ files: { save } }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    const options = screen.getAllByRole('menuitem');
    expect(options.map((option) => option.props.accessibilityLabel)).toEqual([
      'Download table as CSV',
      'Download table as Markdown',
    ]);
    fireEvent.press(options[0]);
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ extension: 'csv', mimeType: 'text/csv;charset=utf-8' })));
  });
  // parity:1994bef4771052d282c44ac4fa72c7554b23fa3a9f5bd4fb4b7b63a2887f049b
  it('presents both CSV and Markdown native download options', () => {
    const screen = render(<TableControls table={table} capabilities={{ files: { save: jest.fn() } }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    expect(screen.getByRole('menuitem', { name: 'Download table as CSV' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Download table as Markdown' })).toBeTruthy();
  });
  it('hides an unavailable save action and surfaces provider failures without a DOM table lookup', async () => {
    const screen = render(<TableControls table={table} capabilities={{}} translations={defaultTranslations}><Text>body</Text></TableControls>);
    expect(screen.queryByRole('button', { name: 'Download table' })).toBeNull();
    screen.rerender(<TableControls table={table} capabilities={{ files: { save: () => { throw new Error('File save failed'); } } }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(screen.getByText('File save failed')).toBeTruthy());
  });
});

describe('TableDownload controls case-specific proof', () => {
  const table = { headers: ['Name'], rows: [['Ada']] };
  const controls = (save = jest.fn().mockResolvedValue({ status: 'success' }), disabled = false) => ({ save, screen: render(
    <TableControls table={table} capabilities={{ files: { save } }} translations={defaultTranslations} disabled={disabled}>
      <Text>table</Text>
    </TableControls>
  ) });

  // parity:66f657ade89a8e602d6a3e1f5561f51444278536bb315f8d3b6b20e3041fa7d2
  it('renders a download button with custom children', () => {
    const screen = render(<TableControls table={table} capabilities={{ files: { save: jest.fn() } }} translations={defaultTranslations}><Text testID="custom-child">custom</Text></TableControls>);
    expect(screen.getByTestId('custom-child')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download table' })).toBeTruthy();
  });

  // parity:24c5868c41457d4c3d83dce913caf0da14bddec4b360b9c900329f5212c218c3
  it('closes the dropdown on an outside press', () => {
    const { screen } = controls();
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.UNSAFE_getByProps({ testID: 'dropdown-dismiss' }));
    expect(screen.queryByTestId('dropdown-popup')).toBeNull();
  });

  // parity:164df7ab33684be1dc77b3663bdea0400fedd4f8c04e084819067d142f64f82c
  it('applies the custom native color contract to the dropdown trigger', () => {
    const screen = render(<TableControls table={table} capabilities={{ files: { save: jest.fn() } }} translations={defaultTranslations} icons={{ download: <Text testID="styled-dropdown">D</Text> }} color="#123456"><Text>table</Text></TableControls>);
    expect(screen.getByTestId('styled-dropdown').props.color).toBe('#123456');
  });


  // parity:eee5f64532b3d09515e6fb6ca0a4c4af9c63d27fff42f535ab5ca022521a2fc6
  it('renders a default accessible download button', () => expect(controls().screen.getByRole('button', { name: 'Download table' })).toBeTruthy());
  // parity:b816eb057e9a4af1b65df3430a1bd8d3e48894ad4f492b3b0703bfd66d7ab390
  it('renders a custom native download visual', () => {
    const screen = render(<TableControls table={table} capabilities={{ files: { save: jest.fn() } }} translations={defaultTranslations} icons={{ download: <Text testID="download-visual">D</Text> }}><Text>table</Text></TableControls>);
    expect(screen.getByTestId('download-visual')).toBeTruthy();
  });
  // parity:b06744677a9dd42f1961101e59ae83a78435bf7e9d604bd5462fc8dc70a84956
  it('disables download while animation is active', () => expect(controls(undefined, true).screen.getByRole('button', { name: 'Download table' }).props.accessibilityState.disabled).toBe(true));
  // parity:374b8fda7a10b14d6598ad28adca3db62de6ca3bccf8ccb1835873a0c76e5800
  it('creates a Markdown file request when selected', () => expect(tableFileRequest(table, 'markdown')).toMatchObject({ extension: 'md', mimeType: 'text/markdown;charset=utf-8' }));
  // parity:252728c28ccd95aabd0baa156f1c2c982f1c66de2cdf6f71a7bb6e4d790a05d0
  it('sanitizes a custom download filename', () => expect(tableFileRequest(table, 'csv', '../people').basename).toBe('people'));
  it('preserves the native visual color contract', () => {
    const screen = render(<TableControls table={table} capabilities={{ files: { save: jest.fn() } }} translations={defaultTranslations} icons={{ download: <Text testID="colored-download">D</Text> }} color="#123456"><Text>table</Text></TableControls>);
    expect(screen.getByTestId('colored-download').props.color).toBe('#123456');
  });
  // parity:d6c401c4ed6a695af03ba694ba62af4e00a8af6a2cea149344699ba04b4d9089
  it('renders a dropdown trigger', () => expect(controls().screen.getByRole('button', { name: 'Download table' })).toBeTruthy());
  it('retains a custom native child beside the dropdown', () => expect(controls().screen.getByText('table')).toBeTruthy());
  // parity:7cc26ea7f7d85c5306589e762a41175c68a0fa8cfc51ba65caf904660cca1ad4
  it('disables the dropdown trigger while streaming', () => expect(controls(undefined, true).screen.getByRole('button', { name: 'Download table' }).props.accessibilityState.disabled).toBe(true));
  // parity:15880961a9249c02854c0f7935814fe5a1d288d070b1e7e418380e6ce5bd495e
  it('toggles the download menu on press', () => {
    const { screen } = controls();
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    expect(screen.getByTestId('dropdown-popup')).toBeTruthy();
  });
  // parity:038c163254aa3340d129e77925943c21ec25895e926ba8501576bb838359750b
  it('downloads CSV from the selected option', async () => {
    const { screen, save } = controls();
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ extension: 'csv' })));
  });
  // parity:3fba954c42fda0b4d2f2cb26462966a33e7240d01040db24e48f3839da13ff29
  it('downloads Markdown from the selected option', async () => {
    const { screen, save } = controls();
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as Markdown' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ extension: 'md' })));
  });
  it('closes the menu when its native trigger is pressed again', () => {
    const { screen } = controls();
    const trigger = screen.getByRole('button', { name: 'Download table' });
    fireEvent.press(trigger);
    fireEvent.press(trigger);
    expect(screen.queryByTestId('dropdown-popup')).toBeNull();
  });
  it('hides download when no file adapter exists', () => {
    const screen = render(<TableControls table={table} capabilities={{}} translations={defaultTranslations}><Text>table</Text></TableControls>);
    expect(screen.queryByRole('button', { name: 'Download table' })).toBeNull();
  });
  it('surfaces a file adapter error', async () => {
    const { screen } = controls(jest.fn().mockRejectedValue(new Error('save failed')));
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(screen.getByText('save failed')).toBeTruthy());
  });
  // parity:501b83a5b11a37dc80a3b4612c0627a41c65160edb91c921ee15264b792c800c
  it('unmounts an open download menu without retained listeners', () => {
    const { screen } = controls();
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    expect(() => screen.unmount()).not.toThrow();
  });
});
