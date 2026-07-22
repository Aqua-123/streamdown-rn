import { classifyStreamUpdate, getAnimationWindow, getAnimationWindowFrom, normalizeAnimationConfig } from '..';

describe('streaming primitives', () => {
  it('classifies append, identity, and every replacement shape', () => {
    expect(classifyStreamUpdate('abc', 'abcd')).toMatchObject({ kind: 'append', from: 3 });
    expect(classifyStreamUpdate('abc', 'abc')).toMatchObject({ kind: 'identity' });
    expect(classifyStreamUpdate('abcdef', 'abc')).toMatchObject({ kind: 'reset' });
    expect(classifyStreamUpdate('abcdef', 'abcXYZ')).toMatchObject({ kind: 'reset' });
    expect(classifyStreamUpdate('abcdef', 'other')).toMatchObject({ kind: 'reset' });
    expect(classifyStreamUpdate('abc', 'replacement', true)).toMatchObject({ kind: 'append', from: 3 });
  });

  it('disables animation under reduced motion and preserves value-equivalent config', () => {
    expect(getAnimationWindow('AB', 'ABCD', true, false)).toEqual({ from: 2, to: 4 });
    expect(getAnimationWindowFrom(2, 4, true, false)).toEqual({ from: 2, to: 4 });
    expect(getAnimationWindow('AB', 'ABCD', true, true)).toBeNull();
    expect(normalizeAnimationConfig({ duration: 200 })).toEqual(normalizeAnimationConfig({ duration: 200 }));
    expect(normalizeAnimationConfig({ duration: Number.NaN, stagger: Number.POSITIVE_INFINITY })).toMatchObject({ duration: 160, stagger: 40 });
  });
});
