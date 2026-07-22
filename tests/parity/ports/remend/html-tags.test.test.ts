import remend from "remend";

describe("incomplete HTML tag stripping", () => {
  // parity:75c6b540c5698969a8606fe9397ea46e0b140c82d9d4a390417e5491aaeb4181
  it("should strip incomplete opening tags at end", () => {
    expect(remend("Hello <div")).toBe("Hello");
    expect(remend("Hello <custom")).toBe("Hello");
    expect(remend("Hello <casecard")).toBe("Hello");
    expect(remend("Text <MyComponent")).toBe("Text");
  });

  // parity:dd640b87efa2531c47010b203e4296414df244f410670d7870d1ee07ed09ab44
  it("should strip incomplete closing tags at end", () => {
    expect(remend("Hello </div")).toBe("Hello");
    expect(remend("Hello </custom")).toBe("Hello");
    expect(remend("<div>content</di")).toBe("<div>content");
  });

  // parity:908a28b954f541f6c1b4d5763dcd1c804dfe5bc76e9a560801241da70d4a7048
  it("should strip incomplete tags with partial attributes", () => {
    expect(remend('Hello <div class="foo')).toBe("Hello");
    expect(remend("Hello <div class=")).toBe("Hello");
    expect(remend('Hello <a href="https://example.com')).toBe("Hello");
    expect(remend("<custom data-id")).toBe("");
  });

  // parity:4cb6725481de59cb99352f3f4abac16991c41d769a79c2645037adb9a200c2af
  it("should keep complete tags unchanged", () => {
    expect(remend("Hello <div>")).toBe("Hello <div>");
    expect(remend("<div>content</div>")).toBe("<div>content</div>");
    expect(remend("<br/>")).toBe("<br/>");
    expect(remend("<img src='test'>")).toBe("<img src='test'>");
  });

  // parity:695f6ecb3db1e77ba87939147920cdfcc6927590218e86d8429a1e2cc1d6d435
  it("should not strip < followed by space or number", () => {
    expect(remend("3 < 5")).toBe("3 < 5");
    expect(remend("x < y")).toBe("x < y");
    expect(remend("if a <")).toBe("if a <");
    expect(remend("value <1")).toBe("value <1");
  });

  // parity:2d531081bde2802bc8f26f8bf69d45dcc7a33aff144d9618a7ecad74e4e17e70
  it("should not strip inside code blocks", () => {
    expect(remend("```\n<div\n```")).toBe("```\n<div\n```");
    expect(remend("```html\n<custom")).toBe("```html\n<custom");
  });

  // parity:f17d1cea434dbfb3a0edec5b8095152f9b68b9665fca3dafcd67fb4d316682bf
  it("should not strip inside inline code", () => {
    expect(remend("`<div`")).toBe("`<div`");
  });

  // parity:f56950150af29cc05070f8adb969c75c32b2d4ee2a608003f62393e479f4036a
  it("should handle tag at start of text", () => {
    expect(remend("<div")).toBe("");
    expect(remend("<custom")).toBe("");
    expect(remend("</div")).toBe("");
  });

  // parity:357e02bded511b29d1ab7afab6b64ea1c456bf299bc885edab3c4403f4f12a6d
  it("should strip only the incomplete tag, preserving prior content", () => {
    expect(remend("Some text here\n\n<casecard")).toBe("Some text here");
    expect(remend("# Heading\n\nParagraph <custom")).toBe(
      "# Heading\n\nParagraph"
    );
  });

  // parity:573b03aeace2502f97777f998b168590375fcfca5eb7f7496c690126d7777b04
  it("should handle complete tag followed by incomplete tag", () => {
    expect(remend("<div>Hello</div> <span")).toBe("<div>Hello</div>");
  });

  // parity:51f3f882e8dabfe1ef75a646bafdf3128a0d85e95ad465295d424c9d93e4204d
  it("should not add trailing underscore for HTML attributes with underscores", () => {
    expect(remend('<a target="_blank" href="https://link.com">word</a>')).toBe(
      '<a target="_blank" href="https://link.com">word</a>'
    );
    expect(remend('<a target="_blank">link</a>')).toBe(
      '<a target="_blank">link</a>'
    );
    expect(remend('<iframe src="x" sandbox="allow_scripts">')).toBe(
      '<iframe src="x" sandbox="allow_scripts">'
    );
  });

  // parity:ff492f29f6bfd52c2a293b2ab3b1255faf3225c443f19d476b177e0881c54336
  it("should be disabled when htmlTags option is false", () => {
    expect(remend("Hello <div", { htmlTags: false })).toBe("Hello <div");
  });
});
