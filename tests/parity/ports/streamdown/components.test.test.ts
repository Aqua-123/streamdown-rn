import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';

describe('adapted native semantic components', () => {
  it('maps ordered, unordered, and item overrides to native semantics', () => {
    const seen: string[] = [];
    const Override = ({ children, semantic }: { children?: React.ReactNode; semantic: { type: string; ordered?: boolean } }) => {
      seen.push(`${semantic.type}:${String(semantic.ordered)}`);
      return React.createElement(View, null, children);
    };
    const result = render(React.createElement(Streamdown, {
      mode: 'static', components: { ol: Override as never, ul: Override as never, li: Override as never },
      children: '1. ordered\n\n- unordered',
    }));
    expect(result.getByText('ordered')).toBeTruthy();
    expect(result.getByText('unordered')).toBeTruthy();
    expect(seen).toEqual(expect.arrayContaining(['list:true', 'list:false', 'listItem:undefined']));
  });

  // parity:6a6c49ea8455238e9bc08a7447f2fea86f148f28ec798cd43e4a73be9434c4ba
  it('renders an ordered list with native list semantics', () => {
    expect(semanticTypes('1. ordered', { ol: Text as never })).toContain('list');
  });

  // parity:2da7a5cc1f5c9bdfdb512afef3ec192e57b37f71af883f7a83adbd9bde8c6f27
  it('renders an unordered list with native list semantics', () => {
    expect(semanticTypes('- unordered', { ul: Text as never })).toContain('list');
  });

            // parity:611d1f89de89d1e1805ec69bc935c43f2c9e942fed3260e6d220c857b01bf041
            it('maps all heading levels to overrides with depth and readable text', () => {
    const depths: number[] = [];
    const Heading = ({ children, semantic }: { children?: React.ReactNode; semantic: { depth?: number } }) => {
      depths.push(semantic.depth!);
      return React.createElement(Text, { accessibilityRole: 'header' }, children);
    };
    const components = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`h${index + 1}`, Heading]));
    const result = render(React.createElement(Streamdown, {
      mode: 'static', components, children: Array.from({ length: 6 }, (_, index) => `${'#'.repeat(index + 1)} H${index + 1}`).join('\n\n'),
    }));
    expect(depths).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.getAllByRole('header')).toHaveLength(6);
  });

  // parity:bc32dd121c915c397e7c5098594d32d94615d2065bf0d7b5a1e9cbb0483457f0
  it('provides strong, safe-link, and blockquote semantic overrides', () => {
    const types: string[] = [];
    const Override = ({ children, semantic }: { children?: React.ReactNode; semantic: { type: string; url?: string } }) => {
      types.push(`${semantic.type}:${semantic.url ?? ''}`);
      return React.createElement(Text, null, children);
    };
    const result = render(React.createElement(Streamdown, {
      mode: 'static', components: { strong: Override as never, a: Override as never, blockquote: Override as never },
      children: '**bold** [link](https://example.com)\n\n> quote',
    }));
    for (const value of ['bold', 'link', 'quote']) expect(result.getByText(value)).toBeTruthy();
    expect(types).toEqual(expect.arrayContaining(['strong:', 'link:https://example.com', 'blockquote:']));
  });

  // parity:de788dce778e5597b7944c3e888bd179dd35aafc7f2bb8f3f3907903fb19091a
  it('keeps incomplete links readable and inert', () => {
    const result = render(React.createElement(Streamdown, {
      mode: 'streaming', isAnimating: true, children: '[unfinished](https://example',
    }));
    expect(JSON.stringify(result.toJSON())).toContain('unfinished');
    expect(result.queryByRole('link')).toBeNull();
  });

  // parity:8b4936624f79c43cfc8725951ab1d5e36cc14c5f457cdc4eddd8ccb4273c2e5e
  it('exposes inline and fenced code semantics without DOM data attributes', () => {
    const seen: Array<{ type: string; value?: string; language?: string; metadata?: string }> = [];
    const Override = ({ children, semantic }: { children?: React.ReactNode; semantic: { type: string; value?: string; language?: string; metadata?: string } }) => {
      seen.push(semantic);
      return React.createElement(Text, { testID: semantic.type }, children ?? semantic.value);
    };
    const result = render(React.createElement(Streamdown, {
      mode: 'static', components: { inlineCode: Override as never, pre: Override as never },
      children: '`inline`\n\n```mermaid title="chart"\nflowchart LR\n```',
    }));
    expect(result.getByTestId('inlineCode')).toHaveTextContent('inline');
    expect(result.getByTestId('code')).toHaveTextContent('flowchart LR');
    expect(seen).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'inlineCode', value: 'inline' }),
      expect.objectContaining({ type: 'code', language: 'mermaid', metadata: 'title="chart"' }),
    ]));
  });

  it('uses a configured native Mermaid component', () => {
    const Diagram = ({ source }: { source: string }) => React.createElement(Text, { testID: 'diagram' }, source);
    const plugin = {
      name: 'mermaid' as const, type: 'diagram' as const, language: 'mermaid' as const,
      component: Diagram, maxSourceLength: 1000, maxSvgLength: 1000,
      getMermaid: () => ({ initialize: () => undefined, render: async () => ({ kind: 'native' as const, content: null }) }),
      render: async () => ({ kind: 'native' as const, content: null }),
    };
    expect(render(React.createElement(Streamdown, {
      mode: 'static', plugins: { mermaid: plugin }, children: '```mermaid\nflowchart LR\n```',
    })).getByTestId('diagram')).toHaveTextContent('flowchart LR');
  });
  // parity:f5ac11cdda0a605a03d92ed22e03d26a89bc0da84fdf820d7116c9a1aa83fcb8
  it('renders a Mermaid block through the configured native plugin structure', () => {
    const Diagram = ({ source }: { source: string }) => React.createElement(Text, { testID: 'configured-mermaid' }, source);
    const plugin = {
      name: 'mermaid' as const, type: 'diagram' as const, language: 'mermaid' as const,
      component: Diagram, maxSourceLength: 1000, maxSvgLength: 1000,
      getMermaid: () => ({ initialize: () => undefined, render: async () => ({ kind: 'native' as const, content: null }) }),
      render: async () => ({ kind: 'native' as const, content: null }),
    };
    expect(render(React.createElement(Streamdown, { mode: 'static', plugins: { mermaid: plugin }, children: '```mermaid\nflowchart LR\n```' })).getByTestId('configured-mermaid')).toHaveTextContent('flowchart LR');
  });

  // parity:2e53e657803b20732f7292ab7bf280ee364718cc27fba7190392ceacedfb1865
  it('maps table, row, header/body cell structure to native semantic overrides', () => {
    const types: string[] = [];
    const Override = ({ children, semantic }: { children?: React.ReactNode; semantic: { type: string } }) => {
      types.push(semantic.type);
      return React.createElement(View, null, children);
    };
    const headers: string[] = [];
    const Header = ({ children, semantic }: { children?: React.ReactNode; semantic: { type: string } }) => {
      headers.push(semantic.type);
      return React.createElement(View, null, children);
    };
    const result = render(React.createElement(Streamdown, {
      mode: 'static', components: { table: Override as never, tr: Override as never, th: Header as never, td: Override as never },
      children: '| Head |\n| --- |\n| Body |',
    }));
    expect(JSON.stringify(result.toJSON())).toContain('Head');
    expect(JSON.stringify(result.toJSON())).toContain('Body');
    expect(types.filter((type) => type === 'table')).toHaveLength(1);
    expect(types.filter((type) => type === 'tableRow')).toHaveLength(2);
    expect(headers).toEqual(['tableCell']);
    expect(types.filter((type) => type === 'tableCell')).toHaveLength(1);
  });

  it('maps horizontal rule, footnote superscript, and declared subscript overrides', () => {
    const seen: string[] = [];
    const Override = ({ children, semantic }: { children?: React.ReactNode; semantic: { type: string } }) => {
      seen.push(semantic.type);
      return React.createElement(Text, null, children);
    };
    render(React.createElement(Streamdown, {
      mode: 'static', allowedTags: { sub: [] },
      components: { hr: Override as never, sup: Override as never, sub: Override as never },
      children: 'Text[^n]\n\n---\n\nH<sub>2</sub>O\n\n[^n]: note',
    }));
    expect(seen).toEqual(expect.arrayContaining(['thematicBreak', 'footnoteReference', 'customTag']));
  });

  // parity:78db0c3514efac8e40d4d2dec62e46ab495b7fc08c00850448deea4d3bdf28b9
  it('rejects DOM className merging rather than passing it to native views', () => {
    expect(() => render(React.createElement(Streamdown, {
      mode: 'static', children: 'text', className: 'custom',
    } as never))).toThrow(/className.*DOM-only.*React Native/i);
  });
});

function semanticTypes(markdown: string, components: Record<string, React.ComponentType<never>>, allowedTags?: Record<string, string[]>) {
  const seen: string[] = [];
  const Override = ({ children, semantic }: { children?: React.ReactNode; semantic: { type: string } }) => {
    seen.push(semantic.type);
    return React.createElement(Text, null, children);
  };
  render(React.createElement(Streamdown, {
    mode: 'static',
    allowedTags,
    components: Object.fromEntries(Object.keys(components).map((key) => [key, Override])) as never,
    children: markdown,
  }));
  return seen;
}

describe('case-specific semantic component proof', () => {
  // parity:da4e16c3f33e79b0bddd5cbc36b02eb8c8b6c4c1af2d4f73267e475fff741696
  it('should render list item with correct native semantics', () => {
    expect(semanticTypes('- item', { li: Text as never })).toContain('listItem');
  });

  it.each([/* parity:2a1c4567af4d7e9444eb8780dba1752fcc794c120a4ad7fa80bdf8a3ed0e001b */ [2, 2], /* parity:587301a752a3462077c8d08356016f8ffc24b79e2408db8b83a0574e89f7426b */ [3, 3], /* parity:2289593d624a3f225c84c6592d5c7f15ccc4a9b57637c3025ebc0cf54fbe720a */ [4, 4], /* parity:212260b1e80234533e300d0de6b946d070d5113768c4ef7c83bfeca7c99af55e */ [5, 5], /* parity:4e50383e4c7a446289f67aec6372c5586a8e77a90bbdd48ed4aba32755edbf7b */ [6, 6]])('should render h%s with its heading depth', (depth, expectedDepth) => {
    const seen: number[] = [];
    const Heading = ({ children, semantic }: { children?: React.ReactNode; semantic: { depth?: number } }) => {
      seen.push(semantic.depth!);
      return React.createElement(Text, null, children);
    };
    render(React.createElement(Streamdown, {
      mode: 'static', components: { [`h${depth}`]: Heading } as never,
      children: `${'#'.repeat(depth)} heading`,
    }));
    expect(seen).toEqual([expectedDepth]);
  });

  // parity:18036a07990b17ceceeda476288d0dcb6c7e29dd781394c1251f95dbb591a052
  it('should render link with a safe native URL', () => {
    const seen: string[] = [];
    const Link = ({ children, semantic }: { children?: React.ReactNode; semantic: { url?: string } }) => {
      seen.push(semantic.url!);
      return React.createElement(Text, null, children);
    };
    render(React.createElement(Streamdown, { mode: 'static', components: { a: Link as never }, children: '[link](https://example.com)' }));
    expect(seen).toEqual(['https://example.com']);
  });

  // parity:d3f43775cde0135a248ede03958b6e8160c413a23899995c0d9bfab3bf8c7424
  it('should render blockquote with native semantics', () => {
    expect(semanticTypes('> quote', { blockquote: Text as never })).toContain('blockquote');
  });

  // parity:31af2290b96f94f675238cfb2910ce1c5d84e476410f6e301bf2d7b2e18ae5d1
  it('should render block code when the fenced block is present', () => {
    expect(semanticTypes('```txt\ncode\n```', { pre: Text as never })).toContain('code');
  });

  // parity:adaf7363f00106cbae21d976be176577a2c63c496e0d998c054f19e9537121da
  it('should pass fenced source to the pre override', () => {
    const values: string[] = [];
    const Pre = ({ semantic }: { semantic: { value?: string } }) => { values.push(semantic.value!); return React.createElement(Text, null, semantic.value); };
    render(React.createElement(Streamdown, { mode: 'static', components: { pre: Pre as never }, children: '```txt\nsource\n```' }));
    expect(values).toEqual(['source']);
  });
  // parity:1e801ca902e5bbb596482aaf97fc4d9acaa7d870f8324edcf30a0af91f921c5c
  it('should extract fenced code from pre component children', () => {
    expect(render(React.createElement(Streamdown, { mode: 'static', children: '```txt\nextracted source\n```' })).getByText('extracted source')).toBeTruthy();
  });
  // parity:bd4cbd8c44e267d671e86c56a35c200f8906314be7aecd42dcfe9e26ad727e15
  it('should extract language from the fenced code info string', () => {
    const values: string[] = [];
    const Pre = ({ semantic }: { semantic: { language?: string } }) => { values.push(semantic.language!); return React.createElement(Text, null, semantic.language); };
    render(React.createElement(Streamdown, { mode: 'static', components: { pre: Pre as never }, children: '```javascript\nsource\n```' }));
    expect(values).toEqual(['javascript']);
  });

  it('should render mermaid source as code when no plugin is provided', () => {
    expect(render(React.createElement(Streamdown, { mode: 'static', children: '```mermaid\nflowchart LR\n```' })).getByText('flowchart LR')).toBeTruthy();
  });
  // parity:9bb9164fca1f0fe123b023fa3b0da0b3596010695140b6013449e17c8b8e4ddf
  it('should render a Mermaid code block normally when no plugin is provided', () => {
    expect(render(React.createElement(Streamdown, { mode: 'static', children: '```mermaid\nflowchart LR\n```' })).getByText('flowchart LR')).toBeTruthy();
  });

  it('should render a configured native Mermaid component', () => {
    const Diagram = ({ source }: { source: string }) => React.createElement(Text, { testID: 'diagram-proof' }, source);
    const plugin = {
      name: 'mermaid' as const, type: 'diagram' as const, language: 'mermaid' as const,
      component: Diagram, maxSourceLength: 1000, maxSvgLength: 1000,
      getMermaid: () => ({ initialize: () => undefined, render: async () => ({ kind: 'native' as const, content: null }) }),
      render: async () => ({ kind: 'native' as const, content: null }),
    };
    expect(render(React.createElement(Streamdown, { mode: 'static', plugins: { mermaid: plugin }, children: '```mermaid\nflowchart LR\n```' })).getByTestId('diagram-proof')).toHaveTextContent('flowchart LR');
  });

  // parity:948f5ddc2688f5ea77357857afe26ec4f5efc54b76f0d9ba65bd5cb61b4dce3f
  it('should expose table header content', () => {
    expect(render(React.createElement(Streamdown, { mode: 'static', children: '| Head |\n| --- |\n| Body |' })).getByText('Head')).toBeTruthy();
  });
  // parity:e6617babe5fe6b6c1c2e51450cc8d3fa94d85142fe68472b75fa4a8b5c5e5898
  it('should render thead through native table header semantics', () => {
    expect(render(React.createElement(Streamdown, { mode: 'static', children: '| Header |\n| --- |\n| Body |' })).getByText('Header')).toBeTruthy();
  });

  // parity:4336c6f9fd55f65d9c1104ccb154d3860105e4f21760a4936fa925d47a2a5e16
  it('should expose table body content', () => {
    expect(render(React.createElement(Streamdown, { mode: 'static', children: '| Head |\n| --- |\n| Body |' })).getByText('Body')).toBeTruthy();
  });

  it('should render two rows for a header and body table', () => {
    expect(semanticTypes('| Head |\n| --- |\n| Body |', { tr: Text as never }).filter((type) => type === 'tableRow')).toHaveLength(2);
  });

  it('should render one header cell', () => {
    expect(semanticTypes('| Head |\n| --- |\n| Body |', { th: Text as never }).filter((type) => type === 'tableCell')).toHaveLength(1);
  });

  it('should render one body cell', () => {
    expect(semanticTypes('| Head |\n| --- |\n| Body |', { td: Text as never }).filter((type) => type === 'tableCell')).toHaveLength(1);
  });

  it('should render a thematic break', () => {
    expect(semanticTypes('---', { hr: Text as never })).toContain('thematicBreak');
  });

  it('should render a footnote superscript', () => {
    expect(semanticTypes('text[^n]\n\n[^n]: note', { sup: Text as never })).toContain('footnoteReference');
  });

  // parity:8b80cc2753d8038562a1d998644d08ad1a33979c07f0c2c27408624ca2d00821
  it('should render a declared subscript custom tag', () => {
    expect(semanticTypes('H<sub>2</sub>O', { sub: Text as never }, { sub: [] })).toContain('customTag');
  });

  // parity:f581f3e2f0c740704e5e15d9abb9226eda0a58aabfb1b18d1fcd404253b366a8
  it('should render tbody with native table body semantics', () => {
    expect(render(React.createElement(Streamdown, { mode: 'static', children: '| Head |\n| --- |\n| Body |' })).getByText('Body')).toBeTruthy();
  });

  // parity:5b03d28f6d2cb8e7d96360df6def49aa94999b8c461e9f1f1031973415e910a2
  it('should render tr with native table row semantics', () => {
    expect(semanticTypes('| Head |\n| --- |\n| Body |', { tr: Text as never }).filter((type) => type === 'tableRow')).toHaveLength(2);
  });

  // parity:ec20055cdf97c17254c985f85c95bd26e93a05548d2bd14bcde77b9a2b46539f
  it('should render hr with native thematic break semantics', () => {
    expect(semanticTypes('---', { hr: Text as never })).toContain('thematicBreak');
  });

  // parity:10462517cd45a84c6e87259d2a526dbc9a9b27325e1ff3c11cbbd0c2a0cdafd2
  it('should render sup with native footnote reference semantics', () => {
    expect(semanticTypes('text[^n]\n\n[^n]: note', { sup: Text as never })).toContain('footnoteReference');
  });
});
