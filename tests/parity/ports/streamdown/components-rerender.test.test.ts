import React from 'react';
import { render } from '@testing-library/react-native';
import { Streamdown, createStreamingInstrumentation } from '../../../../src';
import { classifyStreamUpdate } from '../../../../src/core/streaming';

const CASES: ReadonlyArray<readonly [string, string, ('active' | 'stable')?]> = [
  ['parity:3f00dc21204dc8c5baf943a817f513a88503dd4a5537b8a1498634ff0eb84465', '1. ordered'],
  ['parity:a593f1c50a55ab73c4722f4a48cea998921e89d752d515ef2e2318b3b2ca5a4e', '- item'],
  ['parity:840694b862bacc89aba2cc798dce47a562196c8c7a0269c9d234cda8ebd711d4', '- unordered'],
  ['parity:3a58f12b44ee857fb7c564d88d0d3862dd78fec5e5c37dcb66460b806da21a0e', '---'],
  ['parity:d04304617d932880819c122a2b9def9e909956159be7c149395f0569d6d877cf', '**strong**'],
  ['parity:7a21dea98f966f4189cc6075d87e040eb4ba85db1512ddfd7e059d9187fcdeb6', '[link](https://example.com)'],
  ['parity:a2129541f0120a74e301f46e8be8c70f870aa16a4535a43c9a37f4e7606ae166', '# heading'],
  ['parity:c2ba274a1e3ff9f5109e16bfb4291d096bdfb6c681400da48e15b1bb3e059c2c', '| a |\n| - |\n| b |'],
  ['parity:646eb1c373d736ce398b954ba6060fd0f22ccb8fa0e7eb2c7c2344f2f6053b5b', '| head |\n| - |\n| cell |'],
  ['parity:d0169bca12d4cffe75c4fe8086d623b8a9129a9b6dcd8ee94f65ac33ec26eafd', '> quote'],
  ['parity:407287ad683246f6a8079d9bde7b8f61434c5e001fe637d0cc2c88c9e3e7a60e', 'ref[^n]\n\n[^n]: note', 'active'],
  ['parity:65cd303154e80f5d4a86e8176297ca307a8a155ef67be7c1c89f20fc34b36cd1', '`inline`'],
  ['parity:7859d2b5ef6c8d2261180795b69d31bec6ec1323dc40b915d350a07a3132d1c5', '![alt](https://example.com/a.png)'],
  ['parity:6bcd409b176abc9b7d612ef4dd2dc3c0ed9d239a413c7ad4b1a679aea613e8e0', 'paragraph'],
  ['parity:1a1cf57c35f31209c4d7bd9b928295de82eb154ea34dbe3cacde6a4946d58f8e', 'section'],
];

describe('native renderer prop-aware memoization', () => {
  it.each(CASES)('%s updates %s without stale stable blocks', (marker, markdown, renderKind = 'stable') => {
    expect(marker).toMatch(/^parity:[a-f0-9]{64}$/);
    const metrics = createStreamingInstrumentation();
    const children = `${markdown}\n\nactive`;
    const screen = render(React.createElement(Streamdown, { instrumentation: metrics, theme: 'dark' }, children));
    const before = metrics.snapshot();
    screen.rerender(React.createElement(Streamdown, { instrumentation: metrics, theme: 'light' }, children));
    const after = metrics.snapshot();
    if (renderKind === 'active') {
      expect(after.activeRenders).toBeGreaterThan(before.activeRenders);
    } else {
      expect(after.stableRenders).toBeGreaterThan(before.stableRenders);
    }
  });

  it('resets when source positions cannot be preserved', () => {
    expect(classifyStreamUpdate('same prefix old', 'same prefix new').kind).toBe('reset');
  });
  // parity:e051d11977a1613be553d60d08b8e67a1a3bcbb281563f7f4c867997444f2791
  it('treats native stream-position compatibility asymmetrically', () => {
    expect(classifyStreamUpdate('same prefix', 'same prefix appended').kind).toBe('append');
    expect(classifyStreamUpdate('same prefix appended', 'same prefix').kind).toBe('reset');
  });

  // parity:c3fe4bdaebc2c362412e7f5cc78aedfda2e7bdbab52483a5c52e9db23d09bc57
  it('renders block code directly without a paragraph wrapper contract', () => {
    expect(render(React.createElement(Streamdown, { mode: 'static' }, '```\ncode\n```')).getByText('code')).toBeTruthy();
  });
});
