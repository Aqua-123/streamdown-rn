import { preprocessLiteralTagContent } from "../../../../src/core/preprocessTags";

describe("preprocessLiteralTagContent", () => {
  it("should return markdown unchanged when tagNames is empty", () => {
    const md = "<mention>_hello_</mention>";
    expect(preprocessLiteralTagContent(md, [])).toBe(md);
  });

  it("should escape underscores inside matching tags", () => {
    const md = "<mention>_some_username_</mention>";
    const result = preprocessLiteralTagContent(md, ["mention"]);
    expect(result).toBe("<mention>\\_some\\_username\\_</mention>");
  });

  it("should escape asterisks inside matching tags", () => {
    const md = "<tag>**bold** text</tag>";
    const result = preprocessLiteralTagContent(md, ["tag"]);
    expect(result).toContain("\\*\\*bold\\*\\*");
  });

  it("should escape backticks inside matching tags", () => {
    const md = "<tag>`inline code`</tag>";
    const result = preprocessLiteralTagContent(md, ["tag"]);
    expect(result).toContain("\\`inline code\\`");
  });

  it("should not affect content outside matching tags", () => {
    const md = "_outside_ <mention>_inside_</mention> _also_outside_";
    const result = preprocessLiteralTagContent(md, ["mention"]);
    // Outside content is unchanged
    expect(result).toContain("_outside_");
    expect(result).toContain("_also_outside_");
    // Inside content is escaped
    expect(result).toContain("\\_inside\\_");
  });

  it("should handle tags with attributes", () => {
    const md = '<mention user_id="123">_some_username_</mention>';
    const result = preprocessLiteralTagContent(md, ["mention"]);
    expect(result).toBe(
      '<mention user_id="123">\\_some\\_username\\_</mention>'
    );
  });

  it("should handle multiple tags", () => {
    const md = "<foo>_a_</foo> <bar>*b*</bar>";
    const result = preprocessLiteralTagContent(md, ["foo", "bar"]);
    expect(result).toContain("\\_a\\_");
    expect(result).toContain("\\*b\\*");
  });

  it("should be case insensitive", () => {
    const md = "<Mention>_hello_</Mention>";
    const result = preprocessLiteralTagContent(md, ["mention"]);
    expect(result).toBe("<Mention>\\_hello\\_</Mention>");
  });

  it("should leave unmatched tags unchanged", () => {
    const md = "<other>_hello_</other>";
    expect(preprocessLiteralTagContent(md, ["mention"])).toBe(md);
  });

  it("should handle content with no special characters unchanged", () => {
    const md = "<mention>hello world</mention>";
    const result = preprocessLiteralTagContent(md, ["mention"]);
    expect(result).toBe("<mention>hello world</mention>");
  });

  it("should replace double newlines with HTML entities to prevent paragraph splits", () => {
    const md = "<ai-thinking>first part\n\nsecond part</ai-thinking>";
    const result = preprocessLiteralTagContent(md, ["ai-thinking"]);
    expect(result).toBe(
      "<ai-thinking>first part&#10;&#10;second part</ai-thinking>"
    );
  });

  it("should handle multiple double newlines within tag content", () => {
    const md = "<tag>a\n\nb\n\nc</tag>";
    const result = preprocessLiteralTagContent(md, ["tag"]);
    expect(result).toBe("<tag>a&#10;&#10;b&#10;&#10;c</tag>");
  });

  it("should preserve single newlines unchanged", () => {
    const md = "<tag>line1\nline2</tag>";
    const result = preprocessLiteralTagContent(md, ["tag"]);
    expect(result).toBe("<tag>line1\nline2</tag>");
  });
});

/* Pinned parity evidence:
 * parity:481fe0c1785f0eadd1d121c09e2fb454ff8a5c8e288712e3d9e39d40bcef8fc3
 * parity:20de6c4e2e1f94d03630ff61d1f9b3265fd43526952d4f6b24c26fb7520e0a3e
 * parity:b33bda87c48af7dff1273d8610d2ad8f25c293c724e47345ba794da96906294f
 * parity:0929578a9cf9704c7d149f0e24245c04ea2361ef804eb9bcd94034d18b25992c
 * parity:18aa453f31ab3bf3cfef3c47b3a23bebe0ab33d18eaa84dacf2ef24da2e77540
 * parity:6c0a9462b55e60f1a49af63180463158864c248a1a482fd21e59a37401e11543
 * parity:b063b57c53f175fcc3078400a68a5bab1a1362563090e459d44d2a1a745c1529
 * parity:ad61f4b4c99d61c2bd4791f2d1460da5db4ea373888deb9938e0378e7968dbea
 * parity:77230ddf4e4ad951a3efbc87f1ef49f9123b44f693f0576adab6b51854a4e480
 * parity:3360476dd8eb71d828c6af45efe6283769459c9df05ae40cc51d20896a8cfa18
 * parity:71efd7e0c60a02fca7a3223aa8e8b89d03a37c8c161d01a661c7ed8e77eac4fc
 * parity:9f0ced9f00a9fb58ae94fc7dfe879039b63992162c5ebc68ec5f6744e5ccd773
 * parity:99b4f0686e145ca884ec63e7740150bd8164d207cc854cfe8532956c7fbb4acb
 */
