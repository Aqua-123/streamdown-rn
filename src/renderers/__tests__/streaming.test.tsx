import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { render, within } from '@testing-library/react-native';
import { Streamdown } from '../../StreamdownRN';
import { createStreamingInstrumentation } from '../../core/streaming';

const MIXED = '# Title\n\nFirst [link](https://example.com).\n\n> quote\n\n- [x] one\n- two\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst n = 1;\n```\n\nRTL שלום.\n\nFootnote[^n]\n\n[^n]: Note';

const DOCUMENT_SEMANTICS = [
  ['loose list', '- first paragraph\n\n  second paragraph', {}],
  ['reference link and image', '[link][target] ![image][target]\n\n[target]: https://example.com/image.png', {}],
  ['footnote', 'Text[^note].\n\n[^note]: Footnote body.', {}],
  ['custom tag', '<box>first\n\nsecond</box>', { allowedTags: { box: [] } }],
] as const;

function chunks(source: string, sizes: number[]): string[] {
  const values: string[] = [];
  let cursor = 0;
  for (const size of sizes) {
    cursor = Math.min(source.length, cursor + size);
    values.push(source.slice(0, cursor));
  }
  if (values.at(-1) !== source) values.push(source);
  return values;
}

function visibleText(json: unknown): string {
  if (typeof json === 'string') return json;
  if (!json || typeof json !== 'object') return '';
  return ((json as { children?: unknown[] }).children ?? []).map(visibleText).join('');
}

function semanticSignature(json: unknown): unknown[] {
  if (!json || typeof json !== 'object') return [];
  const node = json as { type?: string; props?: Record<string, unknown>; children?: unknown[] };
  const current = node.type === 'Text' || node.type === 'Image'
    ? [{
        type: node.type,
        role: node.props?.accessibilityRole,
        state: node.props?.accessibilityState,
        label: node.props?.accessibilityLabel,
        text: visibleText(node),
      }]
    : [];
  return [...current, ...(node.children ?? []).flatMap(semanticSignature)];
}

describe('streaming lifecycle', () => {
  it('suppresses only empty defined footnotes in active streaming roots', () => {
    const empty = 'Empty[^empty], full[^full], unresolved[^missing].\n\n[^empty]:\n[^full]: Body';
    const screen = render(<Streamdown mode="streaming">{empty}</Streamdown>);
    expect(visibleText(screen.toJSON())).not.toContain('[empty]');
    expect(visibleText(screen.toJSON())).toContain('[full]');
    expect(visibleText(screen.toJSON())).toContain('[^missing]');

    const arrived = empty.replace('[^empty]:', '[^empty]: Arrived');
    screen.rerender(<Streamdown mode="streaming">{arrived}</Streamdown>);
    expect(visibleText(screen.toJSON())).toContain('[empty]');
    expect(visibleText(screen.toJSON())).toContain('Arrived');

    screen.rerender(<Streamdown mode="static">{'Empty[^empty].\n\n[^empty]:'}</Streamdown>);
    expect(visibleText(screen.toJSON())).toContain('[empty]');
  });

  it.each(DOCUMENT_SEMANTICS)('preserves %s semantics for incremental and whole delivery', (_name, source, extraProps) => {
    const expected = render(<Streamdown mode="static" {...extraProps}>{source}</Streamdown>);
    for (const sizes of [
      Array(source.length).fill(1),
      [4, 6, 3, 8],
      source.split('\n').map((line) => line.length + 1),
      [source.length],
    ]) {
      const streamed = render(<Streamdown {...extraProps}>{''}</Streamdown>);
      for (const value of chunks(source, sizes)) streamed.rerender(<Streamdown {...extraProps}>{value}</Streamdown>);
      expect(visibleText(streamed.toJSON())).toBe(visibleText(expected.toJSON()));
      expect(semanticSignature(streamed.toJSON())).toEqual(semanticSignature(expected.toJSON()));
    }
  });

  it.each([
    ['character', Array(MIXED.length).fill(1)],
    ['token', [4, 6, 3, 12, 9, 7, 15]],
    ['line', MIXED.split('\n').map((line) => line.length + 1)],
    ['random', [1, 8, 2, 17, 3, 11, 5, 19]],
    ['whole', [MIXED.length]],
  ])('is render-invariant for %s chunks', (_name, sizes) => {
    const staticTree = render(<Streamdown mode="static">{MIXED}</Streamdown>);
    const streamed = render(<Streamdown>{''}</Streamdown>);
    for (const value of chunks(MIXED, sizes)) {
      streamed.rerender(<Streamdown>{value}</Streamdown>);
    }
    streamed.rerender(<Streamdown isComplete>{MIXED}</Streamdown>);
    expect(visibleText(streamed.toJSON())).toBe(visibleText(staticTree.toJSON()));
    expect(semanticSignature(streamed.toJSON())).toEqual(semanticSignature(staticTree.toJSON()));
  });

  it('parses each new stable block once and skips later active appends', () => {
    const metrics = createStreamingInstrumentation();
    const screen = render(<Streamdown instrumentation={metrics}>{'# Stable\n\nactive'}</Streamdown>);
    const before = metrics.snapshot();
    expect(before.stableParses).toBe(1);
    screen.rerender(<Streamdown instrumentation={metrics}>{'# Stable\n\nactive grows'}</Streamdown>);
    const after = metrics.snapshot();
    expect(after.stableParses).toBe(before.stableParses);
    expect(after.stableRenders).toBe(before.stableRenders);
    expect(after.appendedCharacters - before.appendedCharacters).toBe(6);
    screen.rerender(<Streamdown instrumentation={metrics}>{'# Stable\n\nactive grows\n\nnext'}</Streamdown>);
    expect(metrics.snapshot().stableParses).toBe(after.stableParses + 1);
  });

  it('rerenders stable output for behavior changes without reparsing its Root', () => {
    const metrics = createStreamingInstrumentation();
    const allow = (url: string) => url;
    const screen = render(<Streamdown instrumentation={metrics} urlTransform={allow}>{'[link](https://example.com)\n\nactive'}</Streamdown>);
    expect(screen.getByRole('link')).toBeTruthy();
    const before = metrics.snapshot();
    screen.rerender(<Streamdown instrumentation={metrics} urlTransform={() => null}>{'[link](https://example.com)\n\nactive'}</Streamdown>);
    const after = metrics.snapshot();
    expect(screen.queryByRole('link')).toBeNull();
    expect(after.stableRenders).toBe(before.stableRenders + 1);
    expect(after.stableParses).toBe(before.stableParses);
    expect(after.cacheHits).toBe(before.cacheHits + 1);
  });

  it('reparses stable roots only when parser inputs change', () => {
    const metrics = createStreamingInstrumentation();
    const screen = render(<Streamdown instrumentation={metrics}>{'# Stable\n\nactive'}</Streamdown>);
    expect(metrics.snapshot().stableParses).toBe(1);
    screen.rerender(<Streamdown instrumentation={metrics} remarkPlugins={[]}>{'# Stable\n\nactive'}</Streamdown>);
    expect(metrics.snapshot().stableParses).toBe(2);
  });

  it('caches the completed document Root until parser inputs change', () => {
    const metrics = createStreamingInstrumentation();
    const screen = render(<Streamdown instrumentation={metrics} isComplete theme="dark">complete</Streamdown>);
    expect(metrics.snapshot().documentParses).toBe(1);
    screen.rerender(<Streamdown instrumentation={metrics} isComplete theme="light">complete</Streamdown>);
    expect(metrics.snapshot().documentParses).toBe(1);
    screen.rerender(<Streamdown instrumentation={metrics} isComplete theme="light" remarkPlugins={[]}>complete</Streamdown>);
    expect(metrics.snapshot().documentParses).toBe(2);
  });

  it.each(['short', 'same-prefix replacement', 'unrelated'])('fully resets %s content', (kind) => {
    const metrics = createStreamingInstrumentation();
    const initial = kind === 'same-prefix replacement'
      ? 'prefix\n\noriginal content'
      : `# Stable\n\n${kind === 'short' ? 'longer original content' : 'prefix original content'}`;
    const replacement = kind === 'short' ? 'short' : kind === 'same-prefix replacement' ? 'prefix\n\nchanged content' : 'unrelated';
    const screen = render(<Streamdown instrumentation={metrics} animated caret="block" isAnimating>{initial}</Streamdown>);
    expect(metrics.snapshot().cacheEntries).toBeGreaterThan(0);
    screen.rerender(<Streamdown instrumentation={metrics} animated caret="block" isAnimating>{replacement}</Streamdown>);
    expect(metrics.snapshot()).toMatchObject({
      resets: 1,
      session: 1,
      cacheEntries: kind === 'same-prefix replacement' ? 1 : 0,
    });
    expect(screen.getByText(kind === 'same-prefix replacement' ? 'changed content' : replacement)).toBeTruthy();
  });

  it('clears cached roots and remounts registry components on reset', () => {
    const metrics = createStreamingInstrumentation();
    let mounts = 0;
    let unmounts = 0;
    const Probe = () => {
      useEffect(() => { mounts++; return () => { unmounts++; }; }, []);
      return <Text>probe</Text>;
    };
    const registry = {
      get: (name: string) => name === 'Probe' ? { component: Probe } : undefined,
      has: (name: string) => name === 'Probe',
      validate: () => ({ valid: true, errors: [] }),
    };
    const first = '[{c:"Probe",p:{"value":1}}]\n\nactive';
    const second = '[{c:"Probe",p:{"value":2}}]\n\nreplacement';
    const screen = render(<Streamdown componentRegistry={registry} instrumentation={metrics}>{first}</Streamdown>);
    expect(metrics.snapshot()).toMatchObject({ stableParses: 0, cacheEntries: 0 }); // component blocks bypass markdown parsing
    expect(mounts).toBe(1);
    screen.rerender(<Streamdown componentRegistry={registry} instrumentation={metrics}>{second}</Streamdown>);
    expect(metrics.snapshot()).toMatchObject({ resets: 1, cacheEntries: 0 });
    expect(mounts).toBe(2);
    expect(unmounts).toBe(1);
  });

  it('renders progressive component style and children before completion', () => {
    const Parent = ({ style, children }: { style?: object; children?: React.ReactNode }) => (
      <View testID="parent" style={style}>{children}</View>
    );
    const Child = ({ label }: { label?: string }) => <Text>{label}</Text>;
    const registry = {
      get: (name: string) => name === 'Parent'
        ? { component: Parent }
        : name === 'Child'
          ? { component: Child }
          : undefined,
      has: (name: string) => name === 'Parent' || name === 'Child',
      validate: () => ({ valid: true, errors: [] }),
    };
    const incomplete = '[{c:"Parent",p:{},style:{"padding":12},children:[{c:"Child",p:{"label":"nested"}}';
    const screen = render(<Streamdown componentRegistry={registry}>{incomplete}</Streamdown>);

    expect(screen.getByTestId('parent')).toHaveStyle({ padding: 12 });
    expect(within(screen.getByTestId('parent')).getByText('nested')).toBeTruthy();

    const complete = `${incomplete}]}]`;
    screen.rerender(<Streamdown componentRegistry={registry} isComplete>{complete}</Streamdown>);
    expect(screen.getByTestId('parent')).toHaveStyle({ padding: 12 });
    expect(within(screen.getByTestId('parent')).getByText('nested')).toBeTruthy();
  });

  it('fires streaming transitions exactly once and suppresses them in static mode', () => {
    // parity:99688298181eb2b46dd99eb19cd98232fd5bb6639c3a3a98b71a014c40c3fbcb
    // parity:e767efe890f35ce41ef72e37541c6f99fc9e93e77e9d2065bb3929cedd833249
    // parity:1fde8592108ed192ae56e16220370d827f262370b1f909c8a4fa237ff5461f22
    // parity:1cdea04f848288fe70736cbeb2198d0862018827301946cafa3ee5d527434de2
    const onAnimationStart = jest.fn();
    const onAnimationEnd = jest.fn();
    const screen = render(<Streamdown isAnimating={false} onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>text</Streamdown>);
    screen.rerender(<Streamdown isAnimating onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>text</Streamdown>);
    screen.rerender(<Streamdown isAnimating onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>updated</Streamdown>);
    screen.rerender(<Streamdown isAnimating={false} onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>updated</Streamdown>);
    expect(onAnimationStart).toHaveBeenCalledTimes(1);
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);

    screen.rerender(<Streamdown mode="static" isAnimating onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>updated</Streamdown>);
    screen.rerender(<Streamdown mode="static" isAnimating={false} onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>updated</Streamdown>);
    expect(onAnimationStart).toHaveBeenCalledTimes(1);
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);

    screen.rerender(<Streamdown isAnimating={false} onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>updated</Streamdown>);
    expect(onAnimationStart).toHaveBeenCalledTimes(1);
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });

  it('fires start once on an animating mount, never end on an idle mount, and uses current callbacks', () => {
    // parity:f8d5cbb329e4ebbc5fc8c69783d8e708f1b3dd5f73f5722351a8c8de0bbf29fe
    // parity:be7e35e2e73a2f8835635b99e1db260a7e2877fd62ad1ecdd2792ac0b04636bf
    const oldStart = jest.fn();
    const currentStart = jest.fn();
    const onEnd = jest.fn();
    const active = render(<Streamdown isAnimating onAnimationStart={oldStart}>text</Streamdown>);
    active.rerender(<Streamdown isAnimating onAnimationStart={currentStart}>text</Streamdown>);
    expect(oldStart).toHaveBeenCalledTimes(1);
    expect(currentStart).not.toHaveBeenCalled();

    const idle = render(<Streamdown isAnimating={false} onAnimationEnd={onEnd}>text</Streamdown>);
    expect(onEnd).not.toHaveBeenCalled();
    idle.rerender(<Streamdown isAnimating onAnimationStart={currentStart} onAnimationEnd={onEnd}>text</Streamdown>);
    expect(currentStart).toHaveBeenCalledTimes(1);
    idle.rerender(<Streamdown isAnimating={false} onAnimationStart={currentStart} onAnimationEnd={onEnd}>text</Streamdown>);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('reacts to caret, completion, and reduced-motion animation inputs', () => {
    // parity:7d37a5ba3815bdd09ad550d41f9d0737d24564da699eca5b0b9411b3e33329b0
    // parity:ffcd56eeedc283b8f42e0ccf5928575fac310f158f81a6dd0853613d1487d440
    // parity:c20c1940c0ffd0d859e00ed5f441ffa2d0d1332d569864401efbb41cc0af70dc
    const screen = render(<Streamdown animated caret="block" isAnimating reducedMotion={false}>AB</Streamdown>);
    expect(screen.getByTestId('streamdown-caret').props.children).toContain('▋');
    expect(screen.getAllByTestId('streamdown-new-content').length).toBeGreaterThan(0);

    screen.rerender(<Streamdown animated caret="circle" isAnimating reducedMotion>ABC</Streamdown>);
    expect(screen.getByTestId('streamdown-caret').props.children).toContain('●');
    expect(screen.queryByTestId('streamdown-new-content')).toBeNull();

    screen.rerender(<Streamdown animated caret="circle" isAnimating isComplete>ABC</Streamdown>);
    expect(screen.queryByTestId('streamdown-caret')).toBeNull();
  });

  it('marks only the newly visible suffix for animation', () => {
    // parity:9d37c393b0d6057cc3708f7e10029403ee0fe36c1eef5582ea64fde533b4ba9c
    const screen = render(<Streamdown animated isAnimating reducedMotion={false}>1. AB</Streamdown>);
    expect(screen.getByTestId('streamdown-new-content').props.children).toBe('AB');
    screen.rerender(<Streamdown animated isAnimating reducedMotion={false}>1. ABCD</Streamdown>);
    expect(screen.getByTestId('streamdown-new-content').props.children).toBe('CD');
  });

  it('reacts to value-equivalent animation configuration and separators', () => {
    const config = () => ({ animation: 'slideUp' as const, duration: 200, easing: 'linear' as const, sep: 'char' as const, stagger: 5 });
    const screen = render(<Streamdown animated={config()} isAnimating reducedMotion={false}>AB</Streamdown>);
    expect(screen.getAllByTestId('streamdown-new-content').map((node) => node.props.children)).toEqual(['A', 'B']);
    screen.rerender(<Streamdown animated={config()} isAnimating reducedMotion={false}>ABCD</Streamdown>);
    expect(screen.getAllByTestId('streamdown-new-content').map((node) => node.props.children)).toEqual(['C', 'D']);
  });

  it('defers animation and caret for incomplete heavy constructs', () => {
    const screen = render(<Streamdown animated caret="block" isAnimating>{'```ts\nconst n = 1'}</Streamdown>);
    expect(screen.queryByTestId('streamdown-new-content')).toBeNull();
    expect(screen.queryByTestId('streamdown-caret')).toBeNull();
  });

  it('keeps the stable parse cache bounded', () => {
    const metrics = createStreamingInstrumentation();
    const paragraphs = Array.from({ length: 160 }, (_, index) => `block ${index}`).join('\n\n');
    render(<Streamdown instrumentation={metrics}>{paragraphs}</Streamdown>);
    expect(metrics.snapshot().cacheEntries).toBeLessThanOrEqual(128);
  });
});
