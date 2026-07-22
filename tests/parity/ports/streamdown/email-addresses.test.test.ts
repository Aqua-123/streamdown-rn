import { renderedText } from './native-cluster-helpers';

describe('email address preservation', () => {
  it.each([
    /* parity:6c243879ab3e1c3643f4084097390d663de5e6a446875ef569e5cf112962431b */ ['example@gmail.com', true],
    /* parity:4a78ca5cce03f37373ec662d477656547b3d24d4ecbcd72b15a26bd94e50651e */ ['Please contact me at john.doe@example.com for more info', true],
    /* parity:a32ecc9eb7e2a2ea501d0f5a6f2ef04a4b1453f402637af484aeb0752b35a20d */ ['Contact admin@site.com or support@site.com', true],
    /* parity:cf1f19e0d54b1d021d97a3e95a398b7d92bddbcc55c98289373c000b1e049eb3 */ ['user+test@example-domain.co.uk', true],
    ['example@gmail.com', false],
  ])('preserves %s with incomplete repair=%s', (content, parseIncompleteMarkdown) => {
    expect(renderedText(content, { parseIncompleteMarkdown })).toBe(content);
  });

  // parity:e52aac7fc8188a2b223c00d00ee3f52bcb1cd110297a0c0835c363853e3484ec
  it('preserves an email sentence when parseIncompleteMarkdown is disabled', () => {
    expect(renderedText('Please contact me at john.doe@example.com for more info', { parseIncompleteMarkdown: false }))
      .toBe('Please contact me at john.doe@example.com for more info');
  });
});

/* pinned parity markers
 *  — Email Addresses (#160) > should handle email addresses with parseIncompleteMarkdown disabled
 */
