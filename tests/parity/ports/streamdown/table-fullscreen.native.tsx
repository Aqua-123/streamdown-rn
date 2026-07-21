import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView, Text, View } from 'react-native';
import { TableControls } from '../../../../src/controls/TableControls';
import { defaultTranslations } from '../../../../src/controls/translations';

describe('TableFullscreenButton native modal', () => {
  it('keeps tall, wide table content and actions reachable on both axes', () => {
    const headers = Array.from({ length: 12 }, (_, index) => `Column ${index}`);
    const rows = Array.from({ length: 30 }, (_, row) => headers.map((_, column) => `${row}:${column}`));
    const screen = render(<TableControls table={{ headers, rows }} capabilities={{ clipboard: { writeText: jest.fn() }, files: { save: jest.fn() } }} translations={defaultTranslations}>
      <ScrollView horizontal testID="table-horizontal-scroll"><View>{rows.map((row) => <Text key={row[0]}>{row.join(' ')}</Text>)}</View></ScrollView>
    </TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(screen.getByTestId('fullscreen-content-document').props.horizontal).toBeFalsy();
    expect(screen.getAllByTestId('table-horizontal-scroll')[1].props.horizontal).toBe(true);
    expect(screen.getAllByText(rows[29].join(' '))).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Copy table' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Download table' })).toHaveLength(2);
    fireEvent.press(screen.getAllByRole('button', { name: 'Copy table' })[1]);
    expect(screen.getByRole('menuitem', { name: 'Copy table as CSV' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Exit fullscreen' }));
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(screen.queryByRole('menuitem', { name: 'Copy table as CSV' })).toBeNull();
  });
});
