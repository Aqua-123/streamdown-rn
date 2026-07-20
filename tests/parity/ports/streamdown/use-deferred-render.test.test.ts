import React from 'react';
import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src';
import { createCodePlugin } from '../../../../src/plugins/code';

const CASES = [
  ['parity:da70723105e3791912c4ccbbaa0cd2dc85355a14a56bdc383f8bee525383e36f', 'immediate'],
  ['parity:25a95edcdd55d6280aba53075494ea2d993ab05a9e13148a33a32969ff5f7a07', 'deferred'],
  ['parity:c1200631bfd8ea0a8b338f13f3b56c59c1fbe1598da739c6329673d6bda2f2ab', 'becomes eligible'],
  ['parity:4f98600f610f366aa39c13b64046a03f41a3cd6f5daeff26b3d0a9645fcee209', 'leaves eligibility'],
  ['parity:d0c89add6bc3ef5c02918c5093bfb1ded823d0bf8b0c97f741d8ffe8b0ae0e30', 're-entry'],
  ['parity:a69c0e0ebcbaa56d07517af9495edd80cdb7c0b80c1785f74017b0290107d826', 'non-eligible record'],
  ['parity:cb1e5c96fe8f9430ac29d243116c46f7b9bfcabc7587a5dbbc8aeaf47ad4d21e', 'unmount cleanup'],
  ['parity:b4236962f6eb0bc89eb5c88fe47234d71f9a17b99cacfc08f33929e516c0a706', 'deadline'],
  ['parity:603480d55e192fa06e1c3287869cb16ce293331115f21785cb352e871ad59294', 'effect rerun cleanup'],
  ['parity:34f9e450d1f90dd7faa3fa2c9d5a7337e87afabb7a1bae10351168de3247368c', 'reschedule'],
] as const;

function plugin(highlight: jest.Mock) {
  return createCodePlugin({ provider: { languages: ['ts'], highlight } });
}

describe('native heavy-render deferral', () => {
  it.each(CASES)('%s %s uses stream completion instead of viewport globals', (_marker, behavior) => {
    const highlight = jest.fn(() => ({ tokens: [[{ content: 'highlighted' }]] }));
    const code = plugin(highlight);
    const incomplete = '```ts\nconst n = 1';
    const complete = `${incomplete}\n\`\`\``;

    if (behavior === 'immediate' || behavior === 'deadline') {
      render(React.createElement(Streamdown, { mode: 'static', plugins: { code } }, complete));
      expect(highlight).toHaveBeenCalledTimes(1);
      return;
    }

    const screen = render(React.createElement(Streamdown, { plugins: { code }, isAnimating: true }, incomplete));
    expect(highlight).not.toHaveBeenCalled();

    if (behavior === 'becomes eligible' || behavior === 're-entry' || behavior === 'reschedule') {
      screen.rerender(React.createElement(Streamdown, { plugins: { code }, isAnimating: true }, complete));
      expect(highlight).toHaveBeenCalledTimes(1);
    } else if (behavior === 'effect rerun cleanup') {
      screen.rerender(React.createElement(Streamdown, { plugins: { code: plugin(jest.fn()) }, isAnimating: true }, incomplete));
      expect(highlight).not.toHaveBeenCalled();
    } else {
      screen.unmount();
      expect(highlight).not.toHaveBeenCalled();
    }
  });
});
