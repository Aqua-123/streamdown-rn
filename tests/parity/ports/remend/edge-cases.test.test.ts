import remend from "remend";

describe("edge cases", () => {
  // parity:ed3255bf8dd5f2f56782f34889337cc30d840d07e38e007213363742363bf48b
  it("should handle text ending with formatting characters", () => {
    expect(remend("Text ending with *")).toBe("Text ending with *");
    expect(remend("Text ending with **")).toBe("Text ending with **");
  });

  // parity:102480dce37f14673c7ffb82300a44c60d90a6e2354fa978fdde5e7f6d06ec08
  it("should handle empty formatting markers", () => {
    expect(remend("****")).toBe("****");
    expect(remend("``")).toBe("``");
  });

  // parity:6d8aa10b4ccb61a8b68f3be1edfc18a235b6a03b19464fad57bccb3daa416d4b
  it("should handle standalone emphasis characters (#90)", () => {
    // Standalone markers should not be auto-closed
    expect(remend("**")).toBe("**");
    expect(remend("__")).toBe("__");
    expect(remend("***")).toBe("***");
    expect(remend("*")).toBe("*");
    expect(remend("_")).toBe("_");
    expect(remend("~~")).toBe("~~");
    expect(remend("`")).toBe("`");

    // Multiple standalone markers on the same line
    expect(remend("** __")).toBe("** __");
    expect(remend("\n** __\n")).toBe("\n** __\n");
    expect(remend("* _ ~~ `")).toBe("* _ ~~ `");

    // Standalone markers with only whitespace
    expect(remend("** ")).toBe("**"); // Trailing single space removed
    expect(remend(" **")).toBe(" **");
    expect(remend("  **  ")).toBe("  **  "); // Trailing double space preserved as line break

    // But markers with actual content should still be closed
    expect(remend("**text")).toBe("**text**");
    expect(remend("__text")).toBe("__text__");
    expect(remend("*text")).toBe("*text*");
    expect(remend("_text")).toBe("_text_");
    expect(remend("~~text")).toBe("~~text~~");
    expect(remend("`text")).toBe("`text`");
  });

  // parity:6f7fc1bffb20e521008a960aca41c6f68f30ff99fd49df0548f81b0280298cb4
  it("should handle very long text", () => {
    const longText = `${"a".repeat(10_000)} **bold`;
    const expected = `${"a".repeat(10_000)} **bold**`;
    expect(remend(longText)).toBe(expected);
  });

  // parity:dfedf7e9e3407fc4b4875cb4b59a12e648e94217f51f985161c64d7ada8f9e99
  it("should handle text with only formatting characters", () => {
    expect(remend("*")).toBe("*");
    expect(remend("**")).toBe("**");
    expect(remend("`")).toBe("`");
  });

  // parity:692bf27e22dbc01b6dc7fd3f9426b51eefef78f7682f576ae031d47f0091b43e
  it("should handle escaped characters", () => {
    const text = "Text with \\* escaped asterisk";
    expect(remend(text)).toBe(text);
  });

  // parity:7bd4465e189b1f5f0fcfb1019b0620d46b8355c8065c884f5cec9b9ca8211c28
  it("should handle markdown at very end of string", () => {
    expect(remend("text**")).toBe("text**");
    expect(remend("text*")).toBe("text*");
    expect(remend("text`")).toBe("text`");
    expect(remend("text$")).toBe("text$"); // Single dollar not completed
    expect(remend("text~~")).toBe("text~~");
  });

  // parity:d0802d9c4594f3605f0c460ddd8853cf31cb87d0e40e68b261c83b7b794ccf6c
  it("should handle whitespace before incomplete markdown", () => {
    expect(remend("text **bold")).toBe("text **bold**");
    expect(remend("text\n**bold")).toBe("text\n**bold**");
    expect(remend("text\t`code")).toBe("text\t`code`");
  });

  // parity:948a773c8dda2421da63a1b6fa3134e413904b2e5a35c2583495c84f6617d98e
  it("should handle unicode characters in incomplete markdown", () => {
    expect(remend("**émoji 🎉")).toBe("**émoji 🎉**");
    expect(remend("`código")).toBe("`código`");
  });

  // parity:2022062dea037b78d9fc4c107149b04feb42f406b3b3fbdeed41e567837c3c5d
  it("should handle HTML entities in incomplete markdown", () => {
    expect(remend("**&lt;tag&gt;")).toBe("**&lt;tag&gt;**");
    expect(remend("`&amp;")).toBe("`&amp;`");
  });

  // parity:7eaa07274e5697e7f41ac2da445afc1d562c27343be650400c57c8b2bb894311
  it("should not treat asterisks flanked by whitespace as emphasis markers (#370)", () => {
    expect(remend("3 + 2 - 5 * 0 = ?")).toBe("3 + 2 - 5 * 0 = ?");
    expect(remend("5 * 0")).toBe("5 * 0");
    expect(remend("x * y")).toBe("x * y");
    expect(remend("a * b = c")).toBe("a * b = c");
    // Even count of space-flanked asterisks should also be fine
    expect(remend("2 * 3 * 4")).toBe("2 * 3 * 4");
    // Mixed: space-flanked operator + real italic should still work
    expect(remend("5 * 0 and *italic")).toBe("5 * 0 and *italic*");
  });
});
