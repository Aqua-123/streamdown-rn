import remend from "remend";

describe("KaTeX block formatting ($$)", () => {
  // parity:d886fe464e1b53d99b4775d5a1dec86b7b3f160d3080663e7f0dd367be84928f
  it("should complete incomplete block KaTeX", () => {
    expect(remend("Text with $$formula")).toBe("Text with $$formula$$");
    expect(remend("$$incomplete")).toBe("$$incomplete$$");
  });

  // parity:5e3b68ad0ddf8e23cff6a63ecb6241564e056c32ee4d9cec09786e5041dc6a77
  it("should keep complete block KaTeX unchanged", () => {
    const text = "Text with $$E = mc^2$$";
    expect(remend(text)).toBe(text);
  });

  // parity:d08c24ca05fe173123b1815eabefed3beea0016f8e2316ed08ede07ac160076e
  it("should handle multiple block KaTeX sections", () => {
    const text = "$$formula1$$ and $$formula2$$";
    expect(remend(text)).toBe(text);
  });

  // parity:44ff12a5faa83e6b7e159d5ae7590e136fa4efbb7e9d905d9c3a770602648896
  it("should complete odd number of block KaTeX markers", () => {
    expect(remend("$$first$$ and $$second")).toBe("$$first$$ and $$second$$");
  });

  // parity:7d970ba14c92abd87fa2e691053f7c5e24baad354410cf841dfcf0efc9bc0e89
  it("should handle block KaTeX at start of text", () => {
    expect(remend("$$x + y = z")).toBe("$$x + y = z$$");
  });

  // parity:b452aacc38f22b81de3675347bec707b7a3fbf5e2b62ac500edd8325de8a0aa6
  it("should complete partial closing $ without duplicating it", () => {
    // Streaming $$formula$$ cut off mid-close: block katex should produce $$formula$$
    // not $$formula$$$ (which would then cause inline katex to append another $)
    expect(remend("$$formula$")).toBe("$$formula$$");
    expect(remend("$$x = y$")).toBe("$$x = y$$");
  });

  // parity:18a354138347f088f258201418cb666d948b87efd68e22f6859537851206eb58
  it("should handle multiline block KaTeX", () => {
    expect(remend("$$\nx = 1\ny = 2")).toBe("$$\nx = 1\ny = 2\n$$");
  });
});

describe("KaTeX inline formatting ($)", () => {
  // parity:a037a7ccc55ba046dd6542a2d8226b046b6b959d31f6199b6b8a01d6d60896f2
  it("should NOT complete single dollar signs (likely currency)", () => {
    // Single dollar signs are likely currency, not math
    expect(remend("Text with $formula")).toBe("Text with $formula");
    expect(remend("$incomplete")).toBe("$incomplete");
  });

  // parity:85eac85e91b579a30d33318d1bbe2e1ed631b95b7d78978a3fefe73f36f328fc
  it("should keep text with paired dollar signs unchanged", () => {
    // Even paired dollar signs are preserved but not treated as math
    const text = "Text with $x^2 + y^2 = z^2$";
    expect(remend(text)).toBe(text);
  });

  // parity:7d52e636f9767bfb480f32ea9173b86fa23bb75bc6c6020f099a0e0503e10c13
  it("should handle multiple inline KaTeX sections", () => {
    const text = "$a = 1$ and $b = 2$";
    expect(remend(text)).toBe(text);
  });

  // parity:990f0e4793e22fb65ab5b82e5d75855d755c337b322f4b6182e09c56a3f27c70
  it("should NOT complete odd number of dollar signs", () => {
    // We don't auto-complete dollar signs anymore
    expect(remend("$first$ and $second")).toBe("$first$ and $second");
  });

  // parity:a4ffb6268adbdd5718b6a23d8c2cd18265801a9a30204cab41d7f8e37b5e3a83
  it("should not complete single $ but should complete block $$", () => {
    // Block math $$ is completed, single $ is not
    expect(remend("$$block$$ and $inline")).toBe("$$block$$ and $inline");
  });

  // parity:4dd207dca48c5db5b4dbd8830294aff148ac7a84ab16412686ded6284c66ac45
  it("should NOT complete dollar sign at start of text", () => {
    // Single dollar sign is likely currency
    expect(remend("$x + y = z")).toBe("$x + y = z");
  });

  // parity:19a3171aa84910123aeab74e9d4182a705b598848ba0dd3b7ccb6b8b8a5d2623
  it("should handle escaped dollar signs", () => {
    const text = "Price is \\$100";
    expect(remend(text)).toBe(text);
  });

  // parity:9a8d6eda3c1c94353f3c9def541d5cedee4d4830486293272fac6abde4bce064
  it("should handle multiple consecutive dollar signs correctly", () => {
    expect(remend("$$$")).toBe("$$$$$");
    expect(remend("$$$$")).toBe("$$$$");
  });

  // parity:fb38ea0d80756270cbf2a3450adc99fa3d8259d5d48562de15699ccc2c83d338
  it("should handle mathematical expression chunks", () => {
    const chunks = [
      "The formula",
      "The formula $E",
      "The formula $E = mc",
      "The formula $E = mc^2",
      "The formula $E = mc^2$ shows",
    ];

    // Single dollar signs are not auto-completed (likely currency)
    expect(remend(chunks[0])).toBe(chunks[0]);
    expect(remend(chunks[1])).toBe("The formula $E");
    expect(remend(chunks[2])).toBe("The formula $E = mc");
    expect(remend(chunks[3])).toBe("The formula $E = mc^2");
    expect(remend(chunks[4])).toBe(chunks[4]);
  });
});

describe("KaTeX inline formatting ($) — opt-in via inlineKatex: true", () => {
  const opts = { inlineKatex: true };

  // parity:b2fcb8c1b4e705dd60798688a0df14cb703ac44c448482d9d2c89a400feef4d4
  it("should complete incomplete inline math", () => {
    expect(remend("Text with $formula", opts)).toBe("Text with $formula$");
    expect(remend("$incomplete", opts)).toBe("$incomplete$");
  });

  // parity:3a4eb82bd746aa44e1943383b02c6fb967e17be81fd7feafa352f51090295130
  it("should keep already-complete inline math unchanged", () => {
    const text = "Text with $x^2 + y^2 = z^2$";
    expect(remend(text, opts)).toBe(text);
  });

  // parity:b6b8484415a03a9f26fe404cd527cb1776af1fb2fe00bec27e0249c3cbd42396
  it("should complete the third unpaired dollar sign", () => {
    expect(remend("$first$ and $second", opts)).toBe("$first$ and $second$");
  });

  // parity:c117d61770aa41e20f8469d421fb61518988a51d0f473b752cf5008f36d88f7f
  it("should complete inline $ but not affect complete block $$", () => {
    expect(remend("$$block$$ and $inline", opts)).toBe(
      "$$block$$ and $inline$"
    );
  });

  // parity:f6e51fde2ad9d4e28982a09de5072a26d2b2486fc06108b668279530ecaa6a2a
  it("should handle streaming chunks of inline math", () => {
    const chunks = [
      "The formula",
      "The formula $E",
      "The formula $E = mc",
      "The formula $E = mc^2",
      "The formula $E = mc^2$ shows",
    ];

    expect(remend(chunks[0], opts)).toBe(chunks[0]);
    expect(remend(chunks[1], opts)).toBe("The formula $E$");
    expect(remend(chunks[2], opts)).toBe("The formula $E = mc$");
    expect(remend(chunks[3], opts)).toBe("The formula $E = mc^2$");
    expect(remend(chunks[4], opts)).toBe(chunks[4]);
  });

  // parity:65e056662ae9888dd1f44256e3ef7adc889dcced622dc7edffb3ec0e78e8094e
  it("should not complete escaped dollar signs", () => {
    const text = "Price is \\$100";
    expect(remend(text, opts)).toBe(text);
  });

  // parity:ed0634de8a1f64749ed9d9cf70430361bb62f6b2041a2c5ca4076659a556d311
  it("should not complete $ inside inline code", () => {
    const text = "Use `$var` for variables and $formula";
    expect(remend(text, opts)).toBe("Use `$var` for variables and $formula$");
  });

  // parity:d2b2910abf82265593b0b8f42e820278ac878b39dc56f0c0b566be50e6ae8e64
  it("should handle multiple complete inline math expressions", () => {
    const text = "$a = 1$ and $b = 2$";
    expect(remend(text, opts)).toBe(text);
  });

  // parity:c8fe5082a43c3b52896fb780f3a8c68b2269fb66efd984ef3866f2e404e99cb5
  // parity:ee4ec7c0d3cb71f937d69ace31596fc21b543bc135a966b4fb7aef57594ab45c
  it("should handle mixed inline and block math", () => {
    const text = "Inline $x$ and block $$y$$";
    expect(remend(text, opts)).toBe(text);
  });

  // parity:f6b6c0eba18de286b48f52f2354d21badb1488af2bc2f87b5f93b4546484cde0
  it("should not complete $ inside a complete block math expression", () => {
    const text = "$$x_1 + y_2 = z_3$$";
    expect(remend(text, opts)).toBe(text);
  });

  // parity:8e85f001176d90a260dcb188b721eeb8d78900af184d6f9e2dc923a200d964ee
  it("should handle $$ followed by an unmatched $", () => {
    expect(remend("$$block$$ then $x + y", opts)).toBe(
      "$$block$$ then $x + y$"
    );
  });

  // parity:a0a257d612f3b0560aafd907497af3918c36eb33946e947a6b2dcd3b8c010eff
  it("should not produce extra $ when block katex and inline katex both run", () => {
    // $$formula$ is streaming $$formula$$ cut off mid-close
    // block katex should fix it to $$formula$$, inline katex should leave it unchanged
    expect(remend("$$formula$", opts)).toBe("$$formula$$");
    expect(remend("$$x = y$", opts)).toBe("$$x = y$$");
  });
});

describe("math blocks with underscores", () => {
  // parity:53bf2a8c2d267337277aa1b7c3abcc2e5a5670c9f485286799c01a1d5b53892f
  it("should not complete underscores within inline math blocks", () => {
    const text = "The variable $x_1$ represents the first element";
    expect(remend(text)).toBe(text);

    const text2 = "Formula: $a_b + c_d = e_f$";
    expect(remend(text2)).toBe(text2);
  });

  // parity:894268fc44c1f2b1b468592daaea88ca330823c710a0ff83c894c13832a928b9
  it("should not complete underscores within block math", () => {
    const text = "$$x_1 + y_2 = z_3$$";
    expect(remend(text)).toBe(text);

    const text2 = "$$\na_1 + b_2\nc_3 + d_4\n$$";
    expect(remend(text2)).toBe(text2);
  });

  // parity:2ea7f4557e8871d373ecfff7f0b5b2e254a2e8a774b1ea1f8e3d46d6bf1545da
  it("should not add underscore when math block has incomplete underscore", () => {
    // We no longer auto-complete single dollar signs
    // The underscore inside is not treated as italic since it's likely part of a variable name
    const text = "Math expression $x_";
    expect(remend(text)).toBe("Math expression $x_");

    const text2 = "$$formula_";
    expect(remend(text2)).toBe("$$formula_$$");
  });

  // parity:896ca5aac5e63876203251c9f515d7cc2074f4b468732dd6a0d71f734bf37984
  it("should handle underscores outside math blocks normally", () => {
    const text = "Text with _italic_ and math $x_1$";
    expect(remend(text)).toBe(text);

    const text2 = "_italic text_ followed by $a_b$";
    expect(remend(text2)).toBe(text2);
  });

  // parity:371982ad4546a2363c19e052ffcdc7521a3c50593a2acc4de8983036ea00aadb
  it("should complete italic underscore outside math but not inside", () => {
    const text = "Start _italic with $x_1$";
    expect(remend(text)).toBe("Start _italic with $x_1$_");
  });

  // parity:ca060f454c25051dca1ce321fd6bdde9ef5f52cd54b9f240659b9395a39bae4e
  it("should handle complex math expressions with multiple underscores", () => {
    const text = "$x_1 + x_2 + x_3 = y_1$";
    expect(remend(text)).toBe(text);

    const text2 = "$$\\sum_{i=1}^{n} x_i = \\prod_{j=1}^{m} y_j$$";
    expect(remend(text2)).toBe(text2);
  });

  // parity:6d02becb4031de72015971e52406ad42dcd0841874f9f45c3d7f1706a75307ba
  it("should handle escaped dollar signs correctly", () => {
    const text = "Price is \\$50 and _this is italic_";
    expect(remend(text)).toBe(text);

    const text2 = "Cost \\$100 with _incomplete";
    expect(remend(text2)).toBe("Cost \\$100 with _incomplete_");
  });

  it("should handle mixed inline and block math", () => {
    const text = "Inline $x_1$ and block $$y_2$$ math";
    expect(remend(text)).toBe(text);
  });

  // parity:8c89fdeb8ed4ba0a996cac91feb1b034c2759156725b58d7ffcac11756e1ed42
  it("should not interfere with complete math blocks when adding underscores outside", () => {
    const text = "_italic start $x_1$ italic end_";
    expect(remend(text)).toBe(text);
  });

  // parity:f445e50902601bf7a2e25ab56906d6d32b7591474bb796af22a708c253a00c17
  it("should not complete dollar signs in inline code blocks (#296)", () => {
    const str =
      "Streamdown uses double dollar signs (`$$`) to delimit mathematical expressions.";
    expect(remend(str)).toBe(str);
  });

  // parity:bc7ffdf7f14972c07ddbd173a7abbc511bd5753eb20acf6d8b4ab6774eaeb051
  it("should handle multiple inline code blocks with $$ correctly (#296)", () => {
    const str = "Use `$$` for math blocks and `$$formula$$` for inline.";
    expect(remend(str)).toBe(str);
  });

  // parity:68146ca427cb4d1d93f7abe020ecacd0f39275e3f2325e8133bc4dfbb0ed0ba2
  it("should complete $$ outside inline code but not inside (#296)", () => {
    const str = "Math: $$x+y and code: `$$`";
    expect(remend(str)).toBe("Math: $$x+y and code: `$$`$$");
  });

  // parity:0eabc972d049d9ab2c4f8d7b88c71cfdd48ac8162fc12ba1f52debddadfe4381
  it("should handle mixed $$ inside and outside code blocks (#296)", () => {
    const str = "$$formula$$ and code `$$` and $$incomplete";
    expect(remend(str)).toBe("$$formula$$ and code `$$` and $$incomplete$$");
  });
});

describe("math blocks with asterisks", () => {
  // parity:a7091e5b1b2cafd8df4cdd7ba87a20d64e93913c2beb2e1c744d256d984d84a3
  it("should not complete asterisks within block math", () => {
    const text = "$$\\mathbf{w}^{*}$$";
    expect(remend(text)).toBe(text);
  });

  // parity:6979dd94c4bb51275776bbbd06053201aef26d2b0fe445d4f854618ab5b727db
  it("should not complete asterisks in complex math expressions", () => {
    const text =
      "$$\n\\mathbf{w}^{*} = \\underset{\\|\\mathbf{w}\\|=1}{\\arg\\max} \\;\\; \\mathbf{w}^T S \\mathbf{w}\n$$";
    expect(remend(text)).toBe(text);
  });

  // parity:722cc7fb288add9e86b3a3dfca3e0978954eb176ca9677ef39912b163446b93d
  it("should handle asterisks outside math blocks normally", () => {
    const text = "Text with *italic* and math $$x^{*}$$";
    expect(remend(text)).toBe(text);
  });

  // parity:db1be32e9026f286a6943a2fb1577f02a6db7ab482a373399294e2a69987f4eb
  it("should complete italic asterisk outside math but not inside", () => {
    const text = "Start *italic with $$x^{*}$$";
    expect(remend(text)).toBe("Start *italic with $$x^{*}$$*");
  });
});
