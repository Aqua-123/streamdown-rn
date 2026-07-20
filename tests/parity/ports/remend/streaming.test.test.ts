import remend from "remend";

describe("chunked streaming scenarios", () => {
  it("should handle nested formatting cut mid-stream", () => {
    expect(remend("This is **bold with *ital")).toBe(
      "This is **bold with *ital*"
    );
    // When underscore opens after bold, underscore should close before bold (proper nesting)
    expect(remend("**bold _und")).toBe("**bold _und_**");
  });

  it("should handle headings with incomplete formatting", () => {
    expect(remend("# Main Title\n## Subtitle with **emph")).toBe(
      "# Main Title\n## Subtitle with **emph**"
    );
  });

  it("should handle blockquotes with incomplete formatting", () => {
    expect(remend("> Quote with **bold")).toBe("> Quote with **bold**");
  });

  it("should handle tables with incomplete formatting", () => {
    expect(remend("| Col1 | Col2 |\n|------|------|\n| **dat")).toBe(
      "| Col1 | Col2 |\n|------|------|\n| **dat**"
    );
  });

  it("should handle complex nested structures from chunks", () => {
    // Backticks spanning multiple lines need special handling
    expect(remend("1. First item\n   - Nested with `code\n2. Second")).toBe(
      "1. First item\n   - Nested with `code\n2. Second`"
    );
  });

  it("should handle multiple incomplete formats in one chunk", () => {
    // Formats are closed in order they're processed
    expect(remend("Text **bold `code")).toBe("Text **bold `code**`");
  });
});

describe("real-world streaming chunks", () => {
  it("should handle typical GPT response chunks", () => {
    const chunks = [
      "Here is",
      "Here is a **bold",
      "Here is a **bold statement",
      "Here is a **bold statement** about",
      "Here is a **bold statement** about `code",
      "Here is a **bold statement** about `code`.",
    ];

    expect(remend(chunks[0])).toBe("Here is");
    expect(remend(chunks[1])).toBe("Here is a **bold**");
    expect(remend(chunks[2])).toBe("Here is a **bold statement**");
    expect(remend(chunks[3])).toBe("Here is a **bold statement** about");
    expect(remend(chunks[4])).toBe("Here is a **bold statement** about `code`");
    expect(remend(chunks[5])).toBe(chunks[5]);
  });

  it("should handle code explanation chunks", () => {
    const chunks = [
      "To use this function",
      "To use this function, call `getData(",
      "To use this function, call `getData()` with",
    ];

    expect(remend(chunks[0])).toBe(chunks[0]);
    expect(remend(chunks[1])).toBe("To use this function, call `getData(`");
    expect(remend(chunks[2])).toBe(chunks[2]);
  });
});

/* Pinned parity evidence:
 * parity:5a789ae7c84d8c76a6bdb7a4ab6d39aeee5fa3774ba05b4b387f1910b15c6453
 * parity:cb3127031814b593cb6979c1201a8c76798093426fced640f24724fae531000a
 * parity:c72a5ed9fa9dbed62be25d9be566481ae3d1f2eb6b6f568c308fb3a322991b1c
 * parity:eea936cac2d39bab265bb465f4c23070702fcb269ad621acdbf3a136f8c6996c
 * parity:258746a13e1f8093c695216b4999c9e79b283cde286b56a3820200756a48e6f3
 * parity:08bf5deb18536ba773bb13b012c30f5afd2dc2189958b6fc1f6d6159eb88bc54
 * parity:5c82ae858cfb590a41eea1cc00b7cb683fd231cb4a95c907bf6326fa019f75bb
 * parity:75ba052f16a3c60bf0974ec4f2839d6390c888217116bb29ad03dce38dd30028
 */
