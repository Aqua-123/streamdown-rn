import remend from "remend";

// 1. Rapid successive formatting switches
describe("rapid successive formatting switches", () => {
  it("should close italic and strikethrough but not bold when asterisk in content", () => {
    // Bold pattern can't match when there's a * in content between ** and end
    // Only italic (*) and strikethrough (~~) close
    const result = remend("**bold then *italic then ~~strike");
    expect(result).toBe("**bold then *italic then ~~strike*~~");
  });

  it("should close italic and strikethrough when bold pattern blocked", () => {
    // Bold pattern blocked by * in content; italic and strikethrough close
    const result = remend("~~strike **bold *italic");
    expect(result).toBe("~~strike **bold *italic*~~");
  });

  it("should close handlers in priority order (bold before strikethrough before code)", () => {
    // Bold can't match (asterisk in content), italic appends *, boldItalic appends ***,
    // then inline code appends `, then strikethrough appends ~~
    const result = remend("*italic **bold ~~strike `code");
    expect(result).toBe("*italic **bold ~~strike `code***`~~");
  });

  it("should close bold before strikethrough (priority order)", () => {
    // Bold handler (priority 35) runs before strikethrough (priority 60)
    const result = remend("**bold ~~strike");
    expect(result).toBe("**bold ~~strike**~~");
  });

  it("should close italic then bold via bold-italic handler", () => {
    const result = remend("*italic **bold");
    expect(result).toBe("*italic **bold***");
  });
});

// 2. Formatting cut mid-marker
describe("formatting cut mid-marker", () => {
  it("should not close single asterisk at end (ambiguous)", () => {
    // Single trailing * could be start of ** - not meaningful content after it
    const result = remend("text*");
    expect(result).toBe("text*");
  });

  it("should not close single tilde at end (not a valid marker alone)", () => {
    const result = remend("text~");
    expect(result).toBe("text~");
  });

  it("should not close single dollar at end without inlineKatex", () => {
    const result = remend("text$");
    expect(result).toBe("text$");
  });

  it("should close single dollar at end with inlineKatex enabled", () => {
    // countSingleDollars sees 1 (odd), appends $
    const result = remend("text$", { inlineKatex: true });
    expect(result).toBe("text$$");
  });

  it("should handle opening marker + single char of closing", () => {
    // **bold* is a half-complete bold closing
    expect(remend("**bold*")).toBe("**bold**");
    // ~~strike~ is a half-complete strikethrough closing
    expect(remend("~~strike~")).toBe("~~strike~~");
    // $$formula$ is a half-complete block katex closing
    expect(remend("$$formula$")).toBe("$$formula$$");
  });
});

// 3. Backslash escapes + incomplete formatting
describe("backslash escapes with incomplete formatting", () => {
  it("should not close escaped asterisks", () => {
    // \\* means escaped backslash + real asterisk
    const result = remend("\\*not italic");
    expect(result).toBe("\\*not italic");
  });

  it("should not close double-escaped backslash before asterisk", () => {
    // remend sees the char before * as \ (the second backslash) and treats it as escaped
    const result = remend("\\\\*actually italic");
    expect(result).toBe("\\\\*actually italic");
  });

  it("should close escaped double asterisks (remend does not track escape depth)", () => {
    // remend doesn't understand that \** has the first * escaped;
    // it sees ** and closes bold
    const result = remend("\\**not bold");
    expect(result).toBe("\\**not bold**");
  });

  it("should handle mixed escaped and real formatting", () => {
    // \\* is escaped, but the later *real* is valid
    const result = remend("\\*escaped\\* but *real italic");
    expect(result).toBe("\\*escaped\\* but *real italic*");
  });
});

// 4. Multiple incomplete links
describe("multiple incomplete links", () => {
  it("should handle two incomplete links", () => {
    const result = remend("[link1 and [link2");
    expect(result).toBe("[link1 and [link2](streamdown:incomplete-link)");
  });

  it("should handle one complete and one incomplete link", () => {
    const result = remend("[first](url1) and [second");
    expect(result).toBe(
      "[first](url1) and [second](streamdown:incomplete-link)"
    );
  });

  it("should handle nested incomplete brackets", () => {
    const result = remend("[outer [inner]");
    // [inner] is complete, [outer has no closing ]
    expect(result).toBe("[outer [inner]](streamdown:incomplete-link)");
  });

  it("should handle incomplete link in text-only mode", () => {
    const result = remend("[incomplete link", { linkMode: "text-only" });
    expect(result).toBe("incomplete link");
  });

  it("should handle two incomplete links in text-only mode", () => {
    const result = remend("[link1 and [link2", { linkMode: "text-only" });
    expect(result).toBe("link1 and [link2");
  });
});

// 5. Link text containing formatting markers
describe("link text with formatting markers", () => {
  it("should handle bold inside incomplete link URL", () => {
    const result = remend("[**bold link**](incomplete-url");
    expect(result).toBe("[**bold link**](streamdown:incomplete-link)");
  });

  it("should handle italic inside incomplete link URL", () => {
    const result = remend("[*italic link*](incomplete");
    expect(result).toBe("[*italic link*](streamdown:incomplete-link)");
  });

  it("should handle code inside incomplete link URL", () => {
    const result = remend("[`code link`](incomplete");
    expect(result).toBe("[`code link`](streamdown:incomplete-link)");
  });

  it("should handle incomplete formatting inside incomplete link text", () => {
    // Link handler runs first (priority 20), early returns
    const result = remend("[**bold link");
    expect(result).toBe("[**bold link](streamdown:incomplete-link)");
  });
});

// 6. Nested blockquotes with formatting
describe("nested blockquotes with formatting", () => {
  it("should close bold in deeply nested blockquote", () => {
    expect(remend("> > **deeply nested bold")).toBe(
      "> > **deeply nested bold**"
    );
  });

  it("should close bold in blockquote with list", () => {
    expect(remend("> * list with **bold")).toBe("> * list with **bold**");
  });

  it("should close italic in triple nested blockquote", () => {
    expect(remend("> > > triple nested *italic")).toBe(
      "> > > triple nested *italic*"
    );
  });

  it("should close strikethrough in blockquote", () => {
    expect(remend("> ~~struck text")).toBe("> ~~struck text~~");
  });
});

// 7. Task lists with formatting
describe("task lists with formatting", () => {
  it("should close bold in unchecked task", () => {
    expect(remend("- [ ] **bold task")).toBe("- [ ] **bold task**");
  });

  it("should keep complete strikethrough in checked task", () => {
    expect(remend("- [x] completed ~~struck~~")).toBe(
      "- [x] completed ~~struck~~"
    );
  });

  it("should close italic in unchecked task", () => {
    expect(remend("- [ ] *italic task")).toBe("- [ ] *italic task*");
  });

  it("should close inline code in task", () => {
    expect(remend("- [ ] `code task")).toBe("- [ ] `code task`");
  });
});

// 8. Formatting inside table cells
describe("formatting inside table cells", () => {
  it("should close bold that appears to span cell boundary", () => {
    // The ** has content after it, so it should be closed
    expect(remend("| **bold | next |")).toBe("| **bold | next |**");
  });

  it("should close inline code that spans cell boundary", () => {
    expect(remend("| `code | next |")).toBe("| `code | next |`");
  });

  it("should handle complete formatting in table cell", () => {
    const text = "| **bold** | next |";
    expect(remend(text)).toBe(text);
  });
});

// 9. HTML comments and special HTML
describe("HTML comments and special HTML", () => {
  it("should not strip HTML comment (pattern requires <[a-zA-Z/])", () => {
    // <!-- starts with <! which doesn't match the handler's /^<[a-zA-Z/]/ pattern
    expect(remend("text <!-- incomplete comment")).toBe(
      "text <!-- incomplete comment"
    );
  });

  it("should not strip complete script tag with trailing text", () => {
    // <script> is a complete tag (has >), so the handler doesn't strip it
    expect(remend("text <script>alert('")).toBe("text <script>alert('");
  });

  it("should strip incomplete div with attributes", () => {
    expect(remend('text <div class="test')).toBe("text");
  });

  it("should keep complete HTML tags", () => {
    expect(remend("text <br>")).toBe("text <br>");
  });

  it("should keep complete HTML comments", () => {
    expect(remend("text <!-- comment -->")).toBe("text <!-- comment -->");
  });
});

// 10. KaTeX with complex content
describe("KaTeX with complex content", () => {
  it("should close block katex with braces inside", () => {
    // remend just appends $$, it doesn't complete LaTeX braces
    expect(remend("$$\\frac{x}{y")).toBe("$$\\frac{x}{y$$");
  });

  it("should close block katex with latex environments", () => {
    expect(remend("$$\\begin{matrix} a")).toBe("$$\\begin{matrix} a$$");
  });

  it("should close inline katex when enabled", () => {
    expect(remend("$x^2 + y^2", { inlineKatex: true })).toBe("$x^2 + y^2$");
  });

  it("should not treat currency as katex without inlineKatex", () => {
    const text = "The price is $50 and $100";
    expect(remend(text)).toBe(text);
  });

  it("should close odd inline katex with currency-like text", () => {
    // With inlineKatex enabled, $50 and $100 look like two single $ signs (even count)
    const result = remend("The price is $50 and $100", { inlineKatex: true });
    expect(result).toBe("The price is $50 and $100");
  });

  it("should close multiline block katex with complex content", () => {
    expect(remend("$$\n\\sum_{i=0}^{n} x_i")).toBe(
      "$$\n\\sum_{i=0}^{n} x_i\n$$"
    );
  });
});

// 11. Consecutive completed + incomplete
describe("consecutive completed + incomplete formatting", () => {
  it("should close second bold after complete bold", () => {
    expect(remend("**bold** then **more")).toBe("**bold** then **more**");
  });

  it("should close second inline code after complete code", () => {
    expect(remend("`code` then `more")).toBe("`code` then `more`");
  });

  it("should close second strikethrough after complete strikethrough", () => {
    expect(remend("~~done~~ and ~~undone")).toBe("~~done~~ and ~~undone~~");
  });

  it("should close second italic after complete italic", () => {
    expect(remend("*first* and *second")).toBe("*first* and *second*");
  });

  it("should close second bold-italic after complete bold-italic", () => {
    expect(remend("***first*** and ***second")).toBe(
      "***first*** and ***second***"
    );
  });
});

// 12. Formatting at paragraph boundaries
describe("formatting at paragraph boundaries", () => {
  it("should close bold after paragraph break", () => {
    expect(remend("paragraph1\n\n**bold")).toBe("paragraph1\n\n**bold**");
  });

  it("should close italic after paragraph break", () => {
    expect(remend("line1\n\n*italic text")).toBe("line1\n\n*italic text*");
  });

  it("should close formatting after multiple newlines", () => {
    expect(remend("text\n\n\n**bold")).toBe("text\n\n\n**bold**");
  });

  it("should close inline code across paragraph", () => {
    expect(remend("text\n\n`code")).toBe("text\n\n`code`");
  });
});

// 13. Deeply nested formatting (4+ levels)
describe("deeply nested formatting", () => {
  it("should close handlers in priority order with deeply nested formatting", () => {
    // Bold can't match (asterisk in content), italic appends *,
    // inline code appends `, strikethrough appends ~~
    const result = remend("**bold *italic ~~strike `code");
    expect(result).toBe("**bold *italic ~~strike `code*`~~");
  });

  it("should close bold-italic then code then strikethrough", () => {
    // BoldItalic (priority 30) appends ***, then inline code (50) appends `,
    // then strikethrough (60) appends ~~
    const result = remend("***bold-italic ~~strike `code");
    expect(result).toBe("***bold-italic ~~strike `code***`~~");
  });

  it("should close italic but not bold when asterisk blocks bold pattern", () => {
    // Bold handler can't match when * appears in content after **
    // Italic handler closes the *, leaving ** unclosed
    const result = remend("**bold and *italic");
    expect(result).toBe("**bold and *italic*");
  });
});

// 14. CJK and Unicode with formatting
describe("CJK and Unicode with formatting", () => {
  it("should close bold with Chinese text", () => {
    expect(remend("**中文粗体")).toBe("**中文粗体**");
  });

  it("should close italic with Japanese text", () => {
    expect(remend("*日本語")).toBe("*日本語*");
  });

  it("should close inline code with Korean text", () => {
    expect(remend("`한국어 코드")).toBe("`한국어 코드`");
  });

  it("should close strikethrough with emoji content", () => {
    expect(remend("~~🎉 celebration")).toBe("~~🎉 celebration~~");
  });

  it("should close bold with mixed CJK and Latin", () => {
    expect(remend("**Hello 世界")).toBe("**Hello 世界**");
  });
});

// 15. Formatting after structural elements
describe("formatting after structural elements", () => {
  it("should close bold after horizontal rule", () => {
    expect(remend("---\n**bold after rule")).toBe("---\n**bold after rule**");
  });

  it("should close bold after heading", () => {
    expect(remend("# Heading\n**bold")).toBe("# Heading\n**bold**");
  });

  it("should close bold after blockquote", () => {
    expect(remend("> quote\n**bold")).toBe("> quote\n**bold**");
  });

  it("should close italic after code block", () => {
    expect(remend("```\ncode\n```\n*italic")).toBe("```\ncode\n```\n*italic*");
  });
});

// 16. Reference-style links and footnotes
describe("reference-style links and footnotes", () => {
  it("should handle reference-style link with complete brackets", () => {
    const text = "[text][ref]";
    expect(remend(text)).toBe(text);
  });

  it("should handle footnote reference", () => {
    const text = "[^1]";
    expect(remend(text)).toBe(text);
  });

  it("should handle incomplete reference link", () => {
    const result = remend("[text][");
    expect(result).toBe("[text][](streamdown:incomplete-link)");
  });

  it("should keep complete footnote definition", () => {
    const text = "[^1]: footnote text";
    expect(remend(text)).toBe(text);
  });
});

// 17. Indented code blocks
describe("indented code blocks", () => {
  it("should still close asterisks in indented text (not fenced)", () => {
    // remend only tracks fenced code blocks, so indented code is treated as normal text
    expect(remend("    *asterisks in indented")).toBe(
      "    *asterisks in indented*"
    );
  });

  it("should close bold in indented text", () => {
    expect(remend("    **bold in indented")).toBe("    **bold in indented**");
  });
});

// 18. Back-to-back code blocks
describe("back-to-back code blocks", () => {
  it("should handle formatting after closed code block", () => {
    expect(remend("```\ncode\n```\n**bold")).toBe("```\ncode\n```\n**bold**");
  });

  it("should not close formatting inside open code block", () => {
    // Second ``` opens a new code block that isn't closed
    const text = "```\ncode\n```\n```\nmore";
    expect(remend(text)).toBe(text);
  });

  it("should handle inline code after code block", () => {
    expect(remend("```\nblock\n```\n`inline")).toBe(
      "```\nblock\n```\n`inline`"
    );
  });
});

// 19. Confusing asterisk sequences
describe("confusing asterisk sequences", () => {
  it("should handle four asterisks (bold-italic handler appends ***)", () => {
    // BoldItalic sees odd triple-asterisk count and markers not balanced, appends ***
    const result = remend("****text");
    expect(result).toBe("****text***");
  });

  it("should handle five asterisks (bold-italic handler appends ***)", () => {
    const result = remend("*****text");
    expect(result).toBe("*****text***");
  });

  it("should handle mixed asterisk counts", () => {
    // *a**b: single * then ** - each handler works independently
    const result = remend("*a**b");
    expect(result).toBe("*a**b***");
  });
});

// 20. Whitespace edge cases
describe("whitespace edge cases", () => {
  it("should close bold with tabs in content", () => {
    expect(remend("**bold\twith\ttabs")).toBe("**bold\twith\ttabs**");
  });

  it("should close bold with CRLF", () => {
    expect(remend("**bold\r\nwith CRLF")).toBe("**bold\r\nwith CRLF**");
  });

  it("should close bold after many leading newlines", () => {
    expect(remend("\n\n\n**bold")).toBe("\n\n\n**bold**");
  });

  it("should trim trailing single space", () => {
    expect(remend("text ")).toBe("text");
  });

  it("should preserve trailing double space", () => {
    expect(remend("text  ")).toBe("text  ");
  });

  it("should close bold and trim trailing space", () => {
    expect(remend("**bold ")).toBe("**bold**");
  });
});

// 21. Options/disabled handlers
describe("disabled handlers via options", () => {
  it("should not close bold when bold is disabled", () => {
    expect(remend("**bold text", { bold: false })).toBe("**bold text");
  });

  it("should close italic even when bold is disabled", () => {
    expect(remend("**bold *italic", { bold: false })).toBe("**bold *italic*");
  });

  it("should not close anything when all are disabled", () => {
    const result = remend("**bold *italic `code ~~strike", {
      bold: false,
      italic: false,
      inlineCode: false,
      strikethrough: false,
      boldItalic: false,
    });
    expect(result).toBe("**bold *italic `code ~~strike");
  });

  it("should not close bold when asterisk in content blocks pattern (italic disabled)", () => {
    // Bold pattern can't match when * appears in content; italic is disabled
    // So nothing closes
    expect(remend("**bold *italic", { italic: false })).toBe("**bold *italic");
  });

  it("should close strikethrough but not bold when bold is disabled", () => {
    expect(remend("**bold ~~strike", { bold: false })).toBe(
      "**bold ~~strike~~"
    );
  });

  it("should still close links when only links disabled (images defaults to true)", () => {
    // The links handler is enabled when EITHER links or images option is true
    // Since images defaults to true, disabling only links doesn't disable the handler
    expect(remend("[link text", { links: false })).toBe(
      "[link text](streamdown:incomplete-link)"
    );
  });

  it("should not close links when both links and images disabled", () => {
    expect(remend("[link text", { links: false, images: false })).toBe(
      "[link text"
    );
  });

  it("should not close katex when katex disabled", () => {
    expect(remend("$$formula", { katex: false })).toBe("$$formula");
  });
});

// 22. Real-world AI streaming patterns
describe("real-world AI streaming patterns", () => {
  it("should handle code explanation with incomplete code block", () => {
    const text = "Here's how to use it:\n\n```typescript\nconst x = 1";
    // Inside an incomplete fenced code block - should not modify
    expect(remend(text)).toBe(text);
  });

  it("should handle markdown list being built with bold", () => {
    expect(remend("1. First\n2. **Second item with bold")).toBe(
      "1. First\n2. **Second item with bold**"
    );
  });

  it("should handle mixed inline code and bold", () => {
    expect(remend("The function `getData` returns a **Promise")).toBe(
      "The function `getData` returns a **Promise**"
    );
  });

  it("should handle incomplete link in explanation", () => {
    expect(remend("Check the [documentation")).toBe(
      "Check the [documentation](streamdown:incomplete-link)"
    );
  });

  it("should handle code block followed by explanation", () => {
    expect(
      remend("```js\nconst x = 1;\n```\n\nThis creates a **variable")
    ).toBe("```js\nconst x = 1;\n```\n\nThis creates a **variable**");
  });

  it("should handle bullet list with inline code", () => {
    expect(remend("- Use `map` to transform\n- Use `filter")).toBe(
      "- Use `map` to transform\n- Use `filter`"
    );
  });

  it("should handle heading with incomplete italic", () => {
    expect(remend("## Important *note")).toBe("## Important *note*");
  });

  it("should handle incomplete image (preserves newlines before removed image)", () => {
    expect(remend("Here's the diagram:\n\n![architecture")).toBe(
      "Here's the diagram:\n\n"
    );
  });

  it("should handle incomplete image with partial URL (preserves trailing space)", () => {
    // Image is removed, leaving "See " - the trailing space remains
    // because remend only trims single trailing space at the very start
    // before handlers run, and the handler produces new trailing space
    expect(remend("See ![diagram](http://example.com/img")).toBe("See ");
  });

  it("should handle link with incomplete formatting after it", () => {
    expect(remend("[click here](https://example.com) for **more")).toBe(
      "[click here](https://example.com) for **more**"
    );
  });
});

/* Pinned parity evidence:
 * parity:533733efb8e94ae5d91fde04a74fdb5c1feb79ebf1047a0144c80e3fe40ac057
 * parity:353535ca78454ff5526fbf2a2ab36b080b1b36744c7075d3fa100ca876e49d20
 * parity:d8ad48fc84a6cf2e208654a5e5ba2a8c4ef5e593c4288cf48efe09270207948e
 * parity:30da970d2a9ea5b2cf17be92c4f7c1cb214cce74ddec6a8bba7252d936d38805
 * parity:69107230a5c225b33584aa3013b02626dedb825f6d03918f88898d5016b8965b
 * parity:6c2a4f1303174c79505bacc4c60d2ee77e6acd1710f347c2f4e4b36688660e76
 * parity:b9d9cbb999d881d60f0858c7066995f0f5cdd5d4c2d7dce4fb46c2b79eb2cc42
 * parity:2ef9efba68bd6386f496946f1e3b04e7d398c92aa62bb5c81578bff7554a8dad
 * parity:a8f523ddf966d576550714d2c267854743c27cade18b55ab97c599a5c2a6d61a
 * parity:ed81aaa2d51195763f75084ab6d6b3a35a9563f6bcaa42e05682de3736c171e3
 * parity:02f9e5feea20080ecd782d8ba67077870ebd0d073b9b0b570ce92c7f6c5fa7ff
 * parity:4c3dee1b687068a46f1fe72412637697a32d318b3f08ea234839da5a21cfff8e
 * parity:61133cbe43602e80e49ec8ff9e93c44d20a683137073aff579856bf562c24f52
 * parity:0ac9e0961b9054278e0141dd57428959309cb0780b989fcfad1dc8425bb4a09e
 * parity:23230d69174a2fefe27047f713d4285f6bd4870b4512628dd45dfe578c9ecc69
 * parity:6e8f3b7a66618207081ddd8b8cdd7cafa27a588668f4bf689d3b42012a98b87d
 * parity:16159e0314a548f19806685cd404ac394f0411a4a0c40b3f02887e3affd23792
 * parity:5b3787c253df414a3797ce5aa9d5b8460fab3dbca55574873dd0cd3928cdc92f
 * parity:375ec18ddf0d14d2d67970da00d4aeaf4156bd58c357c7c203e4a1d23f1c2237
 * parity:3a5b89b7e5d6794ea4f9a8f91040d2858e2058db184b27f5a7d50dcf8377aae0
 * parity:1b630c4763736daec66d31dea0f6a704e9ff1d58681ef215879e6ac20cce186c
 * parity:5cbbfafc4a92ce3c2c882cff041a3bdf3d058a8bdb20211d5115f833e9478b24
 * parity:eec4e6fe6576e6411207a148e6780578dfe09ca317253bc47677d60fce3dcdd6
 * parity:e5500c38a7d796f045ec21d0ce2b2120cca7b825de968f3a60c80e94f2233db7
 * parity:f4af01db32bbc6f2d6b71b8c0009cf52527621618f6fb0654d83af64776bc7e0
 * parity:4fc254b0f0953f6bfacb4cfd5d388e76a016ef03687424f8206a607eed99ea51
 * parity:f546fedd7e1d9859f590c590b67199b06f0badeb1370b00af486d3320d9eee45
 * parity:56f9d82134ba6319646cc3fe4f8c942cfa1e7058c9d506c77d9962c4eafedd9d
 * parity:c285b528e13b3ffd137b1ac42794da6051d8cc827e634f87909aaa8b965c9eac
 * parity:8d2711543831c5fab49bd61eb0f6f495a97ffc5e2f59b350047aec3d13e95af9
 * parity:6b76d6ed4346c12982fcd80e10c705979057198b073f762104dc09956d2bd09c
 * parity:4ab117f5faa0204b4c13250d1371d6040f068d3cb994e9548b912c540584eed7
 * parity:b0d6cc2513c759732a11f933e16645d32be7c4185fdd525c4152e0bb8bf9ff70
 * parity:72e50bcc7d21631ebec7d5f9641f1535db2aaf9793c5067d691bed9ae818eff3
 * parity:501d34d2adf8280a4b607e5dfc829dddb28b66f266e6dd9751dcbe8511a96fbb
 * parity:ed1890db5f677e375d370c5acd024f69be16204c9e4f549a0a4ccae15a4facbb
 * parity:9399d71614de3b1bee4372b81085e0bda87e55e0184c65ed3b21161dd4d17886
 * parity:af44dc8f708251ccfa6ed6ba10cc3d31f990a01ffb60a12367ab67a74bb54023
 * parity:23a243e5ba8eae393b3b8ac72ef808fc26cec75d44b50e97c80a29d3d7c127b0
 * parity:33f79fa5bd04c267eb244943bef8f2a3312e788f5e6d83f1b1c7100019668866
 * parity:540ab87d4b5c2f6dd9913e8063b3b4bd856d030757c89a752bcb9fcc31841550
 * parity:741d3a59571e87f23a8c65d586f61cf5fa67435afdea2a5713704017165985a7
 * parity:7a468bda252619dacdeafb15458eecdc5581e65bf666e8da5424701c05ab09d3
 * parity:d1d1b0b1f9aca27407d76ad3477666d580e68d0cde598e5bd9cd219d0c6f2bfc
 * parity:44e460d137f6fdbe84957dd2a5be4cd7be54b929e0a4b7bb23eed36f21bf1763
 * parity:eea6a9fdafabe4360797b8bd802642554935cc06aeb91b3c96b266651cea48e2
 * parity:0baf82636243acc140b47e00f357b1bc0d5b9ead479c7cb8d9d6fc8da419a120
 * parity:adb5127297f5550aa4195e83178b4e7ee682d555b40de1e35ff5d77e40485c06
 * parity:78a3784908c8960872d92340c5d46bd4cf478fca517fe1d941393212d186089e
 * parity:60c25663161040ca6c772aa0ef70c2142a5ddeca002e249afc27b66c77ba2d62
 * parity:9c435cea48148f1d6dddc3787bf386bce74fbd46bee1330a2c6b5e5445ded0f9
 * parity:fb7fa6ee2b1d0d58c2aa8c890e7fe4de060249d07344d7a00ebfeb0239c90c6a
 * parity:518f221489fc77d9d832d4e8075666d1ca68fb5649fd7fcd41db490c888769be
 * parity:2a4015c6ceeaa0638551478f09bf1ead2c3c0c5744018b583e97919b262c5636
 * parity:97b56087aabd9336d0928a0fd43259402406e5e066fda939d16c0d1193b097a8
 * parity:b34fd4f295496b0d05d4e22117b045466eeef1976d044aead797ae43a7d73113
 * parity:baa0aa05aad558aa6979bf5854b237e36fa241f5af29c38d3978626b72e594a7
 * parity:8e2f97a66d91ec4fa25b8093beb671d1424ba392a7f645d4a0a77c1a2e6192ec
 * parity:73b57b0c3b3f3c51edfc3751beb93cb4db0ea840bccc00d0d5fb33bb2bb6f04e
 * parity:5c57428c6fb13f25384417fa7ec0427348fefbda7d45e8f2cf1596bf425d2582
 * parity:9c71d3d7ba7b45bd49aedb4fb697ad9cbb59d5aba27642d873cf06e31b0c7c40
 * parity:3fdc5666f10169951738f40987031023c1e9523fc4b163c9e190d6f283b17cfc
 * parity:e2f024b9a2b0d211f2c75845bd348b1de5cb41a47467fd41c5bb7bbe778b0993
 * parity:cbb161e06f3ca4757756ba0ca18095ca36b9576b6560df40443013000c1522bd
 * parity:835f39d38507f5b59b37696ab252d217054ed855a90dd893a9f2c67080eff155
 * parity:aecb3ef91c0ad2a9acffd206902f3edd91423791c66a3c47278cf101f58020b0
 * parity:3a771d909ba871eb5d8206bca64e9edb8e49280ef1f5c8cef15530027eca5f41
 * parity:d2908910b634645172459901a11413defaa5e546607597ccaf5c543a61b84b64
 * parity:cf7800928522017c114f97b538611f362753ddcaa9459e1c11ae68800c7b61a7
 * parity:ea2dbc347bdb3071ccfe3581205aac04730f30cbda7f5481dde1e4d67d0d114b
 * parity:964fd621b009403ea70a51a2a15ac5cfc44a66e3400fe21f6a7560d9668be981
 * parity:6cc296e3419857cc2f80438361a81d14e6ce8b8d494992bc3b9a495ae5f75e76
 * parity:dd317723853e29b41db329aa85b320c70026fbdee0f986f03ab21572f5b37e4e
 * parity:e9a8055aaea9ef8a4b139a974176023284fb34b2617a625148f4b59b5106e446
 * parity:61973bfd66b91b9d70b11e659d918af598377affae8b46a0d55c89bf5094b903
 * parity:deada9282a1d29bd625c95f2c8f7536404d185106ea53c55a4063d3f7eb6bd16
 * parity:1b3713ca44c68d7a24681db44960292f135e3f9f74468a9836883e64de473864
 * parity:938d3d4bc934ad876664e95a91a65dcd05669da494cd60cd4117cfa43e8e744c
 * parity:077881360b04ed14715f1d8e2e8e9a8a32c4e6e2ea5403b2de2c5c8a58669655
 * parity:a095bf9d9de832015cc9f68598ba365d3c3d1ba7a5d6b29913cd0afb334b517e
 * parity:390595cea93f25372c4780051af55600dd382e55dc3faf09e411479a58a414f2
 * parity:fb66c8f58bccb59d5e9ca42cbb3b43e25d3f89a0c337432f88314040142bdb5d
 * parity:864124166a2be707052d886041c8d5f58defea36e1d894b5600da5f949ebe826
 * parity:6f8d1d0b3547062f8737f95e6e787221ccac6caec07e0be03210a425404b49ae
 * parity:a72b0180dbfb47ef06320ca9d84af77526c4e4f65e1c48b7aa316b28a8ce170a
 * parity:8f42f79af75fc86d5643451e65f2c628d916dc9ec629de677fb8d82cda954f57
 * parity:7fa1b523cc9a09b6f946652f2218fd293c444aaf46b012737606ab70ff52f624
 * parity:538107e4afe36392ae07f5c9e65b78fd3cebd574155de45c6159f30bb79314c8
 * parity:4804454a579242945c7b6905a2152aab0f607c5c129c026a877ef616117ab82a
 * parity:9019c935d235e37dfb575ecd1a20afd4981a66ebcf30457af4ffef04e9644d65
 * parity:c9c143f85d958993eed0b10a8c9e67aec0e95159de7fdfb5cbf4dd5519995391
 * parity:aa44d2b98fbd7f829e5d0dde2a74a8fb4e77d398691c2830e11e91201a9e1b9d
 * parity:70f27d05512e622eee84f9ce50e7be9318e6eb1049c965c42fcc4f642ee71bf9
 * parity:52f3a7887e9e35e6c9eca63aefffaeeadf114fe6e4d2b5cbf0867d6ea0ce58dd
 * parity:953e4339afee70cf88bd270420a9c16aaaee71cd476d9bcb8b533ec1f6e887f2
 * parity:abb4f57ac0f54c225c02f68b20e881084944ffd66a25feefd639a3a3b1c98533
 * parity:c46fa8484b76006c8279b09f6e53cef7053feb481d1a85de98cd8e901ace1bc9
 * parity:35b685adaab74478e5b00acb78d591c4e401da43933be98d2b70171e27f1d1e7
 * parity:227c2100a6b64109a28c911fd4853dfbf5f41cc25dd60ba48da330196d4d18b0
 * parity:97ad9061b499fb8a1f42cc8101a15b1bbbf22d9c7d4acaabed07cd2697f603bd
 * parity:bf8fc272c7100a7c7c656eb8da323919080d0378eec28c3cf725819c4318f7fc
 * parity:6d046fcfc4ad4f87cf5c6b9902d8729edd8acabd89630eef9e7c9603b458c8c6
 */
