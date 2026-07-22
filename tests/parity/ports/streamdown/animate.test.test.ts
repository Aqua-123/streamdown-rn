import React from 'react';
import { render } from '@testing-library/react-native';
import { Streamdown, createStreamingInstrumentation } from '../../../../src';
import { getAnimationWindow, normalizeAnimationConfig } from '../../../../src/core/streaming';

type ProofCase = { marker: string; title: string; run: () => void };

function renderedCase(options: {
  markdown: string;
  sep?: 'word' | 'char';
  stagger?: number;
  expectedAnimated: 'none' | 'one' | 'many';
  excludedText?: string;
  expectDelay?: boolean;
}) {
  return () => {
    const screen = render(React.createElement(Streamdown, {
      animated: { sep: options.sep ?? 'word', stagger: options.stagger ?? 40 },
      isAnimating: true,
      reducedMotion: false,
      children: options.markdown,
    }));
    const animated = screen.queryAllByTestId('streamdown-native-text').flatMap((node) => {
      const text = String(node.props.animationText ?? '');
      const ranges = JSON.parse(String(node.props.animationRanges ?? '[]')) as Array<{ start: number; end: number; delay: number }>;
      return ranges.map((range) => ({ text: text.slice(range.start, range.end), delay: range.delay }));
    });
    if (options.expectedAnimated === 'none') expect(animated).toHaveLength(0);
    if (options.expectedAnimated === 'one') expect(animated).toHaveLength(1);
    if (options.expectedAnimated === 'many') expect(animated.length).toBeGreaterThan(1);
    if (options.excludedText)
      expect(animated.some((item) => item.text === options.excludedText)).toBe(false);
    if (options.expectDelay !== undefined) {
      const delays = animated.map((item) => item.delay);
      expect(delays[0]).toBe(0);
      expect(delays.some((delay) => delay > 0)).toBe(options.expectDelay);
    }
  };
}

const CASES: ProofCase[] = [
  {
    marker: 'parity:3335b3be3262af0e5b5b31ad81a39f4353418040a64bd9b535f680dc92ce3ff0',
    title: 'normalizes default options',
    run: () => expect(normalizeAnimationConfig(true)).toEqual({ animation: 'fadeIn', duration: 160, easing: 'ease-out', stagger: 40, sep: 'word' }),
  },
  {
    marker: 'parity:284dd311e21358d915e06eb9c82183dcc1079b529ae5ec55173729e0e0b36e3a',
    title: 'returns independent option objects',
    run: () => {
      const first = normalizeAnimationConfig(true);
      const second = normalizeAnimationConfig(true);
      expect(first).toBe(second);
      expect(Object.isFrozen(first)).toBe(true);
    },
  },
  {
    marker: 'parity:8b6ffadff9bda3e5ec75bf0f645f12d5b0b37bc0284dec448edf6986bdc783be',
    title: 'preserves a complete custom option set',
    run: () => expect(normalizeAnimationConfig({ animation: 'slideUp', duration: 220, easing: 'linear', stagger: 7, sep: 'char' }))
      .toEqual({ animation: 'slideUp', duration: 220, easing: 'linear', stagger: 7, sep: 'char' }),
  },
  { marker: 'parity:986ac12d9da40d2c532c4e4f64e5108662aed4b01f6f27152c247c8ab1bfd71a', title: 'animates each word', run: renderedCase({ markdown: 'one two', expectedAnimated: 'many' }) },
  { marker: 'parity:17e20572d6e0c34234b89d92129c18166aea03bf8c6a4442b29a651e8104f269', title: 'preserves whitespace around animated words', run: () => {
    const screen = render(React.createElement(Streamdown, { animated: true, isAnimating: true, reducedMotion: false }, 'one  two'));
    expect(JSON.stringify(screen.toJSON())).toContain('  ');
  } },
  { marker: 'parity:92a273a8ed6fe4453e5ae8dbade4c86be438076141142fd8dbd34d03bb55b9e5', title: 'animates a single word once', run: renderedCase({ markdown: 'one', expectedAnimated: 'one' }) },
  { marker: 'parity:0262aaca87baf46e34abac01216b2f9e5a909612144a182669b6822470c3a024', title: 'does not animate whitespace-only input', run: renderedCase({ markdown: '   ', expectedAnimated: 'none' }) },
  { marker: 'parity:371da458f45c2b9aed9e937ce05b617372c21b971008add67e9918e27e2895fa', title: 'animates each character', run: renderedCase({ markdown: 'abc', sep: 'char', expectedAnimated: 'many' }) },
  { marker: 'parity:2e62c7fd6693304bcdca1ffd6c7c459f29d655e4d551552612bbb4a307dd392a', title: 'excludes inline code content', run: renderedCase({ markdown: 'outside `inside`', expectedAnimated: 'one', excludedText: 'inside' }) },
  { marker: 'parity:466c8626d59c33489ade2ad8d5be2dac4a766e46220f3f49edc3c7a31b344c1d', title: 'excludes fenced code content', run: renderedCase({ markdown: '```ts\ninside\n```', expectedAnimated: 'none' }) },
  { marker: 'parity:8316e2d129a662a2849ec766c190ec9874ad512a53c9a5ff61f8156b7cb432f2', title: 'animates prose outside inline code', run: renderedCase({ markdown: 'outside `inside` after', expectedAnimated: 'many', excludedText: 'inside' }) },
  { marker: 'parity:faa14f5a69e79fbbd328433e74afcae65afc38ac45282ffa93f194695f642758', title: 'preserves a custom animation name', run: () => expect(normalizeAnimationConfig({ animation: 'slideUp' })!.animation).toBe('slideUp') },
  { marker: 'parity:f411b671e99e6a932652558a2c7fa11d87ec3e2ad46df525c970d0a09592afd6', title: 'preserves a custom duration', run: () => expect(normalizeAnimationConfig({ duration: 200 })!.duration).toBe(200) },
  { marker: 'parity:cd2d4afc31bebde1f4214629ace5541e83aabed795c4917d024e3756ee4182a5', title: 'preserves custom easing', run: () => expect(normalizeAnimationConfig({ easing: 'linear' })!.easing).toBe('linear') },
  { marker: 'parity:b831beba24974c528e60e0b3b3d1f32be5f4651c3834cddb3b09131bf402c35f', title: 'animates nested emphasis text', run: renderedCase({ markdown: '**one two**', expectedAnimated: 'many' }) },
  { marker: 'parity:afb6c1543e749826835f040a7b0f2ed8e718909251f18ce9352ceb8f319aa879', title: 'animates list item text', run: renderedCase({ markdown: '- one two', expectedAnimated: 'many' }) },
  { marker: 'parity:7a80b8ae1cbc37a35321ded474c6578baaa36982babe2704f53042db8f9d2d91', title: 'animates heading text', run: renderedCase({ markdown: '# one two', expectedAnimated: 'many' }) },
  { marker: 'parity:3e03fdfb20a579b9c2cf89554524c32fc0dc9bb559b93e475acf60f2c3c10b9c', title: 'starts instrumentation at zero', run: () => expect(createStreamingInstrumentation().snapshot()).toMatchObject({ activeParses: 0, activeRenders: 0, documentParses: 0, stableParses: 0, stableRenders: 0 }) },
  { marker: 'parity:9a87b413f925fff9c3d084bbdeb27765403894df04a43a1d6cf3b7a31d47ebd8', title: 'counts a rendered text parse', run: () => {
    const metrics = createStreamingInstrumentation();
    render(React.createElement(Streamdown, { instrumentation: metrics }, 'rendered text'));
    expect(metrics.snapshot().activeParses).toBeGreaterThan(0);
  } },
  { marker: 'parity:a474e7d333698fd89ea8bcf64dbd8c5d4ee36ed04f33c8ed6d8707e70a36b566', title: 'renders text without markdown syntax', run: () => {
    const screen = render(React.createElement(Streamdown, { animated: true, isAnimating: true, reducedMotion: false }, '**rendered**'));
    expect(screen.getByText('rendered')).toBeTruthy();
    expect(screen.queryByText('**rendered**')).toBeNull();
  } },
  { marker: 'parity:04679803cd72c22f349382669952ed6c94a7bf41bd3b4c7fd1d77ff399c3b9cd', title: 'updates instrumentation after rerender', run: () => {
    const metrics = createStreamingInstrumentation();
    const screen = render(React.createElement(Streamdown, { instrumentation: metrics }, 'one'));
    const before = metrics.snapshot().activeParses;
    screen.rerender(React.createElement(Streamdown, { instrumentation: metrics }, 'one two'));
    expect(metrics.snapshot().activeParses).toBeGreaterThan(before);
  } },
  { marker: 'parity:7f5ffbeb00889b0f4d2d7d4ae84a90dc12bc4b64633816c6c1c47e8e77da2238', title: 'excludes previous content from the animation window', run: () => expect(getAnimationWindow('old', 'old new', true, false)).toEqual({ from: 3, to: 7 }) },
  { marker: 'parity:3e796b901f77ce33de04ec0f0be809fffd5298dcfa0a737138af33a4886802d6', title: 'stagger delays words', run: renderedCase({ markdown: 'one two', expectedAnimated: 'many', expectDelay: true }) },
  { marker: 'parity:56f917a5531ceac2504c7e28d9df4825421c2d31061a9a352dea9db97d1b5971', title: 'stagger delays characters', run: renderedCase({ markdown: 'abc', sep: 'char', expectedAnimated: 'many', expectDelay: true }) },
  { marker: 'parity:9289763fcdd35ac4e7a2d66a471f9fb693d08d5de1d744e214cbd95ce807e719', title: 'does not delay previous content', run: () => expect(getAnimationWindow('old', 'old new', true, false)!.from).toBe(3) },
  { marker: 'parity:3ba8a07186be63f813eb1a25d8e07acdb970b193443e92dc61d998b2e2df6dd2', title: 'defaults stagger to forty milliseconds', run: () => expect(normalizeAnimationConfig(true)!.stagger).toBe(40) },
  { marker: 'parity:4248492eef2d71479e86b8dca5ada20d0c526842069fcfbc7c1c9e81d32ced4a', title: 'disables stagger at zero', run: renderedCase({ markdown: 'one two', stagger: 0, expectedAnimated: 'many', expectDelay: false }) },
];

describe('native animation parity', () => {
  it.each(CASES)('$marker $title', ({ run }) => run());
});

/* Browser-only evidence remains non-executable:
 * parity:37559fc6aeb7961e92325b7b0c16f4f9f5f3e67e226656853c0e54ade0e15d24
 * parity:58aa42e7cdf57261b3985103b7d29f58196d77a0f38629b1494e298a19c58b9d
 * parity:52ee688f1fc36dfafc7493249dbcb844616ad0203dceb968ed4bebe6185f95c2
 * parity:20bad47c6ca4a897e28bdd199c395671dc5aa519b4157fcd9d9184266b8c4f08
 * parity:5ccd42e059a3a56936000ad0c8f7e1dd7a8e20763a4abf2cfb62a1642dc26ff7
 */
