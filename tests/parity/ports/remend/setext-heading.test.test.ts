import remend from "remend";

describe("setext heading handling", () => {
  it("should prevent partial list items from being interpreted as setext headings", () => {
    // The exact issue reported - single dash after text
    const text = "here is a list\n-";
    const result = remend(text);
    // Should add a zero-width space to break the setext heading pattern
    expect(result).toBe("here is a list\n-\u200B");
  });

  it("should handle double dash that could be setext heading", () => {
    const text = "Some text\n--";
    const result = remend(text);
    expect(result).toBe("Some text\n--\u200B");
  });

  it("should handle single equals that could be setext heading", () => {
    const text = "Some text\n=";
    const result = remend(text);
    expect(result).toBe("Some text\n=\u200B");
  });

  it("should handle double equals that could be setext heading", () => {
    const text = "Some text\n==";
    const result = remend(text);
    expect(result).toBe("Some text\n==\u200B");
  });

  it("should NOT modify valid horizontal rules with three dashes", () => {
    const text = "Some text\n---";
    const result = remend(text);
    // Three dashes is a valid horizontal rule, don't modify
    expect(result).toBe("Some text\n---");
  });

  it("should NOT modify valid setext headings with three equals", () => {
    const text = "Heading\n===";
    const result = remend(text);
    // Three equals is a valid setext heading, don't modify
    expect(result).toBe("Heading\n===");
  });

  it("should NOT modify when there's no previous content", () => {
    // No previous line means it can't be a setext heading
    const text = "-";
    const result = remend(text);
    expect(result).toBe("-");
  });

  it("should NOT modify when previous line is empty", () => {
    const text = "\n-";
    const result = remend(text);
    expect(result).toBe("\n-");
  });

  it("should handle the streaming list scenario", () => {
    // Simulate streaming where list items come in one by one
    const scenarios = [
      { input: "here is a list\n-", expected: "here is a list\n-\u200B" },
      { input: "here is a list\n- ", expected: "here is a list\n-\u200B" }, // Trailing space removed, then zero-width joiner added
      {
        input: "here is a list\n- list item 1",
        expected: "here is a list\n- list item 1",
      },
    ];

    for (const { input, expected } of scenarios) {
      expect(remend(input)).toBe(expected);
    }
  });

  it("should handle multiple lines with potential setext heading at end", () => {
    const text = "Line 1\nLine 2\nLine 3\n-";
    const result = remend(text);
    expect(result).toBe("Line 1\nLine 2\nLine 3\n-\u200B");
  });

  it("should handle text with whitespace before dash", () => {
    const text = "Some text\n  -";
    const result = remend(text);
    // Even with leading whitespace, it could be interpreted as setext heading
    expect(result).toBe("Some text\n  -\u200B");
  });

  it("should NOT modify complete list items", () => {
    const text = "Some text\n- Item 1\n- Item 2";
    const result = remend(text);
    expect(result).toBe(text);
  });

  it("should NOT modify when last line has other characters", () => {
    const text = "Some text\n-x";
    const result = remend(text);
    // Not a setext heading pattern
    expect(result).toBe(text);
  });

  it("should handle four or more dashes (horizontal rule)", () => {
    const text = "Some text\n----";
    const result = remend(text);
    // Four dashes is a horizontal rule, don't modify
    expect(result).toBe(text);
  });

  it("should handle mixed whitespace and dashes", () => {
    const text = "Some text\n- ";
    const result = remend(text);
    // Trailing single space is removed, then zero-width joiner is added to prevent setext heading interpretation
    expect(result).toBe("Some text\n-\u200B");
  });

  it("should handle the original issue example precisely", () => {
    // Original issue: "here is a list\n-" gets interpreted as heading
    const streaming1 = remend("here is a list");
    expect(streaming1).toBe("here is a list");

    const streaming2 = remend("here is a list\n");
    expect(streaming2).toBe("here is a list\n");

    const streaming3 = remend("here is a list\n-");
    // This should add a zero-width space to prevent setext heading
    expect(streaming3).toBe("here is a list\n-\u200B");

    const streaming4 = remend("here is a list\n- list item 1");
    expect(streaming4).toBe("here is a list\n- list item 1");
  });

  it("should handle setext heading with equals signs during streaming", () => {
    const streaming1 = remend("This is a title\n=");
    expect(streaming1).toBe("This is a title\n=\u200B");

    const streaming2 = remend("This is a title\n==");
    expect(streaming2).toBe("This is a title\n==\u200B");

    const streaming3 = remend("This is a title\n===");
    // Three equals is valid setext heading (H1), don't modify
    expect(streaming3).toBe("This is a title\n===");
  });

  it("should not interfere with other markdown syntax", () => {
    // Make sure we don't break other markdown features
    const text1 = "**bold text**\n-";
    expect(remend(text1)).toBe("**bold text**\n-\u200B");

    const text2 = "*italic text*\n-";
    expect(remend(text2)).toBe("*italic text*\n-\u200B");

    const text3 = "`code`\n-";
    expect(remend(text3)).toBe("`code`\n-\u200B");
  });

  it("should handle multiple potential setext headings in sequence", () => {
    // Only the last line matters for setext heading detection
    const text = "Text 1\n-\nText 2\n-";
    const result = remend(text);
    // Only the final "-" should be modified
    expect(result).toBe("Text 1\n-\nText 2\n-\u200B");
  });
});

/* Pinned parity evidence:
 * parity:e9e5602eedd2ecbbed618dda29418e3b4c859fd46b3643bec4e790ab70bbc107
 * parity:7b74b722f559169f162cb3b1e8736b0631d920271bb5523f21a14f89d6fa3677
 * parity:d0fd499a3d5971cfd8a99de1abff35bb2b4bea38919f2638546eaedfcfe7aef6
 * parity:c3a5f636bdca9890308254b0899d6a02e22452b6cffb95bc60e3174ecbb562fa
 * parity:f00113a787fe2abc2754d3b53a306e478732b9cc19dfdc4187d4312412157f24
 * parity:2a3f56c675f351ca33b9214a48b71484635d5d34f14770c1f162ade10c6cc289
 * parity:fc6df75442fbc0e9fd0f4af1c48f5e990025016d042f156c62251f51e9524906
 * parity:6a36d9de009905fceb355c97eda0f0ae8600e3cd03c961a0ad340348025130f3
 * parity:aa6e3fef3139dcdb8d4febac1adcc4ac574317e07f6ea703e515636e59a05c1b
 * parity:6326c76383f8a8600fd5b66222538412d94343653ce82b2e9a6d38675f9c397e
 * parity:c1f5d6792ceac4c989a5869d068ab3067ea9286d22f4340052af44fa3538f948
 * parity:050dc96358e6d05ccbde3df9d289220fd90b39ecb09696aa590d118679dba7d4
 * parity:720d6d48b3a5d27ba21197784c962873fa9234f554639991371ae6d39f6a1008
 * parity:2a03cd2a55d5be51602f0b06c66ba79b2210fdde0c07198d8cd8aefffa04e790
 * parity:ac9577d5832612c548ac844d8191437f5cae8ff29182d0fac79e2f43f2fbcab5
 * parity:fc520912a0bcb8dbe9ce1eba0d75677ef938a8a3c278fcbe858858263f35baae
 * parity:bd3e2036351bf1e77d261952e259181faed8a403afc2632cec0becb62ee92d93
 * parity:28f011afd0ead86e95045757afbae900b4e1779f85d5bfea1a6a9a6e79d0b547
 * parity:95612121aaea54bcdef148bd8ef1c945898b1d265bb21aee49ac676ba6293bec
 */
