import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TableControls } from '../../../../src/controls/TableControls';
import { defaultTranslations } from '../../../../src/controls/translations';
import { tableFileRequest } from '../../../../src/controls/serialization';

describe('table direct-action native substitute', () => {
  const table = { headers: ['A'], rows: [['B']] };
  it('provides direct CSV/Markdown downloads with CSV as the default file outcome', () => {
    expect(tableFileRequest(table, 'csv')).toMatchObject({ extension: 'csv' });
    expect(tableFileRequest(table, 'markdown')).toMatchObject({ extension: 'md' });
  });
  it('hides missing adapters and surfaces provider failures accessibly without DOM lookup/outside listeners', async () => {
    const screen = render(<TableControls table={table} capabilities={{}} translations={defaultTranslations}><Text>body</Text></TableControls>);
    expect(screen.queryByRole('button', { name: 'Copy table' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download table' })).toBeNull();
    screen.rerender(<TableControls table={table} capabilities={{
      clipboard: { writeText: async () => { throw new Error('write failed'); } },
      files: { save: async () => { throw new Error('save failed'); } },
    }} translations={defaultTranslations}><Text>body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('button', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(screen.getByText('write failed')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('button', { name: 'Download table as CSV' }));
    await waitFor(() => expect(screen.getByText('save failed')).toBeTruthy());
  });
});
