import remend from "remend";

describe("link handling", () => {
  // parity:e7e4c82ce1ef76c9a5a72130db366ee0111bcd3d229d0a94b5cf0a381264c23f
  it("should preserve incomplete links with special marker", () => {
    expect(remend("Text with [incomplete link")).toBe(
      "Text with [incomplete link](streamdown:incomplete-link)"
    );
    expect(remend("Text [partial")).toBe(
      "Text [partial](streamdown:incomplete-link)"
    );
  });

  // parity:7a8e53ce65c4c0b49c892dcf80c5e239b85c8f15130b193b069cfb71e8b25287
  // parity:315101f413c6d6b237adbb9fd454ef982c8f0caaa17fbd9db05b987fcc1bb457
  it("should keep complete links unchanged", () => {
    const text = "Text with [complete link](url)";
    expect(remend(text)).toBe(text);
  });

  // parity:9c81a7384eb2a32e4a1fbd250d09b7c6620af9d7c9f37f13ae57ab1dc8679f88
  // parity:93f9534ec67d52c50e26b211d30949c34eda6d48fa578324ff32f48fcb5f1857
  it("should handle multiple complete links", () => {
    const text = "[link1](url1) and [link2](url2)";
    expect(remend(text)).toBe(text);
  });

  // parity:cf4e5a4775e8d1e3a31ef74d67d9fc3a31d7db06870274331159e041a378328e
  // parity:5178081ab774042551409d1ef04aa58d2ef7b8611a34dd4b147a1aa453967660
  it("should handle nested brackets in incomplete links", () => {
    // Test case for nested brackets - this would have caught the bracketDepth bug
    expect(remend("[outer [nested] text](incomplete")).toBe(
      "[outer [nested] text](streamdown:incomplete-link)"
    );

    expect(remend("[link with [inner] content](http://incomplete")).toBe(
      "[link with [inner] content](streamdown:incomplete-link)"
    );

    expect(remend("Text [foo [bar] baz](")).toBe(
      "Text [foo [bar] baz](streamdown:incomplete-link)"
    );
  });

  // parity:a98b24fc621548ba83d0216e57806eb3e20d7f17962a39bce9aeb522da5e94e2
  it("should handle nested brackets in complete links", () => {
    const text = "[link with [brackets] inside](https://example.com)";
    expect(remend(text)).toBe(text);
  });

  // parity:54746160ce89fd7cbba650ae82661ba9e42d9e47a1077fad1ff538157f5c3da5
  it("should handle partial link at chunk boundary - #165", () => {
    expect(remend("Check out [this lin")).toBe(
      "Check out [this lin](streamdown:incomplete-link)"
    );
    // Links with partial URLs should now be completed with placeholder
    expect(remend("Visit [our site](https://exa")).toBe(
      "Visit [our site](streamdown:incomplete-link)"
    );
  });

  // parity:ca6d7a98cac1cd7ca6e74718ad84406b6d095a016504b9d324c076afcef5cef2
  // parity:755c3e2c5e59ea073afaaf95bb69689c8fb8d7992fd50d63574ad31f0409f093
  it("should handle nested brackets without matching closing bracket", () => {
    // Case where there's an opening bracket with nested structure but no proper closing
    expect(remend("Text [outer [inner")).toBe(
      "Text [outer [inner](streamdown:incomplete-link)"
    );
    expect(remend("[foo [bar [baz")).toBe(
      "[foo [bar [baz](streamdown:incomplete-link)"
    );

    // Test lines 82-83: link (not image) where findMatchingClosingBracket returns -1
    // This happens when there's a [ with ] in text but improper nesting
    expect(remend("Text [outer [inner]")).toBe(
      "Text [outer [inner]](streamdown:incomplete-link)"
    );
    expect(remend("[link [nested] text")).toBe(
      "[link [nested] text](streamdown:incomplete-link)"
    );
  });
});

describe("link handling with linkMode: text-only", () => {
  const textOnlyOptions = { linkMode: "text-only" as const };

  // parity:ac9a6e294588903976d42d2af136d664d2bf4a3270670fa9df26f471c6be6d36
  it("should show plain text for incomplete links", () => {
    expect(remend("Text with [incomplete link", textOnlyOptions)).toBe(
      "Text with incomplete link"
    );
    expect(remend("Text [partial", textOnlyOptions)).toBe("Text partial");
  });

  it("should keep complete links unchanged", () => {
    const text = "Text with [complete link](url)";
    expect(remend(text, textOnlyOptions)).toBe(text);
  });

  it("should handle multiple complete links", () => {
    const text = "[link1](url1) and [link2](url2)";
    expect(remend(text, textOnlyOptions)).toBe(text);
  });

  it("should handle nested brackets in incomplete links", () => {
    expect(remend("[outer [nested] text](incomplete", textOnlyOptions)).toBe(
      "outer [nested] text"
    );

    expect(
      remend("[link with [inner] content](http://incomplete", textOnlyOptions)
    ).toBe("link with [inner] content");

    expect(remend("Text [foo [bar] baz](", textOnlyOptions)).toBe(
      "Text foo [bar] baz"
    );
  });

  // parity:cb0b974945e2670ba9002ee34fb94f2fe10603b054c458498edf25cb96476381
  it("should handle partial link at chunk boundary", () => {
    expect(remend("Check out [this lin", textOnlyOptions)).toBe(
      "Check out this lin"
    );
    expect(remend("Visit [our site](https://exa", textOnlyOptions)).toBe(
      "Visit our site"
    );
  });

  it("should handle nested brackets without matching closing bracket", () => {
    expect(remend("Text [outer [inner", textOnlyOptions)).toBe(
      "Text outer [inner"
    );
    expect(remend("[foo [bar [baz", textOnlyOptions)).toBe("foo [bar [baz");
    expect(remend("Text [outer [inner]", textOnlyOptions)).toBe(
      "Text outer [inner]"
    );
    expect(remend("[link [nested] text", textOnlyOptions)).toBe(
      "link [nested] text"
    );
  });

  // parity:1841ebeffbb027e46415986e11c82ea0faa4715f3943bc9b36158a33047ffeb7
  it("should still remove incomplete images", () => {
    // Images should still be removed entirely, regardless of linkMode
    // Note: the space before the image is preserved
    expect(remend("Text ![incomplete image", textOnlyOptions)).toBe("Text ");
    expect(remend("Text ![alt](http://partial", textOnlyOptions)).toBe("Text ");
  });
});
