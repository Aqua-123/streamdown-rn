import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Modal, Text } from 'react-native';
import { TableControls } from '../../../../src/controls/TableControls';
import { defaultTranslations } from '../../../../src/controls/translations';
import { tableFileRequest } from '../../../../src/controls/serialization';

describe('table format dropdowns', () => {
  const table = { headers: ['A'], rows: [['B']] };
  const capabilities = {
    clipboard: { writeText: jest.fn(() => ({ status: 'success' as const })) },
    files: { save: jest.fn(() => ({ status: 'success' as const })) },
  };

  it('closes the download dropdown from the native outside-dismiss surface', () => {
    const screen = render(<TableControls table={table} capabilities={capabilities} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.UNSAFE_getByProps({ testID: 'dropdown-dismiss' }));
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();
  });
  // parity:b901d8eac877500ca9d3c52dd819e5b8929c2d771f705fbb5cbf8313ed34256f
  it('closes the copy dropdown from the native outside-dismiss surface', () => {
    const screen = render(<TableControls table={table} capabilities={capabilities} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.UNSAFE_getByProps({ testID: 'dropdown-dismiss' }));
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();
  });

  it('reports a failed table download and keeps the selection available', async () => {
    const screen = render(<TableControls table={table} capabilities={{ files: { save: async () => { throw new Error('download failed'); } } }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('download failed'));
    expect(screen.getByRole('menuitem', { name: 'Download table as CSV' })).toBeTruthy();
  });

  // parity:0311c9ae62eb092651ea608da552aae4a21ad9522e2eafca86eafaf66ca01722
  it('reports a failed clipboard write and keeps the copy selection available', async () => {
    const screen = render(<TableControls table={table} capabilities={{ clipboard: { writeText: async () => { throw new Error('copy failed'); } } }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('copy failed'));
    expect(screen.getByRole('menuitem', { name: 'Copy table as CSV' })).toBeTruthy();
  });

  // parity:d6903a7fe748d253326f99b5947b424f7c02863761a7e8f821ff9788362c80cd
  it('provides direct CSV/Markdown downloads with CSV as the default file outcome', () => {
    expect(tableFileRequest(table, 'csv')).toMatchObject({ extension: 'csv' });
    expect(tableFileRequest(table, 'markdown')).toMatchObject({ extension: 'md' });
  });
  // parity:0104e4c89e2a499fe0e2a5af9a377955a9df08248cc9ef60085dda2a772fc302
  it('downloads Markdown with the native md file extension', () => {
    expect(tableFileRequest(table, 'markdown')).toMatchObject({ extension: 'md' });
  });
  // parity:d1c4498e776ceb036574b022bc40433969607eb80fad6949daed71b16c8644d7
  it('opens one labelled menu, switches formats, and dismisses outside or through the system', () => {
    const screen = render(<TableControls table={table} capabilities={{
      clipboard: { writeText: jest.fn(() => ({ status: 'success' })) },
      files: { save: jest.fn(() => ({ status: 'success' })) },
    }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    const copy = screen.getByRole('button', { name: 'Copy table' });
    const download = screen.getByRole('button', { name: 'Download table' });
    expect(copy.props.accessibilityState).toMatchObject({ expanded: false });
    expect(download.props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();

    fireEvent.press(copy);
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'menu', accessibilityLabel: 'Copy table' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map((item) => item.props.accessibilityLabel)).toEqual([
      'Copy table as Markdown', 'Copy table as CSV', 'Copy table as TSV',
    ]);
    expect(screen.getByRole('button', { name: 'Copy table' }).props.accessibilityState).toMatchObject({ expanded: true });

    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    expect(screen.UNSAFE_getAllByType(Modal).filter((modal) => modal.props.visible)).toHaveLength(1);
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'menu', accessibilityLabel: 'Download table' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map((item) => item.props.accessibilityLabel)).toEqual([
      'Download table as CSV', 'Download table as Markdown',
    ]);
    expect(screen.getByRole('button', { name: 'Copy table' }).props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.getByRole('button', { name: 'Download table' }).props.accessibilityState).toMatchObject({ expanded: true });

    fireEvent.press(screen.UNSAFE_getByProps({ testID: 'dropdown-dismiss' }));
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent(screen.UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible)!, 'requestClose');
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();
  });

  it('restores focus to the trigger whose menu closed', () => {
    jest.useFakeTimers();
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
    const renderer = require('react-native/Libraries/ReactNative/RendererProxy');
    const find = jest.spyOn(renderer, 'findNodeHandle').mockImplementation((node: any) => node?.props?.accessibilityLabel === 'Download table' ? 22 : 11);
    const schedule = jest.spyOn(global, 'setTimeout');
    const screen = render(<TableControls table={table} capabilities={{
      clipboard: { writeText: jest.fn(() => ({ status: 'success' })) },
      files: { save: jest.fn(() => ({ status: 'success' })) },
    }} translations={defaultTranslations}><Text>body</Text></TableControls>);

    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.UNSAFE_getByProps({ testID: 'dropdown-dismiss' }));
    expect(schedule).toHaveBeenCalled();
    act(() => jest.runOnlyPendingTimers());
    expect((find.mock.calls[0][0] as any).props.accessibilityLabel).toBe('Download table');
    expect(focus).toHaveBeenCalledWith(22);

    schedule.mockRestore();
    find.mockRestore();
    focus.mockRestore();
    jest.useRealTimers();
  });

  it('hides missing adapters and keeps thrown or non-success selections open for retry', async () => {
    const screen = render(<TableControls table={table} capabilities={{}} translations={defaultTranslations}><Text>body</Text></TableControls>);
    expect(screen.queryByRole('button', { name: 'Copy table' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download table' })).toBeNull();
    screen.rerender(<TableControls table={table} capabilities={{
      clipboard: { writeText: async () => { throw new Error('write failed'); } },
      files: { save: async () => { throw new Error('save failed'); } },
    }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(screen.getByText('write failed')).toBeTruthy());
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'menu' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(screen.getByText('save failed')).toBeTruthy());
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'menu' })).toBeTruthy();

    const save = jest.fn()
      .mockResolvedValueOnce({ status: 'denied' })
      .mockResolvedValueOnce({ status: 'success' });
    screen.rerender(<TableControls table={table} capabilities={{ files: { save } }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Action denied'));
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'menu' })).toBeTruthy();
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull());
  });

  it('isolates fullscreen menu state, clears it on close, and disables streaming triggers', () => {
    const capabilities = {
      clipboard: { writeText: jest.fn(() => ({ status: 'success' as const })) },
      files: { save: jest.fn(() => ({ status: 'success' as const })) },
    };
    const screen = render(<TableControls table={table} capabilities={capabilities} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    let copyTriggers = screen.getAllByRole('button', { name: 'Copy table' });
    fireEvent.press(copyTriggers[1]);
    copyTriggers = screen.getAllByRole('button', { name: 'Copy table' });
    expect(copyTriggers[0].props.accessibilityState).toMatchObject({ expanded: false });
    expect(copyTriggers[1].props.accessibilityState).toMatchObject({ expanded: true });
    fireEvent.press(screen.getByRole('button', { name: 'Exit fullscreen' }));
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    copyTriggers = screen.getAllByRole('button', { name: 'Copy table' });
    expect(copyTriggers[1].props.accessibilityState).toMatchObject({ expanded: false });
    fireEvent.press(screen.getByRole('button', { name: 'Exit fullscreen' }));

    screen.rerender(<TableControls table={table} capabilities={capabilities} translations={defaultTranslations} disabled><Text>body</Text></TableControls>);
    const copy = screen.getByRole('button', { name: 'Copy table' });
    const download = screen.getByRole('button', { name: 'Download table' });
    expect(copy.props.accessibilityState).toMatchObject({ disabled: true, expanded: false });
    expect(download.props.accessibilityState).toMatchObject({ disabled: true, expanded: false });
    fireEvent.press(copy);
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();
  });
});
