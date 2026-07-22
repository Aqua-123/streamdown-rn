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
import { parseMarkdown } from '../core/parser';
import { materializeCustomTags } from '../renderers/semanticTags';
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
    const nested = preprocessCustomTags('<box><box>A\n\nB</box></box>', ['box']);
    expect(nested).toContain('<!---->');
    expect(nested.match(/<\/box>/g)).toHaveLength(2);
    const materialized = materializeCustomTags(
      parseMarkdown(nested),
      { box: [] }
    );
    expect(JSON.stringify(materialized).match(/"type":"customTag"/g)).toHaveLength(2);
    expect(JSON.stringify(materialized)).not.toContain('"value":"</box>"');
    expect(preprocessLiteralTagContent('<mention>_a_|*b*\n\nc</mention>', ['mention'])).toBe(
      '<mention>\\_a\\_\\|\\*b\\*&#10;&#10;c</mention>'
    );
    expect(preprocessCustomTags('<box>unterminated', ['box'])).toBe('<box>unterminated');
  });

  it('leaves raw HTML comments opaque to custom and literal preprocessing', () => {
    const comment = '<!-- <box>hidden\n\ntext</box> <mention>_raw_</mention> -->';
    expect(preprocessCustomTags(comment, ['box'])).toBe(comment);
    expect(preprocessLiteralTagContent(comment, ['mention'])).toBe(comment);

    const wrapped = `<box>A\n\n${comment}\n\nB</box>`;
    const output = preprocessCustomTags(wrapped, ['box']);
    expect(output).toContain(comment);
    expect(output.match(/<!---->/g)).toHaveLength(2);
  });

  it('does not preprocess tag-looking text inside inline or fenced code', () => {
    const inline = '`<box>A\n\nB</box>` <box>C\n\nD</box>';
    expect(preprocessCustomTags(inline, ['box'])).toBe(
      '`<box>A\n\nB</box>` <box>\nC\n<!---->\nD\n</box>\n\n'
    );
    expect(preprocessLiteralTagContent('`<mention>_code_</mention>` <mention>_text_</mention>', ['mention']))
      .toBe('`<mention>_code_</mention>` <mention>\\_text\\_</mention>');

    for (const fence of ['```md\n<box>A\n\nB</box>\n```', '~~~md\n<box>A\n\nB</box>\n~~~']) {
      expect(preprocessCustomTags(fence, ['box'])).toBe(fence);
      expect(preprocessLiteralTagContent(fence, ['box'])).toBe(fence);
    }
  });

  it('protects indented code and rejects invalid backtick fence info strings', () => {
    for (const indent of ['    ', '\t']) {
      const code = `${indent}<box>A\n${indent}\n${indent}B</box>`;
      expect(preprocessCustomTags(code, ['box'])).toBe(code);
      expect(preprocessLiteralTagContent(`${indent}<box>_A_</box>`, ['box']))
        .toBe(`${indent}<box>_A_</box>`);
    }

    const invalidFence = '```md`invalid\n<box>A\n\nB</box>\n```';
    expect(preprocessCustomTags(invalidFence, ['box'])).toContain('<!---->');
    expect(preprocessLiteralTagContent(
      '```md`invalid\n<box>_A_</box>\n```',
      ['box']
    )).toContain('<box>\\_A\\_</box>');
  });

  it('scales near-linearly across many declared literal ranges', () => {
    const run = (count: number) => {
      const input = '<tag>`value`</tag> '.repeat(count);
      const start = performance.now();
      const output = preprocessLiteralTagContent(input, ['tag']);
      expect(output).toContain('<tag>\\`value\\`</tag>');
      return performance.now() - start;
    };

    run(500);
    const small = run(2_000);
    const large = run(8_000);
    expect(large).toBeLessThanOrEqual(small * 10 + 100);
  });

  it('scales linearly for 512 KiB of unmatched declared openings', () => {
    const run = (bytes: number) => {
      const input = '<box>x'.repeat(Math.ceil(bytes / 6)).slice(0, bytes);
      const start = performance.now();
      expect(preprocessCustomTags(input, ['box'])).toBe(input);
      return performance.now() - start;
    };

    run(64 * 1024);
    const small = run(256 * 1024);
    const large = run(512 * 1024);
    expect(large).toBeLessThanOrEqual(small * 4 + 100);
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
