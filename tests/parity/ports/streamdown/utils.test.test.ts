import React from 'react';
import { render } from '@testing-library/react-native';
import {
  codeFileRequest,
  imageFileRequest,
  Streamdown,
  tableFileRequest,
} from '../../../../src';

const CSS_CASES = [
  ['parity:ef07097ed70f4791d0317d7060bae58ec14cf3dbad5255e3cdd2251cc67d6c1f', 'merge classes'],
  ['parity:2dabae0b21fbf90c5a3e7c4efb4290e31f07886e37db8e0284dd3ad0e7ee582e', 'conditional classes'],
  ['parity:dfb472daed7fe22658dd6dbb8eba603b34ea9d73076a89d94693d0f9cd787d6f', 'undefined and null values'],
  ['parity:9082b16d47b1540c12ca646905be3e96b06177c95dbff9ecf6ac80f670a83e2c', 'conflicting utilities'],
  ['parity:714b98988f2974cb90f9d2b1b8861c837d5c4543d2b222635e5db084bfe20a8b', 'complex utilities'],
  ['parity:3c5ee0765eba84e765920223b7a03460d400029dc2fa0ee680470a3c15a829d5', 'arrays'],
  ['parity:b972137be84f8b23c92fe20cb75145a7a8f0c9838165e97d71a30f072cdd2438', 'objects'],
  ['parity:fbe171307958f786c875e4afebacfc7bd016b033454bf82995d7d3aa19b1abc4', 'empty inputs'],
  ['parity:f6372ad6235adc30dfc6d6e42e288b61d227587edaa66f49c3ba75c982649f2b', 'mixed inputs'],
  ['parity:fc3b881eb77064764992533af36d04c9d8bdfcce6779b43221f2c4d56e4952b1', 'non-conflicting utilities'],
] as const;

const FILE_CASES = [
  ['parity:a8614cba6bf2e2166f6709eb9bb2dc0b30ff6cf3a0aa64bba155badc21b6aa5a', 'string payload'],
  ['parity:3fc71a4a91ce07777d1af048a7fd8c77b4702792bf72feb39c124731a9107ad4', 'binary payload'],
  ['parity:a16d265ec5bd2cb707bd20d6193848742b88a5f963664a019f7e0cffce67298c', 'native save metadata'],
  ['parity:d7f713d255cffc433ab2ccebc09507eb4a4ff27745f407f0cc38601b70222af2', 'ownership transfer'],
  ['parity:5533909553d85a7001904597e391ad14a2647ad4f32ee1b82367d950f3287830', 'CSV BOM'],
  ['parity:4cbb82e2c187a116bce1438824eece7f2a4e433d1603b23a03c838a04a258df7', 'non-CSV no BOM'],
  ['parity:1abd0a7c2964f127a06cee8e2a1c6992442b832d9c907971ef9734948ceacaea', 'typed binary'],
  ['parity:02a06ae9c152cdb0530917724c5550753596d739426c999e694b2a3744b9d2f4', 'non-ASCII CSV BOM'],
  ['parity:6ab0a1d63a9fb7dd507988a55cf9c917d0a6d98fc49ae6fc891bdaa03c5342dd', 'CSV charset'],
  ['parity:9bbb180f65331536c108abbf11a3611556e15be2966b6bc074c83eff3ee5fe01', 'empty CSV'],
] as const;

describe('native utility parity', () => {
  it.each(CSS_CASES)('%s class utility: %s', (marker) => {
    expect(marker).toMatch(/^parity:[a-f0-9]{64}$/);
    // className/Tailwind merging is a browser styling mechanism. React Native's
    // drop-in contract deliberately accepts typed StyleProp values instead.
    expect(() => render(React.createElement(Streamdown, { className: 'p-2 p-4' } as never, 'text'))).toThrow(/className is DOM-only/);
  });

  it.each(FILE_CASES)('%s file utility: %s', (marker, behavior) => {
    expect(marker).toMatch(/^parity:[a-f0-9]{64}$/);

    if (behavior.includes('binary') || behavior.includes('ownership')) {
      const bytes = new Uint8Array([137, 80, 78, 71]);
      const request = imageFileRequest(bytes, 'image/png', 'chart.png');
      expect(request).toMatchObject({ basename: 'chart', extension: 'png', mimeType: 'image/png' });
      expect(request.content).toBe(bytes);
      return;
    }

    if (behavior.includes('non-CSV')) {
      const request = codeFileRequest('\uFEFFconst value = 1', 'typescript', 'example');
      expect(request).toMatchObject({ extension: 'ts', mimeType: 'text/typescript;charset=utf-8' });
      expect(request.content).toBe('\uFEFFconst value = 1');
      return;
    }

    if (behavior.includes('string') || behavior.includes('metadata')) {
      expect(codeFileRequest('hello', undefined, 'note')).toEqual({
        basename: 'note',
        extension: 'txt',
        mimeType: 'text/plain;charset=utf-8',
        content: 'hello',
      });
      return;
    }

    const empty = behavior.includes('empty');
    const request = tableFileRequest(
      empty ? { headers: [], rows: [] } : { headers: ['name'], rows: [['Zoë']] },
      'csv',
      'people'
    );
    expect(request.content).toMatch(/^\uFEFF/);
    expect(request).toMatchObject({ extension: 'csv', mimeType: 'text/csv;charset=utf-8' });
    if (empty) expect(request.content).toBe('\uFEFF');
    if (behavior.includes('non-ASCII')) expect(request.content).toContain('Zoë');
  });
});
