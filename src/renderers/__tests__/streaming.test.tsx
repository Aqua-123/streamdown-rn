import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { render, waitFor, within } from '@testing-library/react-native';
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
  it('keeps only the latest bounded parser timing samples', () => {
    const metrics = createStreamingInstrumentation();
    for (let duration = 0; duration < 1_100; duration++) metrics.recordParserDuration?.(duration);
    expect(metrics.snapshot().parserDurationNs).toHaveLength(1_024);
    expect(metrics.snapshot().parserDurationNs[0]).toBe(76);
    expect(metrics.snapshot().parserDurationNs.at(-1)).toBe(1_099);
  });
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

  it('keeps completed stable-block batches mounted across active appends', () => {
    const metrics = createStreamingInstrumentation();
    const stable = Array.from({ length: 65 }, (_, index) => `# H${index}\n\n`).join('');
    const screen = render(<Streamdown instrumentation={metrics}>{`${stable}active`}</Streamdown>);
    const before = metrics.snapshot();
    expect(before.stableRenders).toBe(65);
    screen.rerender(<Streamdown instrumentation={metrics}>{`${stable}active grows`}</Streamdown>);
    expect(metrics.snapshot().stableRenders).toBe(before.stableRenders);
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

  it('counts active rerenders caused by behavior-only prop changes', () => {
    const metrics = createStreamingInstrumentation();
    const screen = render(<Streamdown instrumentation={metrics} theme="dark">active</Streamdown>);
    const before = metrics.snapshot().activeRenders;
    screen.rerender(<Streamdown instrumentation={metrics} theme="light">active</Streamdown>);
    expect(metrics.snapshot().activeRenders).toBe(before + 1);
  });

  it('uses a bounded plain-text preview for a pathological active block', () => {
    const metrics = createStreamingInstrumentation();
    const content = 'a'.repeat(3 * 1024);
    const screen = render(<Streamdown instrumentation={metrics}>{content}</Streamdown>);
    expect(visibleText(screen.toJSON())).toBe(`…${'a'.repeat(2 * 1024)}`);
    expect(metrics.snapshot().activeParses).toBe(0);
    screen.rerender(<Streamdown instrumentation={metrics} isComplete>{content}</Streamdown>);
    expect(screen.getByText(content)).toBeTruthy();
    expect(metrics.snapshot().documentParses).toBe(1);
  });

  it('updates oversized previews on a bounded cadence and restores the complete document', () => {
    const initial = 'a'.repeat(3 * 1024);
    const screen = render(<Streamdown>{initial}</Streamdown>);
    const preview = visibleText(screen.toJSON());

    screen.rerender(<Streamdown>{`${initial}b`}</Streamdown>);
    expect(visibleText(screen.toJSON())).toBe(preview);

    const complete = `${initial}${'b'.repeat(256)}`;
    screen.rerender(<Streamdown>{complete}</Streamdown>);
    expect(visibleText(screen.toJSON())).not.toBe(preview);
    screen.rerender(<Streamdown isComplete>{complete}</Streamdown>);
    expect(screen.getByText(complete)).toBeTruthy();
  });

  it('rejects input beyond the configured cumulative ceiling and recovers below it', async () => {
    const onError = jest.fn();
    const metrics = createStreamingInstrumentation();
    const screen = render(<Streamdown maxInputLength={8} onError={onError} instrumentation={metrics}>{'12345678'}</Streamdown>);
    expect(screen.getByText('12345678')).toBeTruthy();
    expect(onError).not.toHaveBeenCalled();
    const parsesAtLimit = metrics.snapshot().activeParses;

    screen.rerender(<Streamdown maxInputLength={8} onError={onError} instrumentation={metrics}>{'123456789'}</Streamdown>);
    expect(visibleText(screen.getByRole('alert'))).toContain('8-UTF-16-code-unit limit');
    expect(visibleText(screen.toJSON())).toContain('123456789');
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(RangeError)));
    expect(metrics.snapshot().activeParses).toBe(parsesAtLimit);

    screen.rerender(<Streamdown maxInputLength={8} onError={onError} instrumentation={metrics} isComplete>{'1234567890'}</Streamdown>);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(metrics.snapshot().documentParses).toBe(0);

    screen.rerender(<Streamdown maxInputLength={8} onError={onError} instrumentation={metrics}>{'recovery'}</Streamdown>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('recovery')).toBeTruthy();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid maxInputLength configuration %p instead of restoring the default',
    async (maxInputLength) => {
      const onError = jest.fn();
      const screen = render(<Streamdown maxInputLength={maxInputLength} onError={onError}>content</Streamdown>);
      expect(visibleText(screen.getByRole('alert'))).toContain('positive safe integer');
      await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(RangeError)));
    }
  );

  it('measures maxInputLength in UTF-16 code units', () => {
    const screen = render(<Streamdown maxInputLength={2}>😀</Streamdown>);
    expect(screen.getByText('😀')).toBeTruthy();
    screen.rerender(<Streamdown maxInputLength={1}>😀</Streamdown>);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('bounds progressive component extraction while preserving smaller previews', () => {
    const Probe = ({ label }: { label?: string }) => <Text>{label}</Text>;
    const registry = {
      get: (name: string) => name === 'Probe' ? { component: Probe } : undefined,
      has: (name: string) => name === 'Probe',
      validate: () => ({ valid: true, errors: [] }),
    };
    const small = '[{c:"Probe",p:{"label":"small"}}]';
    const screen = render(<Streamdown componentRegistry={registry}>{small}</Streamdown>);
    expect(screen.getByText('small')).toBeTruthy();

    const large = `[{c:"Probe",p:{"label":"${'a'.repeat(9 * 1024)}`;
    screen.rerender(<Streamdown componentRegistry={registry}>{large}</Streamdown>);
    expect(visibleText(screen.toJSON())).toBe(`…${'a'.repeat(2 * 1024)}`);
    expect(screen.queryByText('small')).toBeNull();
  });

  it.each(['', ' \n\t'])('resets populated state through an empty stream value %p', (empty) => {
    const metrics = createStreamingInstrumentation();
    const screen = render(<Streamdown instrumentation={metrics}>{'# Stable\n\nactive'}</Streamdown>);
    screen.rerender(<Streamdown instrumentation={metrics}>{empty}</Streamdown>);
    expect(screen.toJSON()).toBeNull();
    expect(metrics.snapshot().resets).toBe(1);
    screen.rerender(<Streamdown instrumentation={metrics}>{'new content'}</Streamdown>);
    expect(screen.getByText('new content')).toBeTruthy();
    expect(screen.queryByText('Stable')).toBeNull();
  });

  it('resets an append-only stream when its key changes', () => {
    const screen = render(<Streamdown appendOnly streamKey="one">first message</Streamdown>);
    screen.rerender(<Streamdown appendOnly streamKey="two">longer replacement</Streamdown>);
    expect(screen.getByText('longer replacement')).toBeTruthy();
    expect(screen.queryByText('first message')).toBeNull();
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

  // parity:99688298181eb2b46dd99eb19cd98232fd5bb6639c3a3a98b71a014c40c3fbcb
  it('fires onAnimationStart when isAnimating transitions from false to true', () => {
    const onAnimationStart = jest.fn();
    const screen = render(<Streamdown isAnimating={false} onAnimationStart={onAnimationStart}>text</Streamdown>);
    screen.rerender(<Streamdown isAnimating onAnimationStart={onAnimationStart}>text</Streamdown>);
    expect(onAnimationStart).toHaveBeenCalledTimes(1);
  });

  // parity:e767efe890f35ce41ef72e37541c6f99fc9e93e77e9d2065bb3929cedd833249
  it('fires onAnimationEnd when isAnimating transitions from true to false', () => {
    const onAnimationEnd = jest.fn();
    const screen = render(<Streamdown isAnimating onAnimationEnd={onAnimationEnd}>text</Streamdown>);
    screen.rerender(<Streamdown isAnimating={false} onAnimationEnd={onAnimationEnd}>text</Streamdown>);
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });

  // parity:1fde8592108ed192ae56e16220370d827f262370b1f909c8a4fa237ff5461f22
  it('does not fire callbacks while isAnimating is unchanged across rerenders', () => {
    const onAnimationStart = jest.fn();
    const onAnimationEnd = jest.fn();
    const screen = render(<Streamdown isAnimating={false} onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>text</Streamdown>);
    screen.rerender(<Streamdown isAnimating={false} onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>updated</Streamdown>);
    expect(onAnimationStart).not.toHaveBeenCalled();
    expect(onAnimationEnd).not.toHaveBeenCalled();
  });

  // parity:1cdea04f848288fe70736cbeb2198d0862018827301946cafa3ee5d527434de2
  it('suppresses animation callbacks in static mode', () => {
    const onAnimationStart = jest.fn();
    const onAnimationEnd = jest.fn();
    const screen = render(<Streamdown mode="static" isAnimating={false} onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>text</Streamdown>);
    screen.rerender(<Streamdown mode="static" isAnimating onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>updated</Streamdown>);
    screen.rerender(<Streamdown mode="static" isAnimating={false} onAnimationStart={onAnimationStart} onAnimationEnd={onAnimationEnd}>updated</Streamdown>);
    expect(onAnimationStart).not.toHaveBeenCalled();
    expect(onAnimationEnd).not.toHaveBeenCalled();
  });

  // parity:f8d5cbb329e4ebbc5fc8c69783d8e708f1b3dd5f73f5722351a8c8de0bbf29fe
  it('fires onAnimationStart once on an animating initial mount', () => {
    const onAnimationStart = jest.fn();
    const screen = render(<Streamdown isAnimating onAnimationStart={onAnimationStart}>text</Streamdown>);
    screen.rerender(<Streamdown isAnimating onAnimationStart={onAnimationStart}>updated</Streamdown>);
    expect(onAnimationStart).toHaveBeenCalledTimes(1);
  });

  // parity:be7e35e2e73a2f8835635b99e1db260a7e2877fd62ad1ecdd2792ac0b04636bf
  it('does not fire onAnimationEnd on an idle initial mount', () => {
    const onAnimationEnd = jest.fn();
    render(<Streamdown isAnimating={false} onAnimationEnd={onAnimationEnd}>text</Streamdown>);
    expect(onAnimationEnd).not.toHaveBeenCalled();
  });

  it('reacts to caret, completion, and reduced-motion animation inputs', () => {
    const screen = render(<Streamdown animated caret="block" isAnimating reducedMotion={false}>AB</Streamdown>);
    expect(screen.getByTestId('streamdown-caret').props.children).toContain('▋');
    expect(screen.getAllByTestId('streamdown-new-content').length).toBeGreaterThan(0);

    screen.rerender(<Streamdown animated caret="circle" isAnimating reducedMotion>ABC</Streamdown>);
    expect(screen.getByTestId('streamdown-caret').props.children).toContain('●');
    expect(screen.queryByTestId('streamdown-new-content')).toBeNull();

    screen.rerender(<Streamdown animated caret="circle" isAnimating isComplete>ABC</Streamdown>);
    expect(screen.queryByTestId('streamdown-caret')).toBeNull();
  });
  // parity:c20c1940c0ffd0d859e00ed5f441ffa2d0d1332d569864401efbb41cc0af70dc
  it('changes the native caret glyph when the caret prop and content change', () => {
    const screen = render(<Streamdown caret="block" isAnimating>AB</Streamdown>);
    expect(screen.getByTestId('streamdown-caret').props.children).toContain('▋');
    screen.rerender(<Streamdown caret="circle" isAnimating>ABC</Streamdown>);
    expect(screen.getByTestId('streamdown-caret').props.children).toContain('●');
  });

  // parity:7d37a5ba3815bdd09ad550d41f9d0737d24564da699eca5b0b9411b3e33329b0
  it('renders a block caret while animation is active', () => {
    const screen = render(<Streamdown caret="block" isAnimating>AB</Streamdown>);
    expect(screen.getByTestId('streamdown-caret').props.children).toContain('▋');
  });

  // parity:ffcd56eeedc283b8f42e0ccf5928575fac310f158f81a6dd0853613d1487d440
  it('renders a circle caret while animation is active', () => {
    const screen = render(<Streamdown caret="circle" isAnimating>AB</Streamdown>);
    expect(screen.getByTestId('streamdown-caret').props.children).toContain('●');
  });

  // parity:9d37c393b0d6057cc3708f7e10029403ee0fe36c1eef5582ea64fde533b4ba9c
  it('marks only the newly visible suffix for animation', () => {
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
