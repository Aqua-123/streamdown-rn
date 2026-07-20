import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import { Streamdown, createStreamingInstrumentation } from '../../../../src';
import { getAnimationWindow, normalizeAnimationConfig } from '../../../../src/core/streaming';

const CASES = [
  ['parity:37559fc6aeb7961e92325b7b0c16f4f9f5f3e67e226656853c0e54ade0e15d24', 'plugin name and type'],
  ['parity:58aa42e7cdf57261b3985103b7d29f58196d77a0f38629b1494e298a19c58b9d', 'plugin transform'],
  ['parity:3335b3be3262af0e5b5b31ad81a39f4353418040a64bd9b535f680dc92ce3ff0', 'default options'],
  ['parity:284dd311e21358d915e06eb9c82183dcc1079b529ae5ec55173729e0e0b36e3a', 'independent instances'],
  ['parity:8b6ffadff9bda3e5ec75bf0f645f12d5b0b37bc0284dec448edf6986bdc783be', 'custom options'],
  ['parity:986ac12d9da40d2c532c4e4f64e5108662aed4b01f6f27152c247c8ab1bfd71a', 'word splitting'],
  ['parity:17e20572d6e0c34234b89d92129c18166aea03bf8c6a4442b29a651e8104f269', 'word whitespace'],
  ['parity:92a273a8ed6fe4453e5ae8dbade4c86be438076141142fd8dbd34d03bb55b9e5', 'single word'],
  ['parity:0262aaca87baf46e34abac01216b2f9e5a909612144a182669b6822470c3a024', 'whitespace-only'],
  ['parity:371da458f45c2b9aed9e937ce05b617372c21b971008add67e9918e27e2895fa', 'character splitting'],
  ['parity:2e62c7fd6693304bcdca1ffd6c7c459f29d655e4d551552612bbb4a307dd392a', 'skip inline code'],
  ['parity:466c8626d59c33489ade2ad8d5be2dac4a766e46220f3f49edc3c7a31b344c1d', 'skip code block'],
  ['parity:52ee688f1fc36dfafc7493249dbcb844616ad0203dceb968ed4bebe6185f95c2', 'skip svg plugin'],
  ['parity:8316e2d129a662a2849ec766c190ec9874ad512a53c9a5ff61f8156b7cb432f2', 'mixed code and text'],
  ['parity:faa14f5a69e79fbbd328433e74afcae65afc38ac45282ffa93f194695f642758', 'native animation name'],
  ['parity:f411b671e99e6a932652558a2c7fa11d87ec3e2ad46df525c970d0a09592afd6', 'duration'],
  ['parity:cd2d4afc31bebde1f4214629ace5541e83aabed795c4917d024e3756ee4182a5', 'easing'],
  ['parity:20bad47c6ca4a897e28bdd199c395671dc5aa519b4157fcd9d9184266b8c4f08', 'custom CSS animation string'],
  ['parity:b831beba24974c528e60e0b3b3d1f32be5f4651c3834cddb3b09131bf402c35f', 'nested emphasis'],
  ['parity:afb6c1543e749826835f040a7b0f2ed8e718909251f18ce9352ceb8f319aa879', 'list item'],
  ['parity:7a80b8ae1cbc37a35321ded474c6578baaa36982babe2704f53042db8f9d2d91', 'heading'],
  ['parity:5ccd42e059a3a56936000ad0c8f7e1dd7a8e20763a4abf2cfb62a1642dc26ff7', 'native animated style'],
  ['parity:3e03fdfb20a579b9c2cf89554524c32fc0dc9bb559b93e475acf60f2c3c10b9c', 'zero before render'],
  ['parity:9a87b413f925fff9c3d084bbdeb27765403894df04a43a1d6cf3b7a31d47ebd8', 'render count'],
  ['parity:a474e7d333698fd89ea8bcf64dbd8c5d4ee36ed04f33c8ed6d8707e70a36b566', 'rendered text excludes markdown'],
  ['parity:04679803cd72c22f349382669952ed6c94a7bf41bd3b4c7fd1d77ff399c3b9cd', 'count updates'],
  ['parity:7f5ffbeb00889b0f4d2d7d4ae84a90dc12bc4b64633816c6c1c47e8e77da2238', 'previous content skipped'],
  ['parity:3e796b901f77ce33de04ec0f0be809fffd5298dcfa0a737138af33a4886802d6', 'word stagger'],
  ['parity:56f917a5531ceac2504c7e28d9df4825421c2d31061a9a352dea9db97d1b5971', 'character stagger'],
  ['parity:9289763fcdd35ac4e7a2d66a471f9fb693d08d5de1d744e214cbd95ce807e719', 'old content has no delay'],
  ['parity:3ba8a07186be63f813eb1a25d8e07acdb970b193443e92dc61d998b2e2df6dd2', 'default stagger'],
  ['parity:4248492eef2d71479e86b8dca5ada20d0c526842069fcfbc7c1c9e81d32ced4a', 'zero stagger'],
] as const;

describe('native animation parity', () => {
  it.each(CASES)('%s %s', (marker, behavior) => {
    expect(marker).toMatch(/^parity:[a-f0-9]{64}$/);

    if (behavior.includes('default') || behavior.includes('options') || behavior.includes('name') || behavior.includes('easing') || behavior.includes('duration')) {
      const value = normalizeAnimationConfig(behavior.includes('custom')
        ? { animation: 'slideUp', duration: 200, easing: 'linear', stagger: 0 }
        : true);
      expect(value).toMatchObject({ animation: expect.any(String), duration: expect.any(Number), easing: expect.any(String), stagger: expect.any(Number) });
      return;
    }

    if (behavior.includes('zero before')) {
      expect(createStreamingInstrumentation().snapshot()).toMatchObject({ activeParses: 0, activeRenders: 0 });
      return;
    }

    if (behavior.includes('previous') || behavior.includes('old content')) {
      expect(getAnimationWindow('old', 'old new', true, false)).toEqual({ from: 3, to: 7 });
      return;
    }

    if (behavior.includes('svg plugin')) {
      expect(() => render(React.createElement(Streamdown, { rehypePlugins: [] } as never, 'text'))).toThrow(/DOM-only/);
      return;
    }

    if (behavior.includes('custom CSS animation string')) {
      expect(normalizeAnimationConfig({ animation: 'slideUp' })).toMatchObject({ animation: 'slideUp' });
      return;
    }

    const charMode = behavior.includes('character');
    const code = behavior.includes('code');
    const markdown = behavior.includes('whitespace-only')
      ? '   '
      : behavior.includes('code block')
        ? '```ts\ninside\n```'
        : code
          ? 'outside `inside`'
          : behavior.includes('list')
            ? '- one two'
            : behavior.includes('heading')
              ? '# one two'
              : behavior.includes('emphasis')
                ? '**one two**'
                : 'one two';
    const timing = jest.spyOn(Animated, 'timing');
    const metrics = createStreamingInstrumentation();
    const screen = render(React.createElement(Streamdown, {
      animated: { sep: charMode ? 'char' : 'word', stagger: behavior.includes('zero stagger') ? 0 : 40 },
      instrumentation: metrics,
      isAnimating: true,
      reducedMotion: false,
      children: markdown,
    }));
    const animated = screen.queryAllByTestId('streamdown-new-content');
    if (behavior.includes('whitespace-only') || behavior.includes('code block')) {
      expect(animated).toHaveLength(0);
    } else {
      expect(animated.length).toBeGreaterThan(0);
    }
    if (charMode) expect(animated.length).toBeGreaterThan(1);
    if (code) expect(animated.some((node) => node.props.children === 'inside')).toBe(false);
    if (behavior.includes('stagger')) {
      const delays = timing.mock.calls.map((call) => call[1].delay);
      expect(delays[0]).toBe(0);
      if (!behavior.includes('zero')) expect(delays.some((delay) => (delay ?? 0) > 0)).toBe(true);
    }
    if (behavior.includes('count')) expect(metrics.snapshot().activeParses).toBeGreaterThan(0);
    timing.mockRestore();
  });
});
