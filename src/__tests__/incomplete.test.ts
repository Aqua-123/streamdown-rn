import remend from 'remend';
import {
  fixIncompleteMarkdown,
  INITIAL_INCOMPLETE_STATE,
  updateTagState,
} from '../core/incomplete';

describe('incomplete markdown compatibility state', () => {
  it('tracks formatting and ignores markers inside fenced code', () => {
    expect(updateTagState(INITIAL_INCOMPLETE_STATE, '**bold').stack.map((tag) => tag.type)).toEqual([
      'bold',
    ]);
    expect(updateTagState(INITIAL_INCOMPLETE_STATE, '**bold**').stack).toEqual([]);
    const code = updateTagState(INITIAL_INCOMPLETE_STATE, '```\n**literal**');
    expect(code.inCodeBlock).toBe(true);
    expect(code.stack.map((tag) => tag.type)).toEqual(['codeBlock']);
  });

  it('returns the identical state for an empty append and rebuilds after replacement', () => {
    const state = updateTagState(INITIAL_INCOMPLETE_STATE, '**open');
    expect(updateTagState(state, '**open')).toBe(state);
    expect(updateTagState(state, 'plain').stack).toEqual([]);
  });
});

describe('published Remend repair boundary', () => {
  const cases = [
    '**bold',
    '*italic',
    '~~strike',
    '`code',
    '[label](url',
    '![alt](url',
    '$$x = 1',
    '<unfinished',
    '1. item\n2',
    '```ts\nconst x = 1',
  ];

  it.each(cases)('delegates %p exactly to remend@1.3.0', (source) => {
    const state = updateTagState(INITIAL_INCOMPLETE_STATE, source);
    expect(fixIncompleteMarkdown(source, state)).toBe(remend(source));
  });
});
