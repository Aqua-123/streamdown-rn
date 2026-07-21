import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Streamdown } from '../../StreamdownRN';

describe('native markdown controls', () => {
  // parity:269d04432066d1280c2dd71918500ca9e34655cccfe81020b2c8eb13143e54ad
  // parity:1dfc4e436e6cfaad77ebfcae74cefb5ccf8a4da6a3751eb3333fc9bece1aacbb
  // parity:f015083a2af9400dd333abd0d53aa616b1be53595fd0a4d5f9e8018238627bb4
  // parity:1bb44002a69c22fa9b4f27c43d1ef38342a2c8e09cbafa960c924893c76b3df1
  // parity:8d502f0f1ebe4a1f087d50dfd396dfe5834e59784f2da18dc539ee2fe4105aeb
  // parity:ad2072cf2e1e0593afa890b82c75876e10ad9fdac00e8e759a29e92127cf7109
  // parity:be6a60b7cb81d2a6d47f6ca263ae2f733034ae8b7be9c398f346c9a0d52a57a8
  // parity:a9e4cf5562250ed6c82afdfd81cb85945b59fe7b595be6d7bc8c7091751e9dbd
  // parity:acc46491093e6e48224f9da31f46dc04cc16bfaac5bf7bc2ebd7e9e2c45a0c10
  // parity:fc2f308a7639b842dd4f560a2404511b162d7ab71b42b9c038b0e9a6104d7681
  // parity:7d65f93a40925a0feac1c92f96ba75b682185abadf62cf1577424fee8aba8be4
  // parity:ffe46b9cca3eaafc0584efc823fc44db9a95e54cb7c04d6770b1d69e4e246cd2
  // parity:e25c3bdb0628dfc682ddedf3edd7a342235e66d186df09ed7b2bbd1858018103
  // parity:931f836d1f5410d56e7ed39d0f577726bc8bcf2ffa88a2c7dbe5f2c99afec3ba
  // parity:cda3b65d2ab72004c6d94bdf6551a649a816f39d3f2b5cb7c275c66946b8cb60
  // parity:54b9b3720aeeaf7bdda8c1d70142deae2e9a03977249dbe68ed55de420e09fce
  it('copies code only when a clipboard provider exists', async () => {
    const writeText = jest.fn().mockResolvedValue({ status: 'success' });
    const markdown = '```js\nconsole.log("✓")\n```';
    const screen = render(<Streamdown mode="static" capabilities={{ clipboard: { writeText } }}>{markdown}</Streamdown>);
    fireEvent.press(screen.getByRole('button', { name: 'Copy Code' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('console.log("✓")'));

    screen.rerender(<Streamdown mode="static">{markdown}</Streamdown>);
    expect(screen.queryByRole('button', { name: 'Copy Code' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download file' })).toBeNull();
  });

  it('copies table formats and passes fixed download metadata to the adapter', async () => {
    const writeText = jest.fn().mockResolvedValue({ status: 'success' });
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const markdown = '| Name | City |\n| --- | --- |\n| Zoë | 東京 |';
    const screen = render(
      <Streamdown mode="static" capabilities={{ clipboard: { writeText }, files: { save } }}>{markdown}</Streamdown>
    );

    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Name,City\nZoë,東京'));
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as TSV' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Name\tCity\nZoë\t東京'));
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as Markdown' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('| Zoë | 東京 |')));
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      basename: 'table', extension: 'csv', mimeType: 'text/csv;charset=utf-8', content: '\uFEFFName,City\nZoë,東京',
    })));
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as Markdown' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      basename: 'table', extension: 'md', mimeType: 'text/markdown;charset=utf-8',
    })));
  });

  it('opens and dismisses a table modal by control, system back, and accessibility escape', () => {
    const restore = jest.fn();
    const markdown = '| A |\n| --- |\n| B |';
    const screen = render(<Streamdown mode="static" capabilities={{ focus: { restore } }}>{markdown}</Streamdown>);
    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    const modal = screen.getByRole('alert', { name: 'Table fullscreen' });
    expect(modal.props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getAllByText('B')).toHaveLength(2);
    fireEvent.press(screen.getByRole('button', { name: 'Exit fullscreen' }));
    expect(screen.queryByRole('alert', { name: 'Table fullscreen' })).toBeNull();
    expect(restore).not.toHaveBeenCalled();
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss');

    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    expect(screen.queryByRole('alert', { name: 'Table fullscreen' })).toBeNull();
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss');

    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    const reopened = screen.getByRole('alert', { name: 'Table fullscreen' });
    fireEvent(reopened, 'accessibilityAction', { nativeEvent: { actionName: 'escape' } });
    expect(screen.queryByRole('alert', { name: 'Table fullscreen' })).toBeNull();
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss');
    expect(restore).toHaveBeenCalledTimes(3);
    expect(restore).toHaveBeenLastCalledWith(expect.anything());
  });

  it('keeps table control and content chrome as separate inline and fullscreen layers', () => {
    const markdown = '| A |\n| --- |\n| B |';
    const screen = render(<Streamdown mode="static">{markdown}</Streamdown>);
    const outerSurfaces = () => screen.UNSAFE_getAllByType(View).filter(({ props }) => {
      const style = StyleSheet.flatten(props.style);
      return style?.borderWidth === 1 && style?.borderRadius === 8 && style?.padding === 8;
    });
    const innerSurfaces = () => screen.UNSAFE_getAllByType(ScrollView).filter(({ props }) => {
      const style = StyleSheet.flatten(props.style);
      return style?.borderWidth === 1 && style?.borderRadius === 6;
    });
    const toolbars = () => screen.UNSAFE_getAllByType(View).filter(({ props }) => props.accessibilityRole === 'toolbar');

    expect(outerSurfaces()).toHaveLength(1);
    expect(innerSurfaces()).toHaveLength(1);
    expect(StyleSheet.flatten(toolbars()[0].props.style)).toMatchObject({ alignItems: 'center', gap: 4 });

    fireEvent.press(screen.getByRole('button', { name: 'View fullscreen' }));
    expect(outerSurfaces()).toHaveLength(1);
    expect(innerSurfaces()).toHaveLength(2);
    expect(toolbars().map(({ props }) => StyleSheet.flatten(props.style)))
      .toEqual([expect.objectContaining({ gap: 4 }), expect.objectContaining({ gap: 4 })]);
  });

  it('honors control visibility and translated labels', () => {
    // parity:63b8719bfee1b57274bade70f75851286ba4d81c150d3335d411b89a7df8bb61
    // parity:c1a64514e681e3a8ed16e69b488de6af37cd17596635be9e293f407612093e2b
    // parity:1f6e0a13569e2b6cbd6d8ee0989a5cfb3b2a3a355a721a4c603a01dae91a2e78
    const markdown = '```txt\nhello\n```';
    const screen = render(
      <Streamdown mode="static" capabilities={{ clipboard: { writeText: jest.fn() } }} controls={{ code: { copy: true, download: false } }} translations={{ copyCode: 'Kopieren' }}>
        {markdown}
      </Streamdown>
    );
    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download file' })).toBeNull();
  });

  it('models denied, cancelled, and thrown adapter actions as accessible feedback', async () => {
    // parity:d2965b26f66379748b0801212f602be0799cbbd5a421414219d29a190a1ef135
    // parity:97ebb8966bb6928a4bb0ca9d67403d97e5d49476c06bc9900c70ea20c1979651
    // parity:3d6ab31d58191711adbb0740aa9715ab89f7be8395df52478592d95b1dbf7cbe
    const markdown = '```txt\nhello\n```';
    const screen = render(<Streamdown mode="static" capabilities={{
      clipboard: { writeText: async () => ({ status: 'cancelled' }) },
      files: { save: async () => { throw new Error('disk full'); } },
    }}>{markdown}</Streamdown>);
    fireEvent.press(screen.getByRole('button', { name: 'Copy Code' }));
    await waitFor(() => expect(screen.getByText('Action cancelled')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Download file' }));
    await waitFor(() => expect(screen.getByText('disk full')).toBeTruthy());

    screen.rerender(<Streamdown mode="static" capabilities={{
      clipboard: { writeText: async () => ({ status: 'denied' }) },
    }}>{markdown}</Streamdown>);
    fireEvent.press(screen.getByRole('button', { name: 'Copy Code' }));
    await waitFor(() => expect(screen.getByText('Action denied')).toBeTruthy());

    screen.rerender(<Streamdown mode="static" capabilities={{
      clipboard: { writeText: async () => { throw new Error('clipboard failed'); } },
    }}>{markdown}</Streamdown>);
    fireEvent.press(screen.getByRole('button', { name: 'Copy Code' }));
    await waitFor(() => expect(screen.getByText('clipboard failed')).toBeTruthy());

    const table = '| A |\n| --- |\n| B |';
    screen.rerender(<Streamdown mode="static" capabilities={{
      clipboard: { writeText: async () => { throw new Error('table copy failed'); } },
      files: { save: async () => { throw new Error('table save failed'); } },
    }}>{table}</Streamdown>);
    fireEvent.press(screen.getByRole('button', { name: 'Download table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Download table as CSV' }));
    await waitFor(() => expect(screen.getByText('table save failed')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(screen.getByText('table copy failed')).toBeTruthy());
    expect(screen.getByRole('menuitem', { name: 'Copy table as CSV' })).toBeTruthy();
  });

  it('keeps successful table copy feedback visible after its menu closes', async () => {
    const table = '| A |\n| --- |\n| B |';
    const screen = render(<Streamdown mode="static" capabilities={{
      clipboard: { writeText: async () => ({ status: 'success' }) },
    }}>{table}</Streamdown>);
    fireEvent.press(screen.getByRole('button', { name: 'Copy table' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Copy table as CSV' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Copied'));
    expect(screen.queryByRole('menuitem', { name: 'Copy table as CSV' })).toBeNull();
  });

  it('hides unavailable table actions while leaving fullscreen available', () => {
    const table = '| A |\n| --- |\n| B |';
    const screen = render(<Streamdown mode="static">{table}</Streamdown>);
    expect(screen.queryByRole('button', { name: 'Copy table' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download table' })).toBeNull();
    expect(screen.getByRole('button', { name: 'View fullscreen' })).toBeTruthy();
  });

  it('disables active streaming controls and hides configured families', () => {
    // parity:4c93ad94a184de9188aa5071ae70023dfc6cc65a38eb825d95f12748af249e8f
    // parity:b868c65acef28b7f80ad3f3996f5bd89e9115ca7ff53b1a50b01a78017603196
    // parity:fa7be671051a1c375770411e14af685f2942615729d94c7008fc354156388fde
    const table = '| A |\n| --- |\n| B |';
    const screen = render(<Streamdown isAnimating>{table}</Streamdown>);
    expect(screen.getByRole('button', { name: 'View fullscreen' }).props.accessibilityState).toMatchObject({ disabled: true });
    screen.rerender(<Streamdown mode="static" controls={{ table: false, code: false }}>{`${table}\n\n\`\`\`txt\nhello\n\`\`\``}</Streamdown>);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('disables controls in finalized blocks while the response is still streaming', () => {
    const markdown = '```txt\nstable\n```\n\nactive';
    const screen = render(<Streamdown isAnimating capabilities={{ clipboard: { writeText: jest.fn() } }}>{markdown}</Streamdown>);
    expect(screen.getByRole('button', { name: 'Copy Code' }).props.accessibilityState)
      .toMatchObject({ disabled: true });
  });
});
