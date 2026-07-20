import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { hasIncompleteCodeFence, hasTable } from '../../../../src/core/blockSemantics';
import { createRendererPlugin } from '../../../../src/plugins/renderers';

describe('hasIncompleteCodeFence native parity', () => {
  it('detects incomplete backtick fences', () => {
    // parity:5858d8d032b01994b79f2d2173f8ab9bd32d8c9008bf1707e20d876514f5da49
    expect(['```javascript\nconst x = 1;', '```\ncode here', 'Some text\n```python\ndef hello():'].every(hasIncompleteCodeFence)).toBe(true);
  });
  it('detects incomplete tilde fences', () => {
    // parity:0460958f9371ecf34f5f1fbfe6ded9caeb9d1377c3c09231c84901c21cdee50a
    expect(['~~~javascript\nconst x = 1;', '~~~\ncode here', 'Some text\n~~~python\ndef hello():'].every(hasIncompleteCodeFence)).toBe(true);
  });
  it('accepts complete backtick fences and prose', () => {
    // parity:6eb1c216e7778d65c6ec3109a10888ae5ddd89879c5f0bd4b8262414f099dcd0
    expect(['```javascript\nconst x = 1;\n```', '```\ncode\n```', 'No code fence here'].some(hasIncompleteCodeFence)).toBe(false);
  });
  it('accepts complete tilde fences', () => {
    // parity:c9aaf9964702f753483ec2c148f220ed140d5541844dc19b2266ae4a48d7a3f5
    expect(['~~~javascript\nconst x = 1;\n~~~', '~~~\ncode\n~~~'].some(hasIncompleteCodeFence)).toBe(false);
  });
  it('accepts multiple complete backtick blocks', () => {
    // parity:c6d7fadf2b34f73d31bdbed1556401b0e36b581e89d66317a90b1ed6986c4c98
    expect(hasIncompleteCodeFence('```js\ncode1\n```\n\n```python\ncode2\n```')).toBe(false);
  });
  it('accepts multiple complete tilde blocks', () => {
    // parity:71d4205e19769077374fda322a56e6f02b74e10cfacec85d204433421d7ddec4
    expect(hasIncompleteCodeFence('~~~js\ncode1\n~~~\n\n~~~python\ncode2\n~~~')).toBe(false);
  });
  it('detects a complete block followed by an incomplete block', () => {
    // parity:513f9641194e63730c844a231ccf801dca9d723bdbf4478b34ed84f048ec7fcb
    expect(hasIncompleteCodeFence('```js\ncode1\n```\n\n```python\ncode2')).toBe(true);
  });
  it('detects an incomplete tilde after a complete backtick block', () => {
    // parity:2a927180abc4ae7ca2cca03a65b9a62ca85b4f2744885c623e994c20167df5e8
    expect(hasIncompleteCodeFence('```js\ncode1\n```\n\n~~~python\ncode2')).toBe(true);
  });
  it('accepts mixed complete fences', () => {
    // parity:164c532a76354a08af77b2a3d3f15503f7a5c4250cb45d58929da5ac69f53b45
    expect(hasIncompleteCodeFence('```js\ncode1\n```\n\n~~~python\ncode2\n~~~')).toBe(false);
  });
  it('requires a six-backtick opener to have an equally long closer', () => {
    // parity:7b48a9ab38bd568f59e89260349b5b75cbb045f985d98819817e34dde78bf43d
    expect(hasIncompleteCodeFence('``````\ncode here')).toBe(true);
    expect(hasIncompleteCodeFence('``````\ncode\n``````')).toBe(false);
    expect(hasIncompleteCodeFence('``````\ncode\n```')).toBe(true);
  });
  it('accepts closing fences at least as long as a four-backtick opener', () => {
    // parity:9488484a67409d093f158e74f0bfdec4f60d83b6fb256d542d44ae4a425b6ade
    expect(hasIncompleteCodeFence('````\ncode')).toBe(true);
    expect(hasIncompleteCodeFence('````\ncode\n`````')).toBe(false);
    expect(hasIncompleteCodeFence('````\ncode\n```')).toBe(true);
  });
  it('ignores inline backtick runs in prose', () => {
    // parity:dc12876ee5b738d759d9d208a3f6658027a8807eb922b98f48cd2454e1237cea
    expect(hasIncompleteCodeFence('Use ``` to start a code fence')).toBe(false);
    expect(hasIncompleteCodeFence('The syntax is ``` for code blocks')).toBe(false);
  });
  it('allows up to three indentation spaces', () => {
    // parity:d893b3bf3ca4b5baf5b7419247390aa92648807c8645ee9c541935519bd4fc84
    expect(hasIncompleteCodeFence('   ```\ncode')).toBe(true);
    expect(hasIncompleteCodeFence('   ```\ncode\n   ```')).toBe(false);
    expect(hasIncompleteCodeFence('    ```\ncode')).toBe(false);
  });
  it('requires the closing fence character to match', () => {
    // parity:a54bb64ac9366bebad710a644e0547428caaec4885336cfd124059693f2b94ec
    expect(hasIncompleteCodeFence('```\ncode\n~~~')).toBe(true);
    expect(hasIncompleteCodeFence('~~~\ncode\n```')).toBe(true);
  });
});

describe('hasTable native parity', () => {
  it('detects a basic GFM table', () => {
    // parity:65ca2cc853b50cc5e7343050a00eeaa8673f367b741733901e2de4040328d7e8
    expect(hasTable('| Name | Age |\n| --- | --- |\n| Alice | 30 |')).toBe(true);
  });
  it('detects alignment markers', () => {
    // parity:94401b7aff0389fe2240482de84d38eea1474e347b9355306a32f33e85df0a26
    expect(hasTable('| Left | Center | Right |\n| :--- | :---: | ---: |')).toBe(true);
  });
  it('detects a streamed delimiter row', () => {
    // parity:20fe38cb6840bc2f39229a3a1bbb3f71b5367ceb9da1e51643db28e410f922c8
    expect(hasTable('| Header |\n| --- |')).toBe(true);
  });
  it('detects tables without leading pipes', () => {
    // parity:773860e5c94a18fb4045367f89da0a4efb2d628923f0217b495fcdccd6f5f2bc
    expect(hasTable('Name | Age\n--- | ---\nAlice | 30')).toBe(true);
  });
  it('rejects regular text', () => {
    // parity:6a98cb18169ef0516f0274957baf1143a2a95f0eaa54ed5d678da04ae639409c
    expect(hasTable('Just some regular text')).toBe(false);
  });
  it('rejects headings with dashes', () => {
    // parity:ab0402cc45ef40dbf35dbf7e60ffbeb3b0912f7e23bf3145fa16fe5412c76de3
    expect(hasTable('# My Heading\n\nSome text')).toBe(false);
  });
  it('rejects horizontal rules', () => {
    // parity:e81c0ec72a79ef50b82aa4d0823e44fe08551fe45220008d7c830dd42335a700
    expect(hasTable('Some text\n\n---\n\nMore text')).toBe(false);
  });
  it('rejects empty input', () => {
    // parity:dda22f77d83157462e201eff8718b4b4387239f156d83f5991a14232b570e3f0
    expect(hasTable('')).toBe(false);
  });
  it('detects a table inside mixed content', () => {
    // parity:4a4e11cca88125a33c5d5b2092fcd8348d60f8841e3f1871fe2c73e034fa5dae
    expect(hasTable('Some intro text\n\n| Col |\n| --- |\n| Val |')).toBe(true);
  });
});

const captureIncomplete = (markdown: string, props: { isAnimating?: boolean; mode?: 'static' | 'streaming' } = {}) => {
  const values: boolean[] = [];
  const Capture = ({ code, isIncomplete }: { code: string; isIncomplete: boolean }) => {
    values.push(isIncomplete);
    return React.createElement(Text, null, code);
  };
  render(
    React.createElement(Streamdown, {
      ...props,
      plugins: { renderers: createRendererPlugin([{ language: ['javascript', 'python'], component: Capture }]) },
      children: markdown,
    })
  );
  return values;
};

describe('incomplete-code context native parity', () => {
  it('exposes true to a custom renderer while streaming an incomplete fence', () => {
    // parity:8fc23bf38abee3e268c75e6e088b6c6938109ad926675063efe28b52aff49ab2
    expect(captureIncomplete('```javascript\nconst x = 1;', { isAnimating: true })).toContain(true);
  });
  it('exposes false when the fence is complete', () => {
    // parity:fa538c1b99df47874b3b52e8e8bdd9ad418b8b102b95d3fbcd732b65740eb919
    expect(captureIncomplete('```javascript\nconst x = 1;\n```', { isAnimating: true })).not.toContain(true);
  });
  it('exposes false when animation is inactive', () => {
    // parity:11788724fcca122780f22fac03e1042ba507133e79c6479797942c91d6f11a62
    expect(captureIncomplete('```javascript\nconst x = 1;', { isAnimating: false })).not.toContain(true);
  });
  it('marks an unclosed active code block incomplete', () => {
    // parity:f0bc3b4cd17ef2f1489e0c2c3d50411909b07c4dee1669ff1d19fb79b169b4fb
    expect(captureIncomplete('```javascript\nconst x = 1;', { isAnimating: true })).toContain(true);
  });
  it('does not mark a closed active code block incomplete', () => {
    // parity:5e45f334566816cdeafeb697d8f164f938662eb0ef4c6c9134818fa8ea78cc00
    expect(captureIncomplete('```javascript\nconst x = 1;\n```', { isAnimating: true })).not.toContain(true);
  });
  it('does not mark code incomplete outside active streaming', () => {
    // parity:330ff6ac8ed47b2901a78e78b3fd88c227c18747426d169929a09bbc2212e1dd
    expect(captureIncomplete('```javascript\nconst x = 1;', { isAnimating: false })).not.toContain(true);
  });
  it('does not mark code incomplete in static mode', () => {
    // parity:43c4ca3c5d2ddf221c701bd94bc524041843b37b71ffd03eb997a0cdb33387e8
    expect(captureIncomplete('```javascript\nconst x = 1;', { isAnimating: true, mode: 'static' })).not.toContain(true);
  });
  it('marks only the final incomplete code block', () => {
    // parity:08c5e71af104d2ee864cfd11a6a14775dfda53478fae742afa0ac4c3197ece0c
    expect(captureIncomplete('```python\npass\n```\n\nText\n\n```javascript\nconst incomplete', { isAnimating: true })).toEqual([false, true]);
  });
  it('lets custom renderers branch on incomplete state', () => {
    // parity:4b8377cbf573d7537797ed3f4e2b1d14ef31ca4d6952d2050961103724d01055
    const Custom = ({ isIncomplete }: { isIncomplete: boolean }) => React.createElement(Text, { testID: 'loading' }, isIncomplete ? 'Loading code' : 'Ready');
    render(React.createElement(Streamdown, {
      isAnimating: true,
      plugins: { renderers: createRendererPlugin([{ language: 'javascript', component: Custom }]) },
      children: '```javascript\nconst x = 1;',
    }));
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading code');
  });
  it('gives custom renderers false for complete code', () => {
    // parity:45420c74b166b1c821a26f5ff1b8aed6645a73669dd0147c5b6b33fd278dfee0
    expect(captureIncomplete('```javascript\nconst x = 1;\n```', { isAnimating: true })).not.toContain(true);
  });
  it('exports the native Streamdown block owner', () => {
    // parity:b4ee7c1be7a316ffbf2cf1d923892cb3a28dc7f2c61b144a346cee8a04598201
    expect(Streamdown).toBeDefined();
    expect(typeof Streamdown).toBe('object');
  });
  it('exports the custom-renderer context seam used for incomplete state', () => {
    // parity:61ea708f4f12b65acdc72125cf3ec229713b6819533e2938cf8d10a01f316c53
    expect(createRendererPlugin).toBeDefined();
    expect(typeof createRendererPlugin).toBe('function');
  });
});
