import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Streamdown } from '../../StreamdownRN';
import { defaultTranslations } from '../../controls/translations';
import { lightTheme } from '../../themes';
import { createRendererPlugin } from '../renderers';
import { MermaidBlock } from '../mermaid/MermaidBlock';
import {
  createMermaidPlugin,
  createBeautifulMermaidAdapter,
  BEAUTIFUL_MERMAID_FAMILIES,
  detectMermaidFamily,
  normalizeBeautifulMermaidSvg,
  normalizeBeautifulMermaidSource,
  sanitizeMermaidSvg,
  type MermaidFamily,
} from '../mermaid';

describe('mermaid plugin', () => {
  it('identifies every native family and routes unsupported syntax explicitly', () => {
    const cases: Array<[string, MermaidFamily]> = [
      ['flowchart LR\nA-->B', 'flowchart'], ['graph TD\nA-->B', 'flowchart'],
      ['sequenceDiagram\nA->>B: Hi', 'sequence'], ['classDiagram\nA <|-- B', 'class'],
      ['stateDiagram-v2\n[*] --> A', 'state'], ['erDiagram\nA ||--o{ B : has', 'er'],
      ['xychart-beta\nx-axis [a]\nbar [1]', 'xychart'],
    ];
    for (const [source, family] of cases) expect(detectMermaidFamily(source)).toBe(family);
    expect(detectMermaidFamily('gantt\ntitle Later')).toBe('unsupported');
    expect(detectMermaidFamily('pie\n"A": 1')).toBe('unsupported');
    expect(detectMermaidFamily('not mermaid')).toBe('invalid');
  });

  it('binds every beautiful-mermaid family to sanitized host SVG rendering', async () => {
    const provider = { render: jest.fn(async () => ({ svg: '<svg><text>safe</text></svg>' })), renderSvg: jest.fn((svg: string) => <Text>{svg}</Text>) };
    const adapter = createBeautifulMermaidAdapter(provider);
    expect(adapter.families).toEqual(BEAUTIFUL_MERMAID_FAMILIES);
    for (const source of ['flowchart LR\nA-->B', 'stateDiagram-v2\n[*]-->A', 'sequenceDiagram\nA->>B: hi', 'classDiagram\nA<|--B', 'erDiagram\nA||--o{B:has', 'xychart-beta\nx-axis [a]\nbar [1]']) {
      await expect(createMermaidPlugin({ adapter }).render(source)).resolves.toMatchObject({ kind: 'svg', content: expect.anything() });
    }
    expect(provider.render).toHaveBeenCalledTimes(6);
  });

  it('normalizes beautiful-mermaid browser CSS without weakening generic SVG security', async () => {
    const browserSvg = '<svg style="--bg:#fff"><style>@import url(https://evil); text { color: red }</style><defs><marker id="arrowhead"><path d="M0 0" /></marker></defs><path marker-end="url(#arrowhead)" stroke="var(--_line)" /></svg>';
    const normalized = normalizeBeautifulMermaidSvg(browserSvg);
    expect(normalized).not.toMatch(/<style|\sstyle=|@import|var\(/i);
    expect(normalized).toContain('stroke="#71717A"');
    expect(sanitizeMermaidSvg(normalized)).toContain('marker-end="url(#arrowhead)"');
    expect(() => sanitizeMermaidSvg('<svg><path marker-end="url(https://evil/x)" /></svg>')).toThrow(/unsafe/i);
    expect(() => sanitizeMermaidSvg('<svg><path marker-end="url(#x)" style="fill:red" /></svg>')).toThrow(/unsafe/i);
  });

  it('adapts compact flowchart arrows without changing labels', () => {
    expect(normalizeBeautifulMermaidSource('flowchart LR\nA-->B')).toBe('flowchart LR\nA --> B');
    expect(normalizeBeautifulMermaidSource('flowchart LR\nA["A-->B"]-->C')).toBe('flowchart LR\nA["A-->B"] --> C');
  });

  it('sanitizes bounded SVG and rejects active content, links, and oversized output', () => {
    expect(sanitizeMermaidSvg('<svg width="10" height="10"><text>A</text></svg>', 1_000)).toContain('<text>A</text>');
    expect(() => sanitizeMermaidSvg('<svg><script>alert(1)</script></svg>', 1_000)).toThrow(/unsafe/i);
    expect(() => sanitizeMermaidSvg('<svg><a href="https://example.com">x</a></svg>', 1_000)).toThrow(/unsafe/i);
    expect(() => sanitizeMermaidSvg(`<svg>${'x'.repeat(100)}</svg>`, 20)).toThrow(/large/i);
    expect(() => sanitizeMermaidSvg('<SvG><TeXt StYlE="fill:url(https://evil)">x</TeXt></sVg>')).toThrow(/unsafe/i);
    expect(() => sanitizeMermaidSvg('<svg><text>&#x3c;script&#x3e;</text></svg>')).toThrow(/entity/i);
    expect(() => sanitizeMermaidSvg('<svg><animate attributeName="x" /></svg>')).toThrow(/unsafe/i);
    expect(() => sanitizeMermaidSvg('<svg><path d="M0 0 L1 1" filter="url(#x)" /></svg>')).toThrow(/unsafe/i);
    expect(() => sanitizeMermaidSvg(`<svg><path d="${'M0 0'.repeat(30_000)}" /></svg>`, 500_000)).toThrow(/path/i);
    expect(() => sanitizeMermaidSvg('<svg><path d="M10000001 0" /></svg>')).toThrow(/numeric/i);
  });

  it('accepts an explicit zero-retry policy and does not mutate frozen adapter results', async () => {
    const frozen = Object.freeze({ kind: 'svg' as const, svg: '<svg><text>safe</text></svg>' });
    const adapter = { families: ['flowchart'] as const, render: jest.fn(async () => frozen) };
    const plugin = createMermaidPlugin({ adapter, maxRetries: 0 });
    await expect(plugin.render('flowchart LR\nA-->B')).resolves.toEqual(frozen);
    expect(adapter.render).toHaveBeenCalledTimes(1);
  });

  it('releases each failed adapter result before retrying', async () => {
    const releases = [jest.fn(), jest.fn()];
    let attempt = 0;
    const adapter = { families: ['flowchart'] as const, render: jest.fn(async () => ({ kind: 'svg' as const, svg: '<svg><script>x</script></svg>', release: releases[attempt++] })) };
    await expect(createMermaidPlugin({ adapter, maxRetries: 1 }).render('flowchart LR\nA-->B')).rejects.toThrow(/unsafe/i);
    expect(releases[0]).toHaveBeenCalledTimes(1);
    expect(releases[1]).toHaveBeenCalledTimes(1);
  });

  it('pins strict security config and rejects non-JSON or oversized config', async () => {
    const renderDiagram = jest.fn(async () => ({ kind: 'native' as const, content: null }));
    const plugin = createMermaidPlugin({ config: { securityLevel: 'loose', startOnLoad: true }, adapter: { families: ['flowchart'], render: renderDiagram } });
    await plugin.render('flowchart LR\nA-->B');
    expect(renderDiagram).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ securityLevel: 'strict', startOnLoad: false, suppressErrorRendering: true }) }));
    expect(() => createMermaidPlugin({ config: JSON.parse('{"__proto__":{"polluted":true}}') })).toThrow(/unsafe|plain/i);
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    expect(() => createMermaidPlugin({ config: cyclic })).toThrow(/cycles/i);
    expect(() => createMermaidPlugin({ config: { bad: undefined } })).toThrow(/JSON/i);
    expect(() => createMermaidPlugin({ config: { nested: 'x'.repeat(21_000) } })).toThrow(/large/i);
  });

  it('renders a supported family through the injected native adapter with accessible source semantics', async () => {
    const renderDiagram = jest.fn(async () => ({ kind: 'native' as const, content: <Text testID="native-diagram">visual</Text> }));
    const plugin = createMermaidPlugin({ adapter: { families: ['flowchart'], render: renderDiagram } });
    render(<Streamdown mode="static" plugins={{ mermaid: plugin }}>{'```mermaid\nflowchart LR\nA-->B\n```'}</Streamdown>);
    await waitFor(() => expect(screen.getByTestId('native-diagram')).toBeTruthy());
    expect(screen.getByLabelText(/Mermaid diagram: flowchart LR/)).toBeTruthy();
    expect(screen.queryByText(/flowchart LR/)).toBeNull();
    expect(renderDiagram).toHaveBeenCalledWith(expect.objectContaining({ family: 'flowchart' }));
  });

  it('routes unsupported families to full fidelity and falls back after errors', async () => {
    const full = { families: ['*'] as const, render: jest.fn(async () => { throw new Error('render failed'); }) };
    const onError = jest.fn();
    const plugin = createMermaidPlugin({ fullFidelityAdapter: full, onError, maxRetries: 1 });
    render(<Streamdown mode="static" plugins={{ mermaid: plugin }}>{'```mermaid\ngantt\ntitle Plan\n```'}</Streamdown>);
    await waitFor(() => expect(full.render).toHaveBeenCalledTimes(2));
    expect(onError).toHaveBeenCalled();
    expect(screen.getByText(/gantt/)).toBeTruthy();
  });

  it('gives a custom language renderer precedence over Mermaid', () => {
    const adapter = { families: ['flowchart'] as const, render: jest.fn() };
    const plugin = createMermaidPlugin({ adapter });
    const Custom = ({ code }: { code: string }) => <Text testID="custom-mermaid">{code}</Text>;
    render(<Streamdown mode="static" plugins={{ mermaid: plugin, renderers: createRendererPlugin([{ language: 'mermaid', component: Custom }]) }}>{'```mermaid\nflowchart LR\nA-->B\n```'}</Streamdown>);
    expect(screen.getByTestId('custom-mermaid')).toBeTruthy();
    expect(adapter.render).not.toHaveBeenCalled();
  });

  it('does not start expensive diagram work for an incomplete streamed fence', () => {
    const adapter = { families: ['flowchart'] as const, render: jest.fn() };
    const plugin = createMermaidPlugin({ adapter });
    render(<Streamdown mode="streaming" isAnimating plugins={{ mermaid: plugin }}>{'```mermaid\nflowchart LR\nA-->B'}</Streamdown>);
    expect(adapter.render).not.toHaveBeenCalled();
    expect(screen.getByText(/flowchart LR/)).toBeTruthy();
  });

  it('does not expose stale rendered downloads while a new source is rendering', async () => {
    const sourceA = 'flowchart LR\nA-->B';
    const sourceB = 'flowchart LR\nB-->C';
    const pending = new Promise<never>(() => undefined);
    const adapter = {
      families: ['flowchart'] as const,
      render: jest.fn(({ source }: { source: string }) => source === sourceA
        ? { kind: 'native' as const, content: <Text>result A</Text>, svg: '<svg><text>A</text></svg>', png: new Uint8Array([1]) }
        : pending),
    };
    const plugin = createMermaidPlugin({ adapter });
    const capabilities = { files: { save: jest.fn(() => ({ status: 'success' as const })) } };
    const view = render(<MermaidBlock source={sourceA} plugin={plugin} theme={lightTheme} capabilities={capabilities} translations={defaultTranslations} />);
    await waitFor(() => expect(screen.getByText('result A')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Download diagram'));
    expect(screen.getByRole('menuitem', { name: 'Download diagram as SVG' })).toBeTruthy();

    view.rerender(<MermaidBlock source={sourceB} plugin={plugin} theme={lightTheme} capabilities={capabilities} translations={defaultTranslations} />);

    expect(screen.getByText('result A')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Download diagram as SVG' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Download diagram as PNG' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Download diagram as MMD' })).toBeTruthy();
  });

  it('hides copy and download without providers while keeping unrelated Mermaid controls', async () => {
    const adapter = { families: ['flowchart'] as const, render: jest.fn(async () => ({ kind: 'native' as const, content: <Text>visual</Text> })) };
    const plugin = createMermaidPlugin({ adapter });
    render(<Streamdown mode="static" plugins={{ mermaid: plugin }}>{'```mermaid\nflowchart LR\nA-->B\n```'}</Streamdown>);
    await waitFor(() => expect(screen.getByText('visual')).toBeTruthy());
    expect(screen.queryByLabelText('Copy diagram')).toBeNull();
    expect(screen.queryByLabelText('Download diagram')).toBeNull();
    expect(screen.getByLabelText('View fullscreen')).toBeTruthy();
    expect(screen.getByLabelText('Zoom')).toBeTruthy();
  });

  it('rejects oversized diagrams before adapters and exposes copy/share/fullscreen/panzoom seams', async () => {
    const adapter = { families: ['flowchart'] as const, render: jest.fn(async () => ({ kind: 'native' as const, content: <Text>visual</Text> })) };
    const clipboard = jest.fn(() => ({ status: 'success' as const }));
    const share = jest.fn(() => ({ status: 'success' as const }));
    const plugin = createMermaidPlugin({ adapter, maxSourceLength: 8 });
    const first = render(<Streamdown mode="static" plugins={{ mermaid: plugin }} capabilities={{ clipboard: { writeText: clipboard }, share: { shareText: share } }}>{'```mermaid\nflowchart LR\nA-->B\n```'}</Streamdown>);
    expect(adapter.render).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/exceeds/));
    first.unmount();
    const working = createMermaidPlugin({ adapter });
    render(<Streamdown mode="static" plugins={{ mermaid: working }} controls={{ mermaid: { share: true } }} capabilities={{ clipboard: { writeText: clipboard }, share: { shareText: share } }}>{'```mermaid\nflowchart LR\nA-->B\n```'}</Streamdown>);
    await waitFor(() => expect(screen.getByLabelText('Zoom')).toBeTruthy());
    expect(screen.getByTestId('mermaid-block')).toHaveStyle({ padding: 8, borderRadius: 12 });
    expect(screen.getByTestId('mermaid-surface')).toHaveStyle({ borderWidth: 1, borderRadius: 6 });
    fireEvent.press(screen.getByLabelText('Copy diagram'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Copied'));
    fireEvent.press(screen.getByLabelText('Share diagram'));
    fireEvent.press(screen.getByLabelText('View fullscreen'));
    expect(clipboard).toHaveBeenCalledWith('flowchart LR\nA-->B');
    expect(share).toHaveBeenCalledWith('flowchart LR\nA-->B', 'Mermaid diagram');
    expect(screen.getByLabelText('Diagram fullscreen')).toBeTruthy();
  });
});
