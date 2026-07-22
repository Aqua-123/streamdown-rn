import remend from "remend";

describe("italic formatting with underscores (__)", () => {
  // parity:47d1d2ef1ac7d5ae320eca41d81d231e6d88d46a1ec1f495214ed7d9392761a0
  it("should complete incomplete italic formatting with double underscores", () => {
    expect(remend("Text with __italic")).toBe("Text with __italic__");
    expect(remend("__incomplete")).toBe("__incomplete__");
  });

  // parity:ab639c767fdbdcad9d63987c839ab8451a0b0f74fab9e574f1bdd833f99b4bc2
  // parity:700d199350bf3add2e9305b8400f6c08f3d2315692e5061e24a88bb7fdb47915
  // parity:24278a22cda7f4da3a57e244c40efa7e3d6ed21f44941fe15049c34fb03b1b08
  it("should keep complete italic formatting unchanged", () => {
    const text = "Text with __italic text__";
    expect(remend(text)).toBe(text);
  });

  // parity:de7bc51df12ad741cc084ac26dfc460bc75c6f5933114b3713b76070dd99919d
  it("should handle odd number of double underscore pairs", () => {
    expect(remend("__first__ and __second")).toBe("__first__ and __second__");
  });

  // parity:b9717e4747fb44afef7ee94f4687bbd25d6864f7c26c959a8946117e0a9e1774
  it("should complete half-complete __ closing marker (#313)", () => {
    // When streaming __bold__, the closing marker arrives char by char
    // __bold text_ is a half-complete closing marker
    expect(remend("__xxx_")).toBe("__xxx__");
    expect(remend("__bold text_")).toBe("__bold text__");
    expect(remend("Text with __bold_")).toBe("Text with __bold__");
    expect(remend("This is __bold text_")).toBe("This is __bold text__");
  });
});

describe("italic formatting with asterisks (*)", () => {
  // parity:cf90919a2b7a37460ac9a95573033810f63f14213366b0285d23b880998c38d6
  it("should complete incomplete italic formatting with single asterisks", () => {
    expect(remend("Text with *italic")).toBe("Text with *italic*");
    expect(remend("*incomplete")).toBe("*incomplete*");
  });

  it("should keep complete italic formatting unchanged", () => {
    const text = "Text with *italic text*";
    expect(remend(text)).toBe(text);
  });

  // parity:0273228f94f05559ad9cde810108d80d182284aa94dac79e26ec428988d8bac3
  it("should not confuse single asterisks with bold markers", () => {
    expect(remend("**bold** and *italic")).toBe("**bold** and *italic*");
  });

  // parity:016669bd6bb8bbee570de5ec6059037c0b38f421eeece58dbbbb84f9969a9681
  it("should not treat asterisks in the middle of words as italic markers - #189", () => {
    expect(remend("234234*123")).toBe("234234*123");
    expect(remend("hello*world")).toBe("hello*world");
    expect(remend("test*123*test")).toBe("test*123*test");

    // Test with mix of word-internal and formatting asterisks (lines 39-41)
    expect(remend("*italic with some*var*name inside")).toBe(
      "*italic with some*var*name inside*"
    );
    expect(remend("test*var and *incomplete italic")).toBe(
      "test*var and *incomplete italic*"
    );
  });

  // parity:79cb68a04d85291896cb6d281e08978c64bbc5081432dbb0f3679081e58e379f
  it("should handle escaped asterisks correctly in countSingleAsterisks", () => {
    // Test lines 29-31: escaped asterisks should be skipped
    expect(remend("\\*escaped asterisk and *italic")).toBe(
      "\\*escaped asterisk and *italic*"
    );
    expect(remend("*start \\* middle \\* end")).toBe(
      "*start \\* middle \\* end*"
    );
  });

  // parity:615a55946756c111c390761c3246e6e64b663b009e664bf32e9c333b1766189c
  it("should handle asterisks between letters and numbers", () => {
    expect(remend("abc*123")).toBe("abc*123");
    expect(remend("123*abc")).toBe("123*abc");
  });

  // parity:db0bd443a926d910869f700fe39853445d76a969c1d8d6455bbf333fe478a759
  it("should still complete italic formatting with asterisks when not word-internal", () => {
    expect(remend("This is *italic")).toBe("This is *italic*");
    expect(remend("*word* and more text")).toBe("*word* and more text");
  });
});

describe("italic formatting with single underscores (_)", () => {
  // parity:818534e12b20bff76dad4512ad284d40a98a29005289bfe0a73498ab173781d7
  it("should complete incomplete italic formatting with single underscores", () => {
    expect(remend("Text with _italic")).toBe("Text with _italic_");
    expect(remend("_incomplete")).toBe("_incomplete_");
  });

  it("should keep complete italic formatting unchanged", () => {
    const text = "Text with _italic text_";
    expect(remend(text)).toBe(text);
  });

  // parity:236a1ff51fa9fcd91043b571c8b3da8c6176b9a3c33b270dda952432cb4422fe
  it("should not confuse single underscores with double underscore markers", () => {
    expect(remend("__bold__ and _italic")).toBe("__bold__ and _italic_");
  });

  // parity:1684393d929d71b4fd826c01aa459b0cd3b1ae6f2b431aa461514780d5e34e48
  it("should handle escaped single underscores", () => {
    const text = "Text with \\_escaped underscore";
    expect(remend(text)).toBe(text);

    const text2 = "some\\_text_with_underscores";
    expect(remend(text2)).toBe("some\\_text_with_underscores");
  });

  // parity:c67deecc8a5426dc056829ae43b5cfd1eda7223dbbff5462b6a8258efb997b8c
  it("should handle mixed escaped and unescaped underscores correctly", () => {
    expect(remend("\\_escaped\\_ and _unescaped")).toBe(
      "\\_escaped\\_ and _unescaped_"
    );

    expect(remend("Start \\_escaped\\_ middle _incomplete")).toBe(
      "Start \\_escaped\\_ middle _incomplete_"
    );

    expect(remend("\\_fully\\_escaped\\_")).toBe("\\_fully\\_escaped\\_");

    expect(remend("\\_escaped\\_ _complete_ pair")).toBe(
      "\\_escaped\\_ _complete_ pair"
    );
  });

  // parity:3a9f9924e7154093279e90cc596bf384928ac83b090d20190dfba115b2a4f44d
  it("should handle underscores with unicode word characters", () => {
    expect(remend("café_price")).toBe("café_price");
    expect(remend("naïve_approach")).toBe("naïve_approach");
  });

  // parity:7edc071fdb91772eae4a1cd1dce83925e659ecf67ed16c6bbf2fbd2712860d1b
  it("should not count word-internal single underscores in countSingleUnderscores", () => {
    // This tests the path where underscore is between word characters (lines 106-108)
    expect(remend("some_variable_name")).toBe("some_variable_name");
    expect(remend("test_123_value")).toBe("test_123_value");
    expect(remend("_start with underscore")).toBe("_start with underscore_");

    // Test with mix of word-internal and formatting underscores
    expect(remend("_italic with some_var_name inside")).toBe(
      "_italic with some_var_name inside_"
    );
    expect(remend("test_var and _incomplete italic")).toBe(
      "test_var and _incomplete italic_"
    );
  });

  // parity:3db31889faf418b49be6df692e40dad68d9cc4467a08f2a9ffdbaab58d7f1add
  it("should handle incomplete single underscore with trailing newlines", () => {
    expect(remend("Text with _italic\n")).toBe("Text with _italic_\n");
    expect(remend("_incomplete\n\n")).toBe("_incomplete_\n\n");
    expect(remend("Start _text\n")).toBe("Start _text_\n");
  });
});
