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
    const screen = render(<TableControls table={table} capabilities={{ files: { save } }} translations={defaultTranslations} icons={{ download: <Text testID="save-icon">S</Text> }}><Text>body</Text></TableControls>);
    expect(screen.getAllByTestId('save-icon')).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('button', { name: 'Download table as CSV' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ extension: 'csv' })));
    screen.rerender(<TableControls table={table} capabilities={{ files: { save } }} translations={defaultTranslations} disabled><Text>body</Text></TableControls>);
    expect(screen.getByRole('button', { name: 'Download table' }).props.accessibilityState.disabled).toBe(true);
  });
  it('hides an unavailable save action and surfaces provider failures without a DOM table lookup', async () => {
    const screen = render(<TableControls table={table} capabilities={{}} translations={defaultTranslations}><Text>body</Text></TableControls>);
    expect(screen.queryByRole('button', { name: 'Download table' })).toBeNull();
    screen.rerender(<TableControls table={table} capabilities={{ files: { save: () => { throw new Error('File save failed'); } } }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('button', { name: 'Download table as CSV' }));
    await waitFor(() => expect(screen.getByText('File save failed')).toBeTruthy());
  });
});
