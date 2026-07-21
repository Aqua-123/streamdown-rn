import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Modal, Text } from 'react-native';
import { TableControls } from '../../../../src/controls/TableControls';
import { defaultTranslations } from '../../../../src/controls/translations';
import { tableFileRequest } from '../../../../src/controls/serialization';

describe('table format dropdowns', () => {
  const table = { headers: ['A'], rows: [['B']] };
  it('provides direct CSV/Markdown downloads with CSV as the default file outcome', () => {
    expect(tableFileRequest(table, 'csv')).toMatchObject({ extension: 'csv' });
    expect(tableFileRequest(table, 'markdown')).toMatchObject({ extension: 'md' });
  });
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
