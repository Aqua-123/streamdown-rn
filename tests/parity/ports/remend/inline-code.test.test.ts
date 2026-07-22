import remend from "remend";

describe("inline code formatting (`)", () => {
  // parity:493fa91afca240620b6b42da5df27f0b3993bf9b0328567730c3a982d6f6a32d
  it("should complete incomplete inline code", () => {
    expect(remend("Text with `code")).toBe("Text with `code`");
    expect(remend("`incomplete")).toBe("`incomplete`");
  });

  // parity:ac59407824433d8517c0ce4bc07299477b8b6d2105466bd620d50bc9c42080ea
  it("should keep complete inline code unchanged", () => {
    const text = "Text with `inline code`";
    expect(remend(text)).toBe(text);
  });

  // parity:63cb9e74304873e7cfae294f7f2eaa63e12ce8f5c345bcda1f0ee2ee227063ab
  it("should handle multiple inline code sections", () => {
    const text = "`code1` and `code2`";
    expect(remend(text)).toBe(text);
  });

  // parity:3437c8caeda8113879719543af083bd54ff7c436a41cfffd8b86b79e8ecca68a
  it("should not complete backticks inside code blocks", () => {
    const text = "```\ncode block with `backtick\n```";
    expect(remend(text)).toBe(text);
  });

  // parity:eddab46296aab1825ed8ec736a0476a321126767a095158ea246acfccd67da2e
  it("should handle incomplete code blocks correctly", () => {
    const text = "```javascript\nconst x = `template";
    expect(remend(text)).toBe(text);
  });

  // parity:43f54cc8c9df38c2d355f2e5b712219a5c5ae57866d3de04b6e58a9b6bc912e1
  it("should handle inline triple backticks correctly", () => {
    const text = '```python print("Hello, Sunnyvale!")```';
    expect(remend(text)).toBe(text);
  });

  // parity:13185cb9aa13c5ac94a019e2098c250e7901633f6ee260c400dec3156ea6da22
  it("should handle incomplete inline triple backticks", () => {
    const text = '```python print("Hello, Sunnyvale!")``';
    expect(remend(text)).toBe('```python print("Hello, Sunnyvale!")```');
  });

  // parity:7ab426c6afc8ce936166904968b726b5a25f2e99d1c8f4998c27ad90250c203f
  it("should not modify text with complete triple backticks at the end", () => {
    const text = "```code```";
    expect(remend(text)).toBe(text);

    const text2 = "```code```\n";
    expect(remend(text2)).toBe(text2);

    // Even number of triple backticks with newlines are complete
    const text3 = "```\ncode\n```";
    expect(remend(text3)).toBe(text3);

    // Test the special case (lines 41-47) where text ends with ``` and has even count
    // This case is for inline triple backticks without newlines
    const text4 = "``````";
    expect(remend(text4)).toBe(text4);

    const text5 = "text``````";
    expect(remend(text5)).toBe(text5);
  });

  // parity:7c0a575c98026960e3129aab3d594b250d1d790f9c002677ac4210cfa160426a
  it("should handle code block with incomplete inline code after (#302)", () => {
    expect(remend("```\nblock\n```\n`inline")).toBe(
      "```\nblock\n```\n`inline`"
    );
  });
});

describe("escaped backticks in inline code", () => {
  // parity:50ffee8daf3ccd66d87fbbcccaaf447ec4bf60a50dd588c9d57388722c6c41fc
  it("should not treat escaped backticks as code delimiters", () => {
    // \` is not a real backtick delimiter, so **bold should still be completed
    expect(remend("\\`not code\\` **bold")).toBe("\\`not code\\` **bold**");
  });

  // parity:1c34dfa0213edb4b4cab64677cbd8d59e8bafc9d71059b7c659c32caa5f6d238
  it("should complete emphasis when only escaped backticks are present", () => {
    expect(remend("\\` *italic")).toBe("\\` *italic*");
  });
});

describe("emphasis markers inside inline code spans should not leak", () => {
  // parity:31e8cbed4e12546776da0ebb6a92c07b725bebc445a97628552db9bb5fce2052
  it("should not complete bold/italic/strikethrough if they are inside inline code", () => {
    expect(remend("`**bold`")).toBe("`**bold`");
    expect(remend("`*italic`")).toBe("`*italic`");
    expect(remend("`~~strikethrough`")).toBe("`~~strikethrough`");
  });

  // parity:ed19ee5fe74370f3185facf722baa61b6146b1c4fcfeb2ed35800dfaa214197d
  it("should still complete emphasis markers outside inline code", () => {
    expect(remend("**bold")).toBe("**bold**");
    expect(remend("*italic")).toBe("*italic*");
    expect(remend("~~strike")).toBe("~~strike~~");
  });

  // parity:2257f3c46ec3c7323706566e652c808a5876efec12d95a4385587a6eb024a9cd
  it("should complete emphasis after a closed inline code span", () => {
    expect(remend("`code` **bold")).toBe("`code` **bold**");
  });
});
