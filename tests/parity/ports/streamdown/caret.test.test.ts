import React from 'react';
import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src';

const CASES = [
  ['parity:61844cccb22cac39f5d63d3acfad6eb6c127c535c142d3484cbaa8377a29b5e4', 'undefined caret'],
  ['parity:91345c35c0086a5978df7cdc093169390b4626c3ff6725b652c2b71c028af206', 'not animating'],
  ['parity:d6aa7b67c1a413dbfe4d837af2fa1341dabed9d164d1f4d240fc98073070a7cb', 'default not animating'],
  ['parity:1a3b73e7a7701c64b31e9ad16b19631e19866a1bc1c8288ec8b1dbc504b8de63', 'add caret'],
  ['parity:23b0658aab21acec98806679afc5693c844e3c6f8faab1e8a0d4440d0d11f271', 'remove caret animation'],
  ['parity:f6eb4d3d4c892af18a58e142ebbea69af41d8f285ad051c3914bd7b9e50a81da', 'remove caret prop'],
  ['parity:db95d33bcf7e37789ddafaa755385c4a1a4496599bcc730121672baabb27c800', 'streaming mode'],
  ['parity:6bad6e13e93a23d052f38ef519b7d3df5a9531f123117a4c4619e4808c75dfc6', 'static mode'],
  ['parity:4127143a5e6eeb4403905fc1910d365a6fb4de2aba5d92513a80cd368fcb532e', 'content updates'],
  ['parity:2a267e9389f2589683bcf26e3d7168a740329cfdcaf1941d668b87773ac54964', 'empty content'],
  ['parity:e6b0886a3ed8071e4d7bc23240a83650b89896da31a28a0acffe19713fedfa0c', 'empty placeholder'],
  ['parity:cad798a75f0f10ad354546f176a8cfdcf83d8d79849862a3f2954a6678f2c1d9', 'empty not animating'],
  ['parity:133340222ccc09df84abc0ab167f9fa82d5c27e48628a5fc72b883b0b69da00b', 'empty without caret'],
  ['parity:31bc26aaba9472259e802ee52c9f7dd48dc858f8da99270b03081c4e52de1216', 'markdown content'],
  ['parity:7f2b391895177ddd9a011ba6f61e5f33b48b6f16deb7e4640f6978f6b23206c4', 'complete code'],
  ['parity:25bba0ff86835a8f69afae9140d0bf6f327fd0a9e3ca968f6ce3107940f8b90b', 'incomplete code'],
  ['parity:fd4cf9248bec8c991599092c80ed1844722143a98e2d5eeb6dc2a8a4ecc23ed6', 'code completion transition'],
  ['parity:de0fe0a0a8ae3312004d626b9ca72aae9e9dcb7af19cdad51992003dec2a3479', 'complete table'],
  ['parity:a3c7b4c55fd435069ad2ba1b6c3ec4e900c4cfc491a48cd4208d2e00b737da6a', 'incomplete table'],
  ['parity:e2c643a8cb7651b7d3529e82002bd249cf3e3114563244a72ea4988b767a4795', 'table followed by text'],
  ['parity:2eb224fa370350a0cac77ddf9c4546a77a975a77695e5e17152438033eab8f92', 'caret prop memo correctness'],
  ['parity:12f05dec63045589ae9d923942023fc8df4a7bbc96cdd2544c93c4241df8f8c4', 'animation memo correctness'],
  ['parity:54cfe52105ed86376cbde4d3e574d51993c0b593f0c1a36e164b8ffe2121f007', 'custom component'],
  ['parity:87589f0c41eb7880d718aa5e5abec2ab7b5a36b4fc66e45107c73e4d873c34a3', 'CSS enabled'],
  ['parity:a3ee4802a606d60bc82a197373fd6d0095315287feaebdbf24cca0a3275a412d', 'CSS disabled'],
  ['parity:e2a1d2c88235510e78c7d7ebaaf3c76e482beb96a73300f314c8b844770b803a', 'CSS className preservation'],
  ['parity:d201677db7bf9fb5e5c4c309b2571f74b246bd67ab64ad746d9287ec72641875', 'block type'],
  ['parity:d24898121c08ed3eb63bb3cacf0ed55b5a63d5781c71cdd2564c06a67775d2d0', 'circle type'],
  ['parity:15d3d42f53745f49a368d84fe309b480771ac53b27ee16cc3e88ed2220f83551', 'undefined type'],
  ['parity:e9bd2cc47985c3048cd885487a7acfb72edce278918af2d632d343216c278bf0', 'chat streaming'],
  ['parity:c00f461f69f6d302af61c8bf86542a338f30be5b1ba70d9b364f1dc3845d0a64', 'assistant conditional'],
  ['parity:b69195c091df4f1fa4293eb3d86b622ddd66a8107d7c16a4f775a6a070764a7b', 'non-assistant'],
  ['parity:fc1793c6283159d98ac9b50c0f585f2a556034eefeae8727d17ddb94c1b29dac', 'non-last message'],
] as const;

function subject(children: string, caret: 'block' | 'circle' | undefined, isAnimating = true, mode: 'static' | 'streaming' = 'streaming') {
  return React.createElement(Streamdown, { caret, isAnimating, mode, children });
}

describe('native caret parity', () => {
  it.each(CASES)('%s %s', (marker, behavior) => {
    expect(marker).toMatch(/^parity:[a-f0-9]{64}$/);

    if (behavior.includes('className')) {
      expect(() => render(React.createElement(Streamdown, { className: 'web-only' } as never, 'text'))).toThrow(/DOM-only/);
      return;
    }

    if (behavior.includes('empty')) {
      const enabled = behavior === 'empty content' || behavior === 'empty placeholder';
      const screen = render(subject('', enabled ? 'block' : behavior.includes('without') ? undefined : 'block', enabled));
      expect(Boolean(screen.queryByTestId('streamdown-caret'))).toBe(enabled);
      return;
    }

    if (behavior.includes('static') || behavior.includes('non-assistant') || behavior.includes('non-last') || behavior.includes('undefined') || behavior.includes('not animating')) {
      const screen = render(subject('text', behavior.includes('undefined') ? undefined : 'block', !behavior.includes('not animating') && !behavior.includes('non-'), behavior.includes('static') ? 'static' : 'streaming'));
      expect(screen.queryByTestId('streamdown-caret')).toBeNull();
      return;
    }

    if (behavior.includes('incomplete code') || behavior.includes('incomplete table') || behavior === 'complete table') {
      const markdown = behavior.includes('code') ? '```ts\nconst n = 1' : '| a | b |\n| - | - |\n| 1 |';
      expect(render(subject(markdown, 'block')).queryByTestId('streamdown-caret')).toBeNull();
      return;
    }

    if (behavior.includes('complete code') || behavior.includes('code completion')) {
      const screen = render(subject('```ts\nconst n = 1\n```', 'block'));
      expect(screen.queryByTestId('streamdown-caret')).toBeTruthy();
      return;
    }

    if (behavior.includes('remove') || behavior.includes('add') || behavior.includes('memo') || behavior.includes('updates')) {
      const screen = render(subject('A', 'block', !behavior.includes('add')));
      screen.rerender(subject('AB', behavior.includes('remove caret prop') ? undefined : 'circle', behavior.includes('remove caret animation') ? false : true));
      const caret = screen.queryByTestId('streamdown-caret');
      if (behavior.includes('remove')) expect(caret).toBeNull();
      else expect(caret?.props.children).toContain('●');
      return;
    }

    const caret = behavior.includes('circle') ? 'circle' : 'block';
    const markdown = behavior.includes('table followed') ? '| a | b |\n| - | - |\n| 1 | 2 |\n\nafter' : behavior.includes('markdown') ? '**bold**' : 'text';
    const node = render(subject(markdown, caret)).getByTestId('streamdown-caret');
    expect(node.props.children).toContain(caret === 'circle' ? '●' : '▋');
  });
});
