import remend from "remend";

describe("comparison operators in list items (#376)", () => {
  it("should escape > followed by a digit in dash list items", () => {
    expect(remend("- > 25: rich")).toBe("- \\> 25: rich");
  });

  it("should escape > followed by a digit in asterisk list items", () => {
    expect(remend("* > 25: rich")).toBe("* \\> 25: rich");
  });

  it("should escape > followed by a digit in plus list items", () => {
    expect(remend("+ > 25: rich")).toBe("+ \\> 25: rich");
  });

  it("should escape > in ordered list items", () => {
    expect(remend("1. > 25: rich")).toBe("1. \\> 25: rich");
    expect(remend("2) > 10: high")).toBe("2) \\> 10: high");
  });

  it("should escape > in indented (nested) list items", () => {
    expect(remend("  - > 25: rich")).toBe("  - \\> 25: rich");
    expect(remend("    - > 5: expensive")).toBe("    - \\> 5: expensive");
  });

  it("should escape >= comparison operators", () => {
    expect(remend("- >= 10: high")).toBe("- \\>= 10: high");
  });

  it("should escape > before dollar amounts", () => {
    expect(remend("- > $100: expensive")).toBe("- \\> $100: expensive");
  });

  it("should handle the issue example correctly", () => {
    const input = [
      "- < 10: potentially cheap.",
      "- 10–20: reasonable/normal zone.",
      "- > 25–30: rich; you need strong growth + quality to justify.",
    ].join("\n");

    const expected = [
      "- < 10: potentially cheap.",
      "- 10–20: reasonable/normal zone.",
      "- \\> 25–30: rich; you need strong growth + quality to justify.",
    ].join("\n");

    expect(remend(input)).toBe(expected);
  });

  it("should handle multiple comparison operators in a list", () => {
    const input = ["- > 5: expensive", "- > 25: very expensive"].join("\n");

    const expected = ["- \\> 5: expensive", "- \\> 25: very expensive"].join(
      "\n"
    );

    expect(remend(input)).toBe(expected);
  });

  it("should not escape > in actual blockquotes (no list marker)", () => {
    expect(remend("> Some blockquote")).toBe("> Some blockquote");
    expect(remend("> 25 is a number")).toBe("> 25 is a number");
  });

  it("should not escape > when followed by non-digit text", () => {
    expect(remend("- > Some quoted text")).toBe("- > Some quoted text");
    expect(remend("- > Read more about this")).toBe("- > Read more about this");
  });

  it("should not escape > without a space before digit (no list marker)", () => {
    expect(remend(">25")).toBe(">25");
  });

  it("should not escape > inside code blocks", () => {
    const input = "```\n- > 25: in code\n```";
    expect(remend(input)).toBe(input);
  });

  it("should handle > with no space before digit in list items", () => {
    expect(remend("- >25: rich")).toBe("- \\>25: rich");
  });

  it("should be disabled when comparisonOperators option is false", () => {
    expect(remend("- > 25: rich", { comparisonOperators: false })).toBe(
      "- > 25: rich"
    );
  });

  it("should work alongside other remend handlers", () => {
    const input = "- > 25: **bold";
    const result = remend(input);
    expect(result).toBe("- \\> 25: **bold**");
  });

  it("should handle the full issue example with nested lists", () => {
    const input = [
      "*P/E*",
      "  - < 10: potentially cheap.",
      "  - 10–20: reasonable/normal zone.",
      "  - > 25–30: rich; you need strong growth.",
      "",
      "*P/S*",
      "  - < 1: often cheap for mature businesses.",
      "  - 1–3: okay range.",
      "  - > 5: expensive unless high-margin.",
    ].join("\n");

    const expected = [
      "*P/E*",
      "  - < 10: potentially cheap.",
      "  - 10–20: reasonable/normal zone.",
      "  - \\> 25–30: rich; you need strong growth.",
      "",
      "*P/S*",
      "  - < 1: often cheap for mature businesses.",
      "  - 1–3: okay range.",
      "  - \\> 5: expensive unless high-margin.",
    ].join("\n");

    expect(remend(input)).toBe(expected);
  });
});

/* Pinned parity evidence:
 * parity:a5f0a47ac230687e6820cb8ec618e500451de4d68e1d9dd22c26655fa4c06940
 * parity:3f5f49e8de1f70529e7dab183718e89ca2cce428c0ce829b64e7fcc37a65194a
 * parity:da9dd0ab534dc1ec3012aa3cf0184ab6f35ac903d4f58c7651accaaf5a621e28
 * parity:fd202ef3cfc4211412a7f06ad4be7df3f6511606f534efb486870e7a3aa6ef90
 * parity:b9d511b362fcd1096348e01b0a090a97f695429e7b5dae22029ac5532bef4814
 * parity:ea72941987f784f34345c18e2ebdbe9be719e92cd7305739b5f2a81910b125cd
 * parity:1bc68b127449aeadb9598813f19676f7d3cc4d79754cd61d03daa1dc312b894e
 * parity:3239accf2e37e57fc8ef867f9bf00af4160e914359d9e82400e94c895c0b0d6b
 * parity:dbe214f8488c128df2afc5958c6487a18dcf07972b8f29c2c56ba1714d6448fd
 * parity:8d954859ec642fc1b1958e552e77a1a39b54318c35aba9ab5c679e7bfb9f40fc
 * parity:65aae3c732ff33b28a8e1a4f02fbf96c71cd5556567bb2413b39de242c6bc10a
 * parity:f046bfb24ed7381c7e1d546a5a783144a511b1b8eda475a0614baddd8a7726a8
 * parity:01e8c79443d4898acc025d85c34e57e9727540d79da4a735b37d80e399758e7f
 * parity:4a451f7723b5e5d49ad79ca0a7587fecafb687ed89e54720d17fe9c96cd994fb
 * parity:2a40a59c21ac4d6eefc367579c3965643d0698ae83e0c9ded2e5e52c0c839ce6
 * parity:99f7c3097bac94c3cfffed49c652cc6b40bec4a7f0a87e2bb8ed1585a613a5a2
 * parity:bbbb94aa7cf010cafc0d91b4893e65039b4868861a1ba23f601b518a414d2a9a
 */
