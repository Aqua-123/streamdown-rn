import remend from "remend";

describe("bold formatting (**)", () => {
  // parity:59746681b57d383285a1978520bc8463b19fe57467511c98e602559ad50a0e90
  it("should complete incomplete bold formatting", () => {
    expect(remend("Text with **bold")).toBe("Text with **bold**");
    expect(remend("**incomplete")).toBe("**incomplete**");
  });

  // parity:d735b8803ce444650bb61497e1aa1ef34d062d0cd6dd4b673567c8db2a9ab3ee
  it("should keep complete bold formatting unchanged", () => {
    const text = "Text with **bold text**";
    expect(remend(text)).toBe(text);
  });

  // parity:49929ccac747284c32882e1de7a09ea87ab5ce0d56f6d43c659b46a404cc5f67
  it("should handle multiple bold sections", () => {
    const text = "**bold1** and **bold2**";
    expect(remend(text)).toBe(text);
  });

  // parity:11818dcb54b20b114fd5e1da351f522837bd39662ba5d5b83be78bbd015bdd2b
  it("should complete odd number of bold markers", () => {
    expect(remend("**first** and **second")).toBe("**first** and **second**");
  });

  // parity:d247c765d0913a97b42c3d3c1f89c6fecfa4e1676f4908835969dff8a38c19de
  it("should handle partial bold text at chunk boundary", () => {
    expect(remend("Here is some **bold tex")).toBe("Here is some **bold tex**");
  });

  // parity:63ac1f0857b6f6ffd70848b0e6ea4698c76dbfcd0a4e94913676be7bbfe9748e
  it("should complete half-complete bold closing marker (#313)", () => {
    // When streaming **bold**, the closing marker arrives char by char
    // **bold text* is a half-complete closing marker, not bold+asterisk
    expect(remend("**xxx*")).toBe("**xxx**");
    expect(remend("**bold text*")).toBe("**bold text**");
    expect(remend("Text with **bold*")).toBe("Text with **bold**");
    expect(remend("This is **bold text*")).toBe("This is **bold text**");
  });
});
