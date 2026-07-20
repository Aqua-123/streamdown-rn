import remend from "remend";

describe("image handling", () => {
  it("should remove incomplete images", () => {
    expect(remend("Text with ![incomplete image")).toBe("Text with ");
    expect(remend("![partial")).toBe("");
  });

  it("should keep complete images unchanged", () => {
    const text = "Text with ![alt text](image.png)";
    expect(remend(text)).toBe(text);
  });

  it("should handle partial image at chunk boundary", () => {
    expect(remend("See ![the diag")).toBe("See ");
    // Images with partial URLs should be removed (images can't show skeleton)
    expect(remend("![logo](./assets/log")).toBe("");
  });

  it("should handle nested brackets in incomplete images", () => {
    // When findMatchingClosingBracket returns -1 for an image (lines 74-79)
    // For this to happen, we need an opening bracket with a ] but no proper matching
    expect(remend("Text ![outer [inner]")).toBe("Text ");
    expect(remend("![nested [brackets] text")).toBe("");
    expect(remend("Start ![foo [bar] baz")).toBe("Start ");
  });

  it("should not add trailing underscore for images with underscores in URL (#284)", () => {
    const markdown =
      "textContent ![image](https://img.alicdn.com/imgextra/i4/6000000003603/O1CN01ApW8bQ1cUE8LduPra_!!6000000003603-2-skyky.png)";
    expect(remend(markdown)).toBe(markdown);

    // Should also work with links containing underscores
    const linkMarkdown =
      "textContent [link](https://example.com/path_name!!test)";
    expect(remend(linkMarkdown)).toBe(linkMarkdown);

    // Multiple images should also work
    const multipleImages =
      "textContent ![image1](https://example.com/path_1!!test.png) ![image2](https://example.com/path_2!!test.png)";
    expect(remend(multipleImages)).toBe(multipleImages);
  });
});

/* Pinned parity evidence:
 * parity:404661f0a88a543917a77b639b58c953d1d07a9b261afcd5dad634835722d5ff
 * parity:f2e35e6ff0091dce830d960cc2e2a0126e65f608b07d7636e1c5da9b0fa21bce
 * parity:2768dd3761a0f00c3e69f3b4ef54355112014e044b8c728e0b31c400e98335d6
 * parity:674eeb171158900cdabb34bc305ad092d88f70b53146a03cc69f84a91299aca6
 * parity:384779e8998571327911b5df3f705d4398a4b6dbac0356cf056a6e0713cd8183
 */
