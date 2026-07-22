import { clampToGraphemeBoundary, segmentAnimationText } from '../streamingTextModel';

describe('native streaming text segmentation', () => {
  it('keeps Unicode graphemes intact and excludes whitespace', () => {
    expect(segmentAnimationText('A 👨‍👩‍👧‍👦 e\u0301', 'char').map(({ start, end }) => 'A 👨‍👩‍👧‍👦 e\u0301'.slice(start, end)))
      .toEqual(['A', '👨‍👩‍👧‍👦', 'é']);
    expect(segmentAnimationText('one  two', 'word')).toEqual([
      { start: 0, end: 3 },
      { start: 5, end: 8 },
    ]);
  });

  it('moves an append boundary to the start of an incomplete grapheme', () => {
    expect(clampToGraphemeBoundary('e\u0301', 1)).toBe(0);
    expect(clampToGraphemeBoundary('👨‍👩‍👧‍👦', 2)).toBe(0);
    expect(clampToGraphemeBoundary('ab', 1)).toBe(1);
  });
});
