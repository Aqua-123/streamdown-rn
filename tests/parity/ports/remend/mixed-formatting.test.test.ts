import remend from "remend";

describe("mixed formatting", () => {
  it("should handle multiple formatting types", () => {
    const text = "**bold** and *italic* and `code` and ~~strike~~";
    expect(remend(text)).toBe(text);
  });

  it("should complete multiple incomplete formats", () => {
    expect(remend("**bold and *italic")).toBe("**bold and *italic*");
  });

  it("should handle nested formatting", () => {
    const text = "**bold with *italic* inside**";
    expect(remend(text)).toBe(text);
  });

  it("should prioritize link/image preservation over formatting completion", () => {
    expect(remend("Text with [link and **bold")).toBe(
      "Text with [link and **bold](streamdown:incomplete-link)"
    );
  });

  it("should handle complex real-world markdown", () => {
    const text =
      "# Heading\n\n**Bold text** with *italic* and `code`.\n\n- List item\n- Another item with ~~strike~~";
    expect(remend(text)).toBe(text);
  });

  it("should handle bold inside italic", () => {
    expect(remend("*italic with **bold")).toBe("*italic with **bold***");
  });

  it("should handle code inside bold", () => {
    // Bold gets closed first, then code
    expect(remend("**bold with `code")).toBe("**bold with `code**`");
  });

  it("should handle strikethrough with other formatting", () => {
    // Both formats get closed
    expect(remend("~~strike with **bold")).toBe("~~strike with **bold**~~");
  });

  it("should handle dollar sign inside other formatting", () => {
    // Bold gets closed, dollar sign stays as-is (likely currency)
    expect(remend("**bold with $x^2")).toBe("**bold with $x^2**");
  });

  it("should handle deeply nested incomplete formatting", () => {
    // Formats are closed in the order they're processed.
    // The ~~ isn't closed because it ends up inside the completed inline code span (`code ~~strike`),
    // so remend correctly leaves it alone.
    expect(remend("**bold *italic `code ~~strike")).toBe(
      "**bold *italic `code ~~strike*`"
    );
  });

  it("should preserve complete nested formatting", () => {
    const text = "**bold *italic* text** and `code`";
    expect(remend(text)).toBe(text);
  });

  it("should handle mixed bold-italic formatting (#265)", () => {
    expect(remend("**bold and *bold-italic***")).toBe(
      "**bold and *bold-italic***"
    );
  });

  it("should close nested underscore italic before bold (#302)", () => {
    // When _ opens after **, the _ should close before ** (proper nesting)
    expect(remend("combined **_bold and italic")).toBe(
      "combined **_bold and italic_**"
    );
    expect(remend("**_text")).toBe("**_text_**");
    // When _ opens before **, the ** should close first (it's nested inside)
    expect(remend("_italic and **bold")).toBe("_italic and **bold**_");
  });
});

/* Pinned parity evidence:
 * parity:519fb31dc432a0800619ae5dd48fe14e044045d9d2c510b51668d28d7c6298c3
 * parity:b28e9c01de1f56b3952004fb5e9680f4f0e9816d014058fdf5dbdd346049dff6
 * parity:43f2a2c6a65dbcfc22e2af6b780fad5ac6189d4f4f5437e944625baa5c37c2ab
 * parity:26f2ab18c8fe12833190517ba166f7760f76a5e249840eb43a9551791c157cc5
 * parity:0cf53a89013549916d8829c143c311e0a5a2a2297ca1c802088a343184ced2b6
 * parity:ad811a23acbcc82b3a72ae0446c3a444b80d1627fce7cf9a2804a038eca6c2b6
 * parity:cce89e1343f23b4354075ab56eddefac3eb91f4b41dcbe8d53da104d1351d6fa
 * parity:7fd30240f71375c1429827cbb94bc718d3f338a4bd213467acf743050c4e197d
 * parity:de97d74e178a5fb571fd4f71232d7e4f8b617a23a50956e4a04ee5b8365cc1b0
 * parity:cad0b8aa65c1c3721fcab94959947551f5ff7dad30045ebae4aed4ace0fb2681
 * parity:61a492d2c53c7f4018cdeaa04d7dcc688eccc59a97fb3ae1401eb0dac8325815
 * parity:b19c1e5a6db26e25f6736562e40f2bf1828a3e0e207979ae14bb0765b56f6b64
 * parity:47201287d2d6be0fa43b1744dce26c046b5b649567df5ce1ed31a415009df81a
 */
