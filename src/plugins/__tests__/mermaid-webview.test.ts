import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { createOfflineWebViewAdapter } from '../mermaid/webview';
import { createMermaidPlugin } from '../mermaid';
import { Streamdown } from '../../StreamdownRN';
import fs from 'node:fs';
import path from 'node:path';

describe('offline WebView adapter contract', () => {
  it('uses offline assets, a strict bridge request, and sanitizes the response', async () => {
    const officialSvg = fs.readFileSync(path.join(process.cwd(), 'src/plugins/__tests__/fixtures/official-mermaid.svg'), 'utf8');
    const transport = { render: jest.fn(async (request) => {
      expect(officialSvg).toContain('marker-end:url(#arrow)'); // normal Mermaid DOM stays inside the locked surface
      return JSON.stringify({ id: request.id, type: 'rendered', surfaceId: request.id });
    }), release: jest.fn(), dispose: jest.fn() };
    const adapter = createOfflineWebViewAdapter({ assets: { mermaidJs: '/* bundled mermaid with harmless https: docs text */' }, transport, assetDigest: 'sha256-pinned', renderSurface: (surface) => `visual:${surface}` });
    await expect(createMermaidPlugin({ fullFidelityAdapter: adapter.mermaid }).render('gantt\ntitle Offline')).resolves.toMatchObject({ kind: 'native', content: 'visual:streamdown-rn-1' });
    expect(transport.render).toHaveBeenCalledWith(expect.objectContaining({ kind: 'mermaid', navigation: 'disabled', links: 'disabled', contentSecurityPolicy: expect.stringContaining("default-src 'none'"), assetDigest: 'sha256-pinned' }), expect.anything(), expect.objectContaining({ mermaidJs: expect.any(String) }));
    adapter.dispose();
    expect(transport.dispose).toHaveBeenCalled();
  });

  it('rejects remote assets, malformed bridge messages, timeouts, and late work after teardown', async () => {
    const transport = { render: jest.fn(async () => '{"type":"rendered","surfaceId":"surface"}'), release: jest.fn(), dispose: jest.fn() };
    expect(() => createOfflineWebViewAdapter({ assets: { mermaidJs: 'fetch("https://cdn.example/x")' }, transport, renderSurface: (surface) => surface })).toThrow(/offline/i);
    const adapter = createOfflineWebViewAdapter({ assets: { mermaidJs: 'bundled' }, transport, timeoutMs: 10, renderSurface: (surface) => surface });
    await expect(adapter.mermaid.render({ source: 'graph TD\nA-->B', family: 'flowchart', config: {} })).rejects.toThrow(/bridge/i);
    adapter.dispose();
    await expect(adapter.mathController.render({ source: 'x', display: false, errorColor: '#000' })).rejects.toThrow(/disposed/i);
  });

  it('rejects promptly when transport ignores abort and ignores late resolution after teardown', async () => {
    let resolve!: (value: string) => void;
    const transport = { render: jest.fn(() => new Promise<string>((next) => { resolve = next; })), release: jest.fn(), dispose: jest.fn() };
    const adapter = createOfflineWebViewAdapter({ assets: { mermaidJs: 'bundled' }, transport, timeoutMs: 10, maxRetries: 0, renderSurface: (surface) => surface });
    await expect(adapter.mermaid.render({ source: 'graph TD\nA-->B', family: 'flowchart', config: {} })).rejects.toThrow(/timed out/i);
    adapter.dispose();
    resolve(JSON.stringify({ id: 'late', type: 'rendered', surfaceId: 'late' }));
    expect(transport.dispose).toHaveBeenCalledTimes(1);
  });

  it('counts UTF-8 bytes and bounds assets, source, and config at the direct controller boundary', async () => {
    const raw = JSON.stringify({ id: 'streamdown-rn-1', type: 'rendered', surfaceId: 'é' });
    const transport = { render: jest.fn(async () => raw), release: jest.fn(), dispose: jest.fn() };
    const bytes = Buffer.byteLength(raw, 'utf8');
    const adapter = createOfflineWebViewAdapter({ assets: { mermaidJs: 'bundled' }, transport, maxMessageBytes: bytes - 1, maxRetries: 0, maxSourceBytes: 4, renderSurface: (surface) => surface });
    await expect(adapter.mermaid.render({ source: 'x', family: 'invalid', config: {} })).rejects.toThrow(/message is too large/i);
    await expect(adapter.mathController.render({ source: 'ééé', display: false })).rejects.toThrow(/source exceeds/i);
    await expect(adapter.mermaid.render({ source: 'x', family: 'invalid', config: { nested: 'x'.repeat(21_000) } })).rejects.toThrow(/config is too large/i);
    expect(() => createOfflineWebViewAdapter({ assets: { mermaidJs: 'é'.repeat(10) }, transport, maxAssetBytes: 10, renderSurface: (surface) => surface })).toThrow(/assets exceed/i);
  });

  it('releases replaced and unmounted host surfaces exactly once', async () => {
    let surface = 0;
    const transport = {
      render: jest.fn(async ({ id }: { id: string }) => { surface++; return JSON.stringify({ id, type: 'rendered', surfaceId: id }); }),
      release: jest.fn(), dispose: jest.fn(),
    };
    const controller = createOfflineWebViewAdapter({ assets: { mermaidJs: 'bundled' }, transport, renderSurface: (id) => React.createElement(Text, { testID: id }, id) });
    const plugin = createMermaidPlugin({ fullFidelityAdapter: controller.mermaid });
    const view = render(React.createElement(Streamdown, { mode: 'static', plugins: { mermaid: plugin } }, '```mermaid\ngantt\ntitle One\n```'));
    await waitFor(() => expect(screen.getByTestId('streamdown-rn-1')).toBeTruthy());
    view.rerender(React.createElement(Streamdown, { mode: 'static', plugins: { mermaid: plugin } }, '```mermaid\ngantt\ntitle Two\n```'));
    await waitFor(() => expect(screen.getByTestId('streamdown-rn-2')).toBeTruthy());
    expect(transport.release).toHaveBeenCalledTimes(1);
    expect(transport.release).toHaveBeenCalledWith('streamdown-rn-1');
    view.unmount();
    expect(transport.release).toHaveBeenCalledTimes(2);
    expect(transport.release).toHaveBeenLastCalledWith('streamdown-rn-2');
    controller.dispose();
    expect(transport.release).toHaveBeenCalledTimes(2);
  });
});
