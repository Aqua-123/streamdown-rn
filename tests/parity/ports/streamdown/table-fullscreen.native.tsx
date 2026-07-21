import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TableControls } from '../../../../src/controls/TableControls';
import { defaultTranslations } from '../../../../src/controls/translations';

describe('TableFullscreenButton native modal', () => {
  it('keeps copy and download actions available inside the native modal', () => {
    const screen = render(<TableControls table={{ headers: ['A'], rows: [['B']] }} capabilities={{ clipboard: { writeText: jest.fn() }, files: { save: jest.fn() } }} translations={defaultTranslations}><Text>Table body</Text></TableControls>);
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(screen.getAllByRole('button', { name: 'Copy table' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Download table' })).toHaveLength(2);
    fireEvent.press(screen.getAllByRole('button', { name: 'Copy table' })[1]);
    expect(screen.getByRole('button', { name: 'Copy table as CSV' })).toBeTruthy();
    fireEvent.press(screen.getAllByRole('button', { name: 'Download table' })[1]);
    expect(screen.getByRole('button', { name: 'Download table as CSV' })).toBeTruthy();
  });
});
