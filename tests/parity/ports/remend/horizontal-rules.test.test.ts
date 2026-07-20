import remend from "remend";

describe("horizontal rule handling", () => {
  it("should preserve complete horizontal rules with hyphens", () => {
    expect(remend("---")).toBe("---");
    expect(remend("----")).toBe("----");
    expect(remend("-----")).toBe("-----");
  });

  it("should preserve complete horizontal rules with asterisks", () => {
    expect(remend("***")).toBe("***");
    expect(remend("****")).toBe("****");
    expect(remend("*****")).toBe("*****");
  });

  it("should preserve complete horizontal rules with underscores", () => {
    expect(remend("___")).toBe("___");
    expect(remend("____")).toBe("____");
    expect(remend("_____")).toBe("_____");
  });

  it("should preserve horizontal rules with spaces", () => {
    expect(remend("- - -")).toBe("- - -");
    expect(remend("* * *")).toBe("* * *");
    expect(remend("_ _ _")).toBe("_ _ _");
  });

  it("should preserve horizontal rules with mixed spacing", () => {
    expect(remend("-  -  -")).toBe("-  -  -");
    expect(remend("*   *   *")).toBe("*   *   *");
    expect(remend("_    _    _")).toBe("_    _    _");
  });

  it("should not confuse horizontal rules with emphasis", () => {
    // *** on its own line should be recognized as a horizontal rule
    expect(remend("Text before\n***\nText after")).toBe(
      "Text before\n***\nText after"
    );

    // Three underscores on own line = horizontal rule, not italic
    expect(remend("Text before\n___\nText after")).toBe(
      "Text before\n___\nText after"
    );
  });

  it("should handle horizontal rules at the end of text", () => {
    expect(remend("Some text\n\n---")).toBe("Some text\n\n---");
    expect(remend("Some text\n\n***")).toBe("Some text\n\n***");
    expect(remend("Some text\n\n___")).toBe("Some text\n\n___");
  });

  it("should handle horizontal rules at the start of text", () => {
    expect(remend("---\n\nSome text")).toBe("---\n\nSome text");
    // *** on its own line should be recognized as a horizontal rule
    expect(remend("***\n\nSome text")).toBe("***\n\nSome text");
    // ___ on its own line should be recognized as a horizontal rule
    expect(remend("___\n\nSome text")).toBe("___\n\nSome text");
  });

  it("should handle multiple horizontal rules", () => {
    expect(remend("Section 1\n\n---\n\nSection 2\n\n---\n\nSection 3")).toBe(
      "Section 1\n\n---\n\nSection 2\n\n---\n\nSection 3"
    );
  });

  it("should not confuse two asterisks with horizontal rule start", () => {
    // ** is bold, not a horizontal rule
    expect(remend("Text with **bold")).toBe("Text with **bold**");
  });

  it("should not confuse two hyphens with horizontal rule", () => {
    // -- is not a valid horizontal rule (needs 3+)
    expect(remend("Text with --")).toBe("Text with --");
  });

  it("should handle horizontal rules after lists", () => {
    const text = "- Item 1\n- Item 2\n\n---\n\nNew section";
    expect(remend(text)).toBe(text);
  });

  it("should handle horizontal rules before headings", () => {
    const text = "---\n\n# Heading";
    expect(remend(text)).toBe(text);
  });

  it("should handle partial horizontal rules during streaming", () => {
    // Two characters - not yet a valid horizontal rule
    expect(remend("--")).toBe("--");
    expect(remend("**")).toBe("**");
    expect(remend("__")).toBe("__");

    // With context showing it's meant to be a rule
    expect(remend("Text\n\n--")).toBe("Text\n\n--");
  });

  it("should not add closing markers to standalone asterisk sequences that could be rules", () => {
    // 4+ asterisks should not be completed as bold-italic
    expect(remend("****")).toBe("****");
    expect(remend("*****")).toBe("*****");
  });

  it("should handle horizontal rules with leading whitespace", () => {
    // Up to 3 spaces before a horizontal rule is valid
    expect(remend("   ---")).toBe("   ---");
    expect(remend("  ***")).toBe("  ***");
    expect(remend(" ___")).toBe(" ___");
  });

  it("should handle horizontal rule-like patterns in text", () => {
    // Horizontal rules need to be on their own line
    // When --- appears inline, it's treated as text, not a horizontal rule
    expect(remend("This is not a --- horizontal rule")).toBe(
      "This is not a --- horizontal rule"
    );
  });

  it("should not complete emphasis when asterisks form potential horizontal rule", () => {
    // Text ending with newline then *** should not add closing ***
    expect(remend("Text\n***")).toBe("Text\n***");
  });

  it("should handle horizontal rules in complex markdown", () => {
    const text = `# Title

Some content with **bold** text.

---

## Section 2

More content.`;
    expect(remend(text)).toBe(text);
  });
});

/* Pinned parity evidence:
 * parity:0ae905a8f298d41525f8f48ad2723cbd8ec0e126225e960be49e7ab9f812538b
 * parity:1880c6cceb9bbe8c2950cec9da95a09a41b0bf286900c63492ae6df49262701d
 * parity:9410723e3b41625afef1f4d5095d36b700ed6d384de5025acef53d48b6f88f23
 * parity:381dd2d2a102edac88754f96d3c68b5857ff3f9a5a79c0dd689aaa20f10fa2e4
 * parity:6af466b695e41b329f51e1eb039dd5ac3f32d1a3fd6f0b1d87fe1004fb4fd82e
 * parity:df65b582d30255c080b42adfc329284129d0283fef8e5cc7d9b979837f05d0b5
 * parity:255994ac42605477e1b6568d3990d45a4fb5165aaf2d29e50bcc62e9c18b1107
 * parity:480858cc5435813c1588dc166e36b88eb47dd5ed8538816fe51bd9be1dde3470
 * parity:3af12aa6aa86e3cda8d797672bc8550aec28ee316d88f1b323e5cccc53423391
 * parity:6e18debfe6dd8dfe8adf0bfbd40bc5bc55d72a90b0f79b31cfa30479cb244d28
 * parity:df046fa879fc034cfec89c6b2950433d497a21fa54300ab9cd9d71b6556ec610
 * parity:542a42bb63ac1d2c4be0d900543ab5eb36f23fe02f023772c8c68a3bd9d088c9
 * parity:4dd078a9825759a39701b2f6858c50718604bcda6698de9a0824ec423dc8cfac
 * parity:77fd6116eeba0d12661cc5d2e1942946416df3c0b2467f71f81c3e147c744e40
 * parity:c972710e5363f2dd3a33697bd6e7749ea29c1c6f6b59e5b7288f67a292768377
 * parity:bf8a4dc35a70594a1d28bc7f634c96b798a497d6f16dd0166e9dfbbf0f0fc9f4
 * parity:920e8f9368dfc39fee03679d39be26270e356b36a042d0983572f28d0d11bb48
 * parity:a6ecb596d77c86f39974ff6cac0c645f884f874802051865ec29b071fb9c24a0
 * parity:378052565b6e752e098f8534da96a7d451385df5e258f10237548f981a22483a
 */
