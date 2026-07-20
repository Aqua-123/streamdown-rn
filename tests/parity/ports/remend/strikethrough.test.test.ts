import remend from "remend";

describe("strikethrough formatting (~~)", () => {
  it("should complete incomplete strikethrough", () => {
    expect(remend("Text with ~~strike")).toBe("Text with ~~strike~~");
    expect(remend("~~incomplete")).toBe("~~incomplete~~");
  });

  it("should keep complete strikethrough unchanged", () => {
    const text = "Text with ~~strikethrough text~~";
    expect(remend(text)).toBe(text);
  });

  it("should handle multiple strikethrough sections", () => {
    const text = "~~strike1~~ and ~~strike2~~";
    expect(remend(text)).toBe(text);
  });

  it("should complete odd number of strikethrough markers", () => {
    expect(remend("~~first~~ and ~~second")).toBe("~~first~~ and ~~second~~");
  });

  it("should complete half-complete ~~ closing marker (#313)", () => {
    // When streaming ~~strike~~, the closing marker arrives char by char
    // ~~strike~ is a half-complete closing marker
    expect(remend("~~xxx~")).toBe("~~xxx~~");
    expect(remend("~~strike text~")).toBe("~~strike text~~");
    expect(remend("Text with ~~strike~")).toBe("Text with ~~strike~~");
    expect(remend("This is ~~strikethrough~")).toBe(
      "This is ~~strikethrough~~"
    );
  });
});

/* Pinned parity evidence:
 * parity:a973ff2ebf8c439583c4ed882efe2fdd7eba6cb500022979916a4ed711b7868b
 * parity:526bd98465d5087bad5dbd1a53c6e6a27a87932ef8a810b2de3a0efd14ef6311
 * parity:b22e2b837d3e9d4dce075f908dca47e6bc152f3d98040c4006b835c599213e05
 * parity:90a0520be2a8ea0191887f048e8c861975f97c28d61d0a87aa9eef0bbf155106
 * parity:38deba30bef8bb52a832c922756c13ee4f999b3927dc50d0a27c5260404da616
 */
