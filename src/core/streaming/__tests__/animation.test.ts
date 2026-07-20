import { classifyStreamUpdate, getAnimationWindow, normalizeAnimationConfig } from '..';

describe('streaming primitives', () => {
  it('classifies append, identity, and every replacement shape', () => {
    expect(classifyStreamUpdate('abc', 'abcd')).toMatchObject({ kind: 'append', from: 3 });
    expect(classifyStreamUpdate('abc', 'abc')).toMatchObject({ kind: 'identity' });
    expect(classifyStreamUpdate('abcdef', 'abc')).toMatchObject({ kind: 'reset' });
    expect(classifyStreamUpdate('abcdef', 'abcXYZ')).toMatchObject({ kind: 'reset' });
    expect(classifyStreamUpdate('abcdef', 'other')).toMatchObject({ kind: 'reset' });
  });

  it('disables animation under reduced motion and preserves value-equivalent config', () => {
    expect(getAnimationWindow('AB', 'ABCD', true, false)).toEqual({ from: 2, to: 4 });
    expect(getAnimationWindow('AB', 'ABCD', true, true)).toBeNull();
    expect(normalizeAnimationConfig({ duration: 200 })).toEqual(normalizeAnimationConfig({ duration: 200 }));
  });
});
