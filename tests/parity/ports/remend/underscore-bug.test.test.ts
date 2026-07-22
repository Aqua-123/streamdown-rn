import remend from "remend";

const HELLO_WORLD_UNDERSCORE_REGEX = /hello_world_/;
const TRAILING_UNDERSCORE_REGEX = /_$/;

describe("word-internal underscores", () => {
  describe("underscores as word separators", () => {
    // parity:4db6bd814a1202eb5d42abaf67fa99f6d8071e7e2851f4ecbbe03346e02c665c
    it("should handle single underscore between words", () => {
      const input = "hello_world";
      const result = remend(input);
      expect(result).toBe("hello_world");
    });

    // parity:aac95a071ba8dfbba6d2351584ec3f4c64dda3c67f796118c4c6af582e8db637
    it("should handle multiple underscores between words", () => {
      const input = "hello_world_test";
      const result = remend(input);
      expect(result).toBe("hello_world_test");
    });

    // parity:4b16d36e22cfd6a892cf259b917165e8ac693e93036f99b39d9a3e2a8d46ba3b
    it("should handle CONSTANT_CASE", () => {
      const input = "MAX_VALUE";
      const result = remend(input);
      expect(result).toBe("MAX_VALUE");
    });

    // parity:4dd4a8cf15ee53727ce79c3911e9b579ed61a2d79a91bc012bd732c3610eabda
    it("should handle multiple snake_case words in text", () => {
      const input = "The user_name and user_email are required";
      const result = remend(input);
      expect(result).toBe("The user_name and user_email are required");
    });

    // parity:1015c7d1767a9f98caf0f52bc1b326423cc87215df95a45040f25ddc18a47c3d
    it("should handle underscore in URLs", () => {
      const input = "Visit https://example.com/path_with_underscore";
      const result = remend(input);
      expect(result).toBe("Visit https://example.com/path_with_underscore");
    });

    // parity:7fff4891250cc531a6085a1dc44a06a1f260c3c0b684391b353ab0e68bb42f0d
    it("should handle numbers with underscores", () => {
      const input = "The value is 1_000_000";
      const result = remend(input);
      expect(result).toBe("The value is 1_000_000");
    });
  });

  describe("incomplete italic formatting", () => {
    // parity:76be17f806cdcca0d8476ad48f8b43d14ff7b5a2ed3ed3852d690b0d3df74951
    it("should complete italic at word boundary", () => {
      const input = "_italic text";
      const result = remend(input);
      expect(result).toBe("_italic text_");
    });

    // parity:f0b5611fdf41712ca4fd42d7d7ff801f9b0accb32f11caaead5ff345815b6dd6
    it("should complete italic with punctuation", () => {
      const input = "This is _italic";
      const result = remend(input);
      expect(result).toBe("This is _italic_");
    });

    // parity:c6b24b16c5e8bad28cd249beb9960a43286f177ac79516652480b2d30d8ec468
    it("should complete italic before newline", () => {
      const input = "_italic\n";
      const result = remend(input);
      expect(result).toBe("_italic_\n");
    });
  });

  describe("edge cases", () => {
    // parity:7634a9cc2914841b484e7c3cb9193a585e8a8fe0d0570e30840b07f054a02833
    it("should handle underscore at end of word (ambiguous case)", () => {
      const input = "word_";
      const result = remend(input);
      expect(result).toBe("word_");
    });

    // parity:6c9042c2917c362f78bf4a8e94b7da4b0a770f57722376c4fdee3bdaba982f61
    it("should handle leading underscore in identifier", () => {
      const input = "_privateVariable";
      const result = remend(input);
      expect(result).toBe("_privateVariable_");
    });

    // parity:a32fd2ed7f9ac3d6a313376e67167c00a0a0daf7202a0036ef754b5654c2c5c2
    it("should handle code with underscores in markdown", () => {
      const input = "Use `variable_name` in your code";
      const result = remend(input);
      expect(result).toBe("Use `variable_name` in your code");
    });

    // parity:9a3d73e51d9ae7cfc532b0cbe2d9b9fbc9030b4a39e10ecf301bb56ce1fb83ee
    it("should handle mixed snake_case and italic", () => {
      const input = "The variable_name is _important";
      const result = remend(input);
      expect(result).toBe("The variable_name is _important_");
    });

    // parity:af9dd678f27c60da6432e5a466d399931e82f8a275bdb247030e34b31c8ad2ec
    it("should not modify complete italic pairs", () => {
      const input = "_complete italic_ and some_other_text";
      const result = remend(input);
      expect(result).toBe("_complete italic_ and some_other_text");
    });

    // parity:d020d2ba36c817f2b7186f6ceec879bee9284d4e8e57ab0b52d2adcd2bcfa203
    it("should handle underscore in code blocks", () => {
      const input = "```\nfunction_name()\n```";
      const result = remend(input);
      expect(result).toBe("```\nfunction_name()\n```");
    });

    // parity:279bec2e18dfb50c283f888350a488e2559aa6c6d231facc82f9909890f7240f
    it("should handle HTML attributes with underscores", () => {
      const input = '<div data_attribute="value">';
      const result = remend(input);
      expect(result).toBe('<div data_attribute="value">');
    });
  });

  describe("real-world scenarios", () => {
    // parity:7290d3cec2f32cd827e3074b2a4ea303d48bf97d41fb1f60a16977b47a261b58
    it("should handle Python-style names", () => {
      const input = "__init__ and __main__ are special";
      const result = remend(input);
      expect(result).toBe("__init__ and __main__ are special");
    });

    // parity:1c8dda5f4e302409677ee986c0598944efb820b5711e1b90cfb09aaf95415355
    it("should handle markdown in sentences with snake_case", () => {
      const input = "The user_id field stores the _unique identifier";
      const result = remend(input);
      expect(result).toBe("The user_id field stores the _unique identifier_");
    });

    // parity:806b5aa46c8e5fc1d23fff6819110482d1cd9bddaa08785e4e9f63521bf752a9
    it("should handle the original bug report case", () => {
      const input = `hello_world

<a href="example_link"/>`;
      const result = remend(input);
      expect(result).toBe(input);
      expect(result).not.toMatch(HELLO_WORLD_UNDERSCORE_REGEX);
      expect(result).not.toMatch(TRAILING_UNDERSCORE_REGEX);
    });
  });
});
