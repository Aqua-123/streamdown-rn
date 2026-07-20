import { preprocessCustomTags } from "../../../../src/core/preprocessTags";

describe("preprocessCustomTags", () => {
  it("should return markdown unchanged when tagNames is empty", () => {
    const md = "<custom>\n\nContent\n\n</custom>";
    expect(preprocessCustomTags(md, [])).toBe(md);
  });

  it("should replace blank lines inside custom tags with HTML comments", () => {
    const md = "<custom>\nHello\n\nWorld\n</custom>";
    const result = preprocessCustomTags(md, ["custom"]);
    expect(result).toBe("<custom>\nHello\n<!---->\nWorld\n</custom>\n\n");
  });

  it("should ensure content is on its own lines when inline with opening tag", () => {
    const md = "<custom>Hello\n\nWorld</custom>";
    const result = preprocessCustomTags(md, ["custom"]);
    expect(result).toBe("<custom>\nHello\n<!---->\nWorld\n</custom>\n\n");
  });

  it("should handle multiple blank lines", () => {
    const md = "<custom>A\n\nB\n\nC</custom>";
    const result = preprocessCustomTags(md, ["custom"]);
    expect(result).toBe("<custom>\nA\n<!---->\nB\n<!---->\nC\n</custom>\n\n");
  });

  it("should handle multiple tag names", () => {
    const md = "<foo>A\n\nB</foo>\n<bar>C\n\nD</bar>";
    const result = preprocessCustomTags(md, ["foo", "bar"]);
    expect(result).toContain("<foo>\nA\n<!---->\nB\n</foo>");
    expect(result).toContain("<bar>\nC\n<!---->\nD\n</bar>");
  });

  it("should handle tags with attributes", () => {
    const md = '<custom class="test" id="x">A\n\nB</custom>';
    const result = preprocessCustomTags(md, ["custom"]);
    expect(result).toBe(
      '<custom class="test" id="x">\nA\n<!---->\nB\n</custom>\n\n'
    );
  });

  it("should be case insensitive", () => {
    const md = "<Custom>A\n\nB</Custom>";
    const result = preprocessCustomTags(md, ["custom"]);
    expect(result).toBe("<Custom>\nA\n<!---->\nB\n</Custom>\n\n");
  });

  it("should leave markdown without custom tags unchanged", () => {
    const md = "# Hello\n\nWorld";
    expect(preprocessCustomTags(md, ["custom"])).toBe(md);
  });

  it("should not modify content without blank lines", () => {
    const md = "<custom>Hello World</custom>";
    expect(preprocessCustomTags(md, ["custom"])).toBe(md);
  });

  it("should not modify tags where content already starts on own line without blank lines", () => {
    const md = "<custom>\nHello\n</custom>";
    expect(preprocessCustomTags(md, ["custom"])).toBe(md);
  });

  it("should handle content on same line as opening tag (issue #456)", () => {
    const md =
      "<ai-thinking>this is thinking\n\n * why is break?</ai-thinking># Hello World";
    const result = preprocessCustomTags(md, ["ai-thinking"]);
    expect(result).toBe(
      "<ai-thinking>\nthis is thinking\n<!---->\n * why is break?\n</ai-thinking>\n\n# Hello World"
    );
  });
});

/* Pinned parity evidence:
 * parity:6a1cd74ed2a1286065d31e2f5f5208614e64ac4ea22fab34a4490abe33316542
 * parity:1355f6943dfcf9846a0b946506b3752f442dcad6024d640e018ab378f16b5985
 * parity:1b2af4f9cdd3ab41eb016fdd9fe25ccdd4ca9e65ca602665714d3983b5460795
 * parity:49b296951d1a5298b145732ac72efc392e9662f6edb61b7760cf6af9de28b371
 * parity:a25569f5281df646f9ac5c96af2862f7e37f876d37348f1c668a44eb79b58170
 * parity:fac5558ee133d06dc90bf638ba8cf0dd841035f179f55027a3cb883c326185ed
 * parity:2171bc03347055b9f7626b78059f0a27cb31724e0b63f91cab720fe8adff52b7
 * parity:28bba599e1651f974250661a178b2850fda3cdbe703343d83db7a63e77708f71
 * parity:a8ad0f46e21443876faf44c3a9e1bf1fcc7b0ffe1ce3ac9b18580cd2aa988bb3
 * parity:4ddf283c213b788a2e73045e899e7869a10eba66dc5c8af998dac06487eacf09
 * parity:131997ff1eda7d380477ca7936f0db74d3fa0cddd8cb90c90f4e99421e3b1552
 */
