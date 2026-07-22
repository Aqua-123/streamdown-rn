import {
  detectTextDirection,
  hasIncompleteCodeFence,
  hasTable,
  partitionMarkdown,
} from '../core/blockSemantics';
import {
  preprocessCustomTags,
  preprocessLiteralTagContent,
} from '../core/preprocessTags';
import {
  tableDataToCSV,
  tableDataToMarkdown,
  tableDataToTSV,
} from '../core/tableSerialization';

describe('portable block semantics', () => {
  it('detects incomplete backtick and tilde fences by matching character and length', () => {
    expect(hasIncompleteCodeFence('````js\ncode\n```')).toBe(true);
    expect(hasIncompleteCodeFence('````js\ncode\n````')).toBe(false);
    expect(hasIncompleteCodeFence('~~~\ncode\n~~~')).toBe(false);
    expect(hasIncompleteCodeFence('inline ``` only')).toBe(false);
    expect(hasIncompleteCodeFence('```js\ncode\n```not-a-close')).toBe(true);
    expect(hasIncompleteCodeFence('```js\ncode\n   ```  ')).toBe(false);
  });

  it('detects a GFM table only from a pipe delimiter row', () => {
    expect(hasTable('| a | b |\n| :- | -: |')).toBe(true);
    expect(hasTable('---')).toBe(false);
  });

  it('keeps footnote documents in one tree and partitions ordinary siblings', () => {
    expect(partitionMarkdown('Text[^a]\n\n[^a]: Note')).toEqual(['Text[^a]\n\n[^a]: Note']);
    expect(partitionMarkdown('# A\n\nB')).toEqual(['# A\n\n', 'B']);
  });

  it('preserves nested custom tags and literal tag text across blank lines', () => {
    expect(preprocessCustomTags('<box><box>A\n\nB</box></box>', ['box'])).toContain('<!---->');
    expect(preprocessLiteralTagContent('<mention>_a_|*b*\n\nc</mention>', ['mention'])).toBe(
      '<mention>\\_a\\_\\|\\*b\\*&#10;&#10;c</mention>'
    );
    expect(preprocessCustomTags('<box>unterminated', ['box'])).toBe('<box>unterminated');
  });

  it('detects first-strong direction after markdown markers', () => {
    expect(detectTextDirection('**مرحبا** world')).toBe('rtl');
    expect(detectTextDirection('[hello](https://example.com) مرحبا')).toBe('ltr');
    expect(detectTextDirection('中文')).toBe('ltr');
  });

  it('serializes table data with format-specific escaping and padding', () => {
    const data = { headers: ['a', 'b'], rows: [['x,y', 'q"z'], ['one']] };
    expect(tableDataToCSV(data)).toBe('a,b\n"x,y","q""z"\none');
    expect(tableDataToTSV({ headers: ['a'], rows: [['x\ty']] })).toBe('a\nx\\ty');
    expect(tableDataToMarkdown(data)).toBe(
      '| a | b |\n| --- | --- |\n| x,y | q"z |\n| one |  |'
    );
    expect(tableDataToCSV({ headers: ['=formula'], rows: [['@value']] })).toBe('"\'=formula"\n"\'@value"');
    expect(tableDataToTSV({ headers: ['=formula'], rows: [['@value']] })).toBe("'=formula\n'@value");
  });
});
