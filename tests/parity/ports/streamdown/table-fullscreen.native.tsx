import { fireEvent, render } from '@testing-library/react-native';
import { Modal, ScrollView, Text, View } from 'react-native';
import { TableControls } from '../../../../src/controls/TableControls';
import { defaultTranslations } from '../../../../src/controls/translations';

describe('TableFullscreenButton native modal', () => {
  const table = { headers: ['A'], rows: [['B']] };
  const capabilities = { clipboard: { writeText: jest.fn() }, files: { save: jest.fn() } };
  const setup = (extra = {}) => render(<TableControls table={table} capabilities={capabilities} translations={defaultTranslations} {...extra}><Text testID="table-content">body</Text></TableControls>);
  const fullscreenModal = (screen: ReturnType<typeof setup>) => screen.UNSAFE_getAllByType(Modal).find((modal) => modal.props.transparent === false)!;

  // parity:b4134ff414df62a2df3c7babe5b245ba91bb088547cf82abe4dff20a8da07ea8
  it('hides the fullscreen action when all controls are disabled', () => {
    expect(setup({ controls: false }).queryByRole('button', { name: 'View fullscreen' })).toBeNull();
  });

  // parity:cff8e0b41416cf6ae5b3bf0ee9c0e9891120fbd15ec51c1ad7b2ea2d7c426e64
  it('hides only the fullscreen action when table fullscreen is disabled', () => {
    const screen = setup({ controls: { table: { fullscreen: false } } });
    expect(screen.queryByRole('button', { name: 'View fullscreen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy table' })).toBeTruthy();
  });

  it('uses a full-screen native modal while open', () => {
    const screen = setup();
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(fullscreenModal(screen).props).toMatchObject({ visible: true, transparent: false });
  });

  // parity:ead8900f5c27f9f53453abdbeb4edc25625ea4d2d5e1ac8cb7326bd164a6b4e2
  it('shows copy and download actions inside fullscreen', () => {
    const screen = setup();
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(screen.getAllByRole('button', { name: 'Copy table' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Download table' })).toHaveLength(2);
  });

  // parity:df507845615fc9958d3b1d177d7e74eb299be76bd0d0eeb55552d9e5525fcacd
  it('keeps fullscreen open when an inner control is pressed', () => {
    const screen = setup();
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    fireEvent.press(screen.getAllByRole('button', { name: 'Copy table' })[1]);
    expect(fullscreenModal(screen).props.visible).toBe(true);
  });

  // parity:0b8d95e79b5718f03da7ad84a07018cb6e01c2839553437a4bce1a1aa6a8e5c1
  it('keeps fullscreen open when table content is pressed', () => {
    const screen = setup();
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    fireEvent(screen.getAllByTestId('table-content')[1], 'press');
    expect(fullscreenModal(screen).props.visible).toBe(true);
  });

  // parity:887ddef4c4b9d97dff57606f11e69c7c19b983d4496dec1d456a47dc7550b69a
  it('keeps fullscreen open on keyDown inside the inner presentation content', () => {
    const screen = setup();
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    fireEvent(screen.getAllByTestId('table-content')[1], 'keyDown', { nativeEvent: { key: 'Enter' } });
    expect(fullscreenModal(screen).props.visible).toBe(true);
  });

  // parity:adfef418dda5b1fd00771130c007929c90703b4e8d13815964b3f6b4c642cd59
  it('closes fullscreen through the native backdrop-equivalent request', () => {
    const screen = setup();
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    fireEvent(fullscreenModal(screen), 'requestClose');
    expect(fullscreenModal(screen).props.visible).toBe(false);
  });

  // parity:3f3bccf349b03f5ce3ab2dba0b5147750921b88da340894d8e52ba0ec0b934a2
  it('hides copy inside fullscreen when table copy is disabled', () => {
    const screen = setup({ controls: { table: { copy: false } } });
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(screen.queryByRole('button', { name: 'Copy table' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Download table' })).toHaveLength(2);
  });

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
