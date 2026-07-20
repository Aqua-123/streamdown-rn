import React from 'react';
import { Streamdown } from '../../../../src';
import { cjk } from '../../../../src/plugins/cjk';
import { parseSemanticDocument } from '../../../../src/core/parser';
import { renderedText, renderNative } from './native-cluster-helpers';

describe('CJK native semantics', () => {
  const pluginProps = { plugins: { cjk } } as const;

  it.each([
    ['**この文は太字になります（This sentence will be bolded）。**続き', ['この文は太字になります', 'This sentence will be bolded']],
    ['**日本語の文章（括弧付き）**続き', ['日本語の文章', '括弧付き']],
    ['*これは斜体のテキストです（括弧付き）。*続き', ['これは斜体のテキストです']],
    ['***重要な情報（詳細）***続き', ['重要な情報', '詳細']],
    ['**这是粗体文字（带括号）。**', ['这是粗体文字', '带括号']],
    ['*这是斜体文字（带括号）。*', ['这是斜体文字']],
    ['**重要提示（Important Notice）：请注意。**', ['重要提示', 'Important Notice', '请注意']],
    ['**이것은 굵은 텍스트입니다（괄호 포함）。**', ['이것은 굵은 텍스트입니다']],
    ['*기울임 텍스트（괄호 포함）。*', ['기울임 텍스트']],
  ])('renders emphasis without leaking markers: %s', (markdown, expected) => {
    const text = renderedText(markdown, pluginProps);
    expected.forEach((value) => expect(text).toContain(value));
    expect(text).not.toMatch(/\*{2,3}/);
  });

  it.each([
    ['~~削除されたテキスト（括弧付き）。~~', '削除されたテキスト'],
    ['~~删除的文字（带括号）。~~', '删除的文字'],
    ['~~취소선 텍스트（괄호）。~~', '취소선 텍스트'],
    ['**重要な**~~削除された（古い）~~**新しい情報。**', '削除された'],
  ])('renders CJK deletion semantics: %s', (markdown, expected) => {
    expect(renderedText(markdown, pluginProps)).toContain(expected);
    expect(JSON.stringify(parseSemanticDocument(markdown, {
      before: cjk.remarkPluginsBefore,
      after: cjk.remarkPluginsAfter,
    }))).toContain('delete');
  });

  it.each([
    ['Japanese punctuation variants', '**テキスト【角括弧】**続き\n\n**文章「引用符」**続き\n\n**内容〈山括弧〉**続き', ['テキスト', '文章', '内容']],
    ['complex Japanese', '# 見出し（タイトル）\n\n**太字のテキスト（説明）。**補足のテキスト。\n\n*斜体のテキスト【補足】。*補足のテキスト。', ['見出し', '太字のテキスト', '斜体のテキスト']],
    ['complex Chinese', '# 标题（主要内容）\n\n**粗体文字（说明）。**\n\n*斜体文字【备注】。*', ['标题', '粗体文字', '斜体文字']],
    ['complex Korean', '# 제목（헤더）\n\n**굵은 글씨（설명）。**\n\n*기울임 글씨【주석】。*', ['제목', '굵은 글씨', '기울임 글씨']],
    ['ordered list', '1. **第一項目（説明）。**\n2. **第二項目【詳細】。**\n3. **第三項目「引用」。**', ['第一項目', '第二項目', '第三項目']],
    ['punctuation-only emphasis', '**（）【】「」**', ['（）【】「」']],
    ['nested emphasis', '**外側（*内側【ネスト】*）。**', ['外側', '内側']],
    ['multiple markers', '**太字（説明）**と*斜体【補足】*と~~削除「古い」~~。', ['太字', '斜体', '削除']],
    ['immediate punctuation', '**テキスト**（説明）', ['テキスト', '説明']],
    ['mixed LTR and CJK', '**This is English（これは日本語）mixed content。**', ['This is English', 'これは日本語']],
    ['Japanese LLM response', '# 回答（詳細な説明）\n\n**重要なポイント（注意事項）：**\n\n1. **データベースの設定（configuration）。**\n2. **APIの認証（authentication）【必須】。**\n\nこれらの手順を**慎重に（carefully）**実行してください。', ['回答', '重要なポイント', 'データベースの設定', '慎重に']],
    ['Chinese LLM response', '# 答案（详细说明）\n\n**重要要点（注意事项）：**\n\n1. **数据库配置（configuration）。**\n2. **API认证（authentication）【必需】。**\n\n请**仔细（carefully）**执行这些步骤。', ['答案', '重要要点', '数据库配置', '仔细']],
  ])('covers upstream %s fixture', (_name, markdown, expected) => {
    const text = renderedText(markdown, pluginProps);
    expected.forEach((value) => expect(text).toContain(value));
    expect(text).not.toMatch(/\*{2,3}|~~/);
  });

  it('preserves CJK in lists, links, code, tables, blockquotes, and real LLM output', () => {
    const markdown = `# 回答（詳細な説明）

- **日本語の項目（括弧付き）。**
- **中文项目（带括号）。**

[**日本語のリンク（説明）**](https://example.com) と \`console.log('こんにちは')\`

| 日本語 | 中文 | 한국어 |
|---|---|---|
| **項目** | **项目** | **항목** |

> **重要引用（注意）。**`;
    const screen = renderNative(markdown, pluginProps);
    const text = renderedText(markdown, pluginProps);
    for (const value of ['回答', '日本語の項目', '中文项目', '日本語のリンク', 'console.log', '項目', '项目', '항목', '重要引用']) {
      expect(text).toContain(value);
    }
    expect(screen.getByRole('link', { name: '日本語のリンク（説明）' })).toBeTruthy();
  });

  it('splits an autolink at CJK punctuation only when the CJK plugin is enabled', () => {
    const markdown = '请访问 https://example.com。谢谢';
    const withPlugin = parseSemanticDocument(markdown, { after: cjk.remarkPluginsAfter });
    const withoutPlugin = parseSemanticDocument(markdown);
    expect(JSON.stringify(withPlugin)).toContain('"url":"https://example.com"');
    expect(JSON.stringify(withPlugin)).toContain('。谢谢');
    expect(JSON.stringify(withoutPlugin)).toContain('"url":"https://example.com。谢谢"');
  });

  it('repairs incomplete CJK emphasis during streaming and updates on append', () => {
    const screen = renderNative('**ストリーミング', { ...pluginProps, mode: 'streaming' });
    expect(screen.getByText(/ストリーミング/)).toBeTruthy();
    screen.rerender(React.createElement(Streamdown, {
      ...pluginProps,
      mode: 'streaming',
      children: '**ストリーミング中（処理中）**',
    }));
    expect(screen.getByText(/処理中/)).toBeTruthy();
  });
});

/* pinned parity markers
 * parity:26bd51e11f1b41b88d413ab240fda719a33d232c85d83fc6dee82d6cbb880980 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Japanese text with emphasis > renders bold text with Japanese parentheses correctly
 * parity:c66ff0bb4ee5b12f6d6fc018a2b477466069367ad51caa562f30ffaa10e7b948 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Japanese text with emphasis > renders bold text with ideographic punctuation marks
 * parity:9630e5d91816d225884068f4988e842163480edd6f999250f2d846675daeb1bc — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Japanese text with emphasis > renders italic text with Japanese punctuation
 * parity:44eca10dd72bfae0c8a61b1b006339b01fb4af2d9c6158ec08d7c2cd6fff605b — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Japanese text with emphasis > renders combined bold and italic with Japanese text
 * parity:c55a80e24d6eb73a0849ebeed9f189b90ed1fbb55d83cd851f4496220c63e1e3 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Japanese text with emphasis > handles complex Japanese markdown
 * parity:8fe0694b72dbd1d2ca05124b5c661b9149cdb2427131d827b9e2279e0cf6e2df — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Chinese text with emphasis > renders bold text with Chinese parentheses correctly
 * parity:0df413ac452f30dff9c35daf431e541952f0d37c9e4428a0fda84c51b64cafdc — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Chinese text with emphasis > renders bold text with various Chinese punctuation
 * parity:64049a59bfa3a7c81306c5a0f01f256259fd9357775bbd94f691e9cd29a5f6c2 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Chinese text with emphasis > renders italic text with Chinese punctuation
 * parity:8f801abf3576513ff726028506bc1c35c5c3867b85ff6d146681589abe3cf975 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Chinese text with emphasis > handles mixed Chinese and English with emphasis
 * parity:137dbb8bfeb0aa8120898188be91daeaa9ad83b3bb31dc0d1e1147cba3805cc0 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Chinese text with emphasis > handles complex Chinese markdown
 * parity:eba5ab00392bb3a74418a5b0ce8cd54e7ceab76fe761eceb4df8fe4dc9169595 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Korean text with emphasis > renders bold text with Korean punctuation correctly
 * parity:ac28421b4811b06810ee23ed669045bb683626fcdd7b510b3a86394dceb3a957 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Korean text with emphasis > renders italic text with Korean punctuation
 * parity:bac61f7c71260a48716deb570b2a7bedfaadbc6d358ae742f52c7a5366fba9ed — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Korean text with emphasis > handles complex Korean markdown
 * parity:439867256536f5631514936f31272dc19e19d82052a0c301f18a32fa6cf56300 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Strikethrough with CJK text > renders strikethrough text with Japanese punctuation
 * parity:ecbf37cd79ba7affed504a5e42a72ce2c40d587000577150fb5c363dca2b2778 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Strikethrough with CJK text > renders strikethrough text with Chinese punctuation
 * parity:aab4458c033c9721bf09d7ec556ee3c4f542a6f3ecea9144d5bdc4462b4dcb2a — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Strikethrough with CJK text > renders strikethrough text with Korean punctuation
 * parity:7ad60d1e72dd004e2a3e928ffd0b6c44ed6fb8d8bdc638a824206d84c9036514 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Strikethrough with CJK text > handles mixed strikethrough and bold in CJK text
 * parity:497b8d0b171bf17e613ef95c18668bb9e4ec20db7742951297b261ec5b48753f — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Lists with CJK text and emphasis > renders unordered lists with CJK emphasis
 * parity:dc7108dcd1dc56240782bf21952558cf8eb78e8719e3d6245387f757c2a5d5e8 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Lists with CJK text and emphasis > renders ordered lists with CJK emphasis
 * parity:4fd778121d860a8564527520b205d2c51a2fc780fcb82627d01fe963ae7f6011 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Links and inline code with CJK text > renders links with CJK emphasis in text
 * parity:0fc32c5c76c6e2b57e76f11f1ce7e76d70972b299a208945b4a6a85266e43095 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Links and inline code with CJK text > splits autolinks at CJK punctuation
 * parity:d873296257a052f41e571d9949274c4e35a6f598e61d92eadcd0b8e2f3468f2d — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Links and inline code with CJK text > keeps default autolink behavior without the CJK boundary plugin
 * parity:8234a263428807e8ff0c1c0724cbab0141b4b99ebbe14f29e700ff0651dff825 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Links and inline code with CJK text > renders inline code near CJK emphasis
 * parity:ca5cd5c8e9574cae81e8679b26a9055a9a920ab4f15d88ac437df0d2d772cd64 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Tables with CJK text and emphasis > renders tables with CJK emphasis
 * parity:93c5725eaf3e69951418876940ee6619648dbca63d2073d10889b82253ea6b15 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Blockquotes with CJK text and emphasis > renders blockquotes with CJK emphasis
 * parity:b4f43ae223f5f92f4d00aeb266c9fdc2e1403688f491b022a38d9856dd66256f — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Edge cases and special scenarios > handles emphasis with only punctuation
 * parity:478caedd0b77f3a95049e8994a118eb44c8d38f863d7e9e7bd40648afca3bf04 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Edge cases and special scenarios > handles nested emphasis with CJK punctuation
 * parity:df28b74bde7b55f022130b61ebf38b6231f2b89462375abbcfb415c415eb447c — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Edge cases and special scenarios > handles multiple emphasis markers in CJK text
 * parity:d5738ac91ae1f042e3c4c36bdce52b02bc2028ce3390c003b2554c2b948adece — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Edge cases and special scenarios > handles emphasis immediately followed by CJK punctuation
 * parity:231f307c70cf05b695c718945de01b77bddd9590daab3aefb8a2510e6b8120a2 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Edge cases and special scenarios > handles emphasis with mixed LTR and CJK text with punctuation
 * parity:cbcccad5797ff766b166c1bcde461652bb2567de3f46fc1a76d3a4b8a7190254 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Edge cases and special scenarios > handles incomplete emphasis with CJK punctuation when parseIncompleteMarkdown is enabled
 * parity:d90902ea2e2ebc538b147a86f3d1e4da52df84cee17250dc66fef376ed3319c1 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Edge cases and special scenarios > handles streaming scenario with CJK text
 * parity:42fb581a4ecab0793c2d59422ef6fd5d8ab36f7fcf148f13e3be7c11a60a8faf — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Real-world LLM output scenarios > handles typical LLM-generated Japanese response with emphasis
 * parity:ee6c17328be6feb1518364bfc34ca69e1a45d8398b122a4b0575b8487a2e3bf3 — CJK (Chinese, Japanese, Korean) Friendly Support (#185) > Real-world LLM output scenarios > handles typical LLM-generated Chinese response with emphasis
 */
