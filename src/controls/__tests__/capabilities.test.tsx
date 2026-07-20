import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Linking, Text } from 'react-native';
import { NativeLink } from '../NativeLink';
import type { NativeCapabilities } from '../../platform/capabilities';
import { defaultNativeCapabilities } from '../../platform/defaults';

describe('NativeLink', () => {
  afterEach(() => jest.restoreAllMocks());
  // parity:839467b2e467d7311febe88560595f2a2fe8f44582d0e3237ba831b85f87ac9b
  // parity:66746be75f362ef5109f549947b752189916d701e82c2cbbf0441ab327cbf22d
  // parity:288ee932750c67fe1dcc49127fbe62836d51e9c645353984d2933cdf473c852f
  // parity:5909f6e02f1256031e94fde95019c5af13edcc69ced8edc5c1d48721f72d70eb
  // parity:e657147a3fb108bddc2891fe3b716c09c1aafc86a199cd5e6f5f37ac57a533e7
  // parity:beeb7bbfbec9eba65bd3e5d4f4a46da18006e917dedfa2504d7a5bfaa5c07684
  it('approves a safe URL before opening it', async () => {
    const calls: string[] = [];
    const approve = jest.fn(async () => { calls.push('approve'); return { status: 'success' as const }; });
    const capabilities: NativeCapabilities = {
      links: {
        approve,
        open: async () => { calls.push('open'); return { status: 'success' }; },
      },
    };
    const screen = render(
      <NativeLink url="https://example.com" capabilities={capabilities}>
        <Text>Example</Text>
      </NativeLink>
    );

    fireEvent.press(screen.getByRole('link', { name: 'Example' }));
    await waitFor(() => expect(calls).toEqual(['approve', 'open']));
    expect(approve).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      title: 'Open external link?', open: 'Open link',
    }));
  });

  it.each(['denied', 'cancelled'] as const)('keeps a %s link inert and reports the state', async (status) => {
    const open = jest.fn();
    const onResult = jest.fn();
    const screen = render(
      <NativeLink
        url="https://example.com"
        capabilities={{ links: { approve: async () => ({ status }), open } }}
        onResult={onResult}
      >
        <Text>Example</Text>
      </NativeLink>
    );

    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status })));
    expect(open).not.toHaveBeenCalled();
  });

  it('does not approve or open an unsafe URL', () => {
    const approve = jest.fn();
    const open = jest.fn();
    const screen = render(
      <NativeLink url="javascript:alert(1)" capabilities={{ links: { approve, open } }}>
        <Text>Unsafe</Text>
      </NativeLink>
    );

    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.press(screen.getByText('Unsafe'));
    expect(approve).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('allows hosts to disable the default native link capability', async () => {
    const onResult = jest.fn();
    const screen = render(
      <NativeLink url="https://example.com" capabilities={{ links: false }} onResult={onResult}>
        <Text>Disabled</Text>
      </NativeLink>
    );
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'unavailable' })));
  });

  it('surfaces opening failures in an accessible status', async () => {
    const screen = render(
      <NativeLink
        url="https://example.com"
        capabilities={{
          links: {
            approve: async () => ({ status: 'success' }),
            open: async () => ({ status: 'failed', error: new Error('cannot open') }),
          },
        }}
      >
        <Text>Example</Text>
      </NativeLink>
    );
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('cannot open'));
  });

  it('does not call native Linking until the default approval action confirms', async () => {
    let buttons: Array<{ onPress?: () => void }> = [];
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, actions) => { buttons = actions ?? []; });
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const screen = render(<NativeLink url="https://example.com" capabilities={defaultNativeCapabilities}><Text>Example</Text></NativeLink>);
    fireEvent.press(screen.getByRole('link'));
    expect(openURL).not.toHaveBeenCalled();
    buttons[1].onPress?.();
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://example.com'));
  });

  it('passes translated approval labels to the native adapter', async () => {
    const approve = jest.fn().mockResolvedValue({ status: 'cancelled' });
    const screen = render(
      <NativeLink
        url="https://example.com"
        capabilities={{ links: { approve, open: jest.fn() } }}
        translations={{
          close: 'Schließen', copied: 'Kopiert', copyCode: 'Code kopieren', copyLink: 'Link kopieren',
          copyTable: 'Tabelle kopieren', copyTableAsCsv: 'CSV kopieren', copyTableAsMarkdown: 'Markdown kopieren',
          copyTableAsTsv: 'TSV kopieren', downloadFile: 'Datei speichern', downloadDiagram: 'Diagramm speichern',
          downloadDiagramAsMmd: 'MMD speichern', downloadDiagramAsPng: 'PNG speichern', downloadDiagramAsSvg: 'SVG speichern',
          downloadImage: 'Bild speichern', downloadTable: 'Tabelle speichern', downloadTableAsCsv: 'CSV speichern',
          downloadTableAsMarkdown: 'Markdown speichern', exitFullscreen: 'Vollbild schließen',
          externalLinkWarning: 'Externe Website.', imageNotAvailable: 'Bild nicht verfügbar', mermaidFormatMmd: 'MMD',
          mermaidFormatPng: 'PNG', mermaidFormatSvg: 'SVG', openExternalLink: 'Externen Link öffnen?', openLink: 'Link öffnen',
          retryImage: 'Erneut versuchen', streamingResponse: 'Antwort wird erstellt', tableFormatCsv: 'CSV',
          tableFormatMarkdown: 'Markdown', tableFormatTsv: 'TSV', tableFullscreen: 'Tabelle im Vollbild',
          unavailable: 'Nicht verfügbar', viewFullscreen: 'Vollbild',
        }}
      ><Text>Example</Text></NativeLink>
    );
    fireEvent.press(screen.getByRole('link'));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      title: 'Externen Link öffnen?', cancel: 'Schließen', open: 'Link öffnen',
    })));
  });
});
