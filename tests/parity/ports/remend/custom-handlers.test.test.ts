import remend, {
  isWithinCodeBlock,
  isWithinLinkOrImageUrl,
  isWithinMathBlock,
  isWordChar,
  type RemendHandler,
} from "remend";

// Regex pattern for joke marker matching (moved to top level for performance)
const JOKE_MARKER_PATTERN = /<<<JOKE>>>([^<]*)$/;

describe("custom handlers", () => {
  // parity:dac4de02392299c22fc243f737f0667c476d7cf297cffb0ede9efed7092e3f38
  it("should execute custom handlers", () => {
    const handler: RemendHandler = {
      name: "test",
      handle: (text) => text.replace(/foo/g, "bar"),
    };

    expect(remend("foo", { handlers: [handler] })).toBe("bar");
  });

  // parity:0a52bd0414983c6524d76448b7f5b8f5b77dca1ed268e11ee94f3c06f665a770
  it("should execute custom handlers after built-in handlers by default", () => {
    const handler: RemendHandler = {
      name: "test",
      handle: (text) => `${text}!`,
    };

    // Bold should be completed first, then custom handler adds "!"
    expect(remend("**bold", { handlers: [handler] })).toBe("**bold**!");
  });

  // parity:740aee50037a287b7242afa7b7486e31e67d4c608d14e4af1e731c6350c40657
  it("should respect custom handler priority", () => {
    const results: string[] = [];

    const lowPriority: RemendHandler = {
      name: "low",
      priority: 200,
      handle: (text) => {
        results.push("low");
        return text;
      },
    };

    const highPriority: RemendHandler = {
      name: "high",
      priority: 5,
      handle: (text) => {
        results.push("high");
        return text;
      },
    };

    remend("test", { handlers: [lowPriority, highPriority] });
    expect(results).toEqual(["high", "low"]);
  });

  // parity:3c47b6727a229a7a8a30e0fba7347ccffcd5439df9b0b20b009ff9011bd5bf04
  it("should allow custom handlers to run before built-ins", () => {
    const results: string[] = [];

    const beforeSetext: RemendHandler = {
      name: "beforeSetext",
      priority: -1, // Before setextHeadings (0)
      handle: (text) => {
        results.push("custom");
        return text;
      },
    };

    // This will run built-in handlers too, but our custom one should be first
    remend("test\n-", { handlers: [beforeSetext] });
    expect(results[0]).toBe("custom");
  });

  // parity:18d908994f03aca1f00921a95aecf022f5b419183f90ae11fbd2faf5568e2524
  it("should handle multiple custom handlers", () => {
    const handler1: RemendHandler = {
      name: "replace-a",
      handle: (text) => text.replace(/a/g, "b"),
    };

    const handler2: RemendHandler = {
      name: "replace-b",
      handle: (text) => text.replace(/b/g, "c"),
    };

    expect(remend("aaa", { handlers: [handler1, handler2] })).toBe("ccc");
  });

  // parity:ee5a3b0bb2bea65d2cfc9fc8811c223caf0984c68f2bc15220351f991e82aac3
  it("should handle custom handlers with same priority in order", () => {
    const results: string[] = [];

    const first: RemendHandler = {
      name: "first",
      priority: 100,
      handle: (text) => {
        results.push("first");
        return text;
      },
    };

    const second: RemendHandler = {
      name: "second",
      priority: 100,
      handle: (text) => {
        results.push("second");
        return text;
      },
    };

    remend("test", { handlers: [first, second] });
    // Array.sort is stable in modern JS, so order should be preserved
    expect(results).toEqual(["first", "second"]);
  });

  // parity:ec1606dc577e6726515789e5774b071aa3ed539faf4954232a7ee0ebc3e00d77
  it("should work with disabled built-in handlers", () => {
    const handler: RemendHandler = {
      name: "test",
      handle: (text) => `${text}!`,
    };

    // Disable bold, custom handler still runs
    expect(remend("**bold", { bold: false, handlers: [handler] })).toBe(
      "**bold!"
    );
  });

  // parity:6cc0d8438209c7a8c3bc062871bbb8abc6454a567b2f6403f8630eefa765aed1
  it("should work with no built-in handlers enabled", () => {
    const handler: RemendHandler = {
      name: "uppercase",
      handle: (text) => text.toUpperCase(),
    };

    expect(
      remend("hello", {
        bold: false,
        italic: false,
        boldItalic: false,
        inlineCode: false,
        strikethrough: false,
        katex: false,
        links: false,
        images: false,
        setextHeadings: false,
        handlers: [handler],
      })
    ).toBe("HELLO");
  });

  // parity:012f3772b759405894b752223d9a7e16130ddef72d94c3fa24147a60dceac0c0
  it("should handle empty handlers array", () => {
    expect(remend("**bold", { handlers: [] })).toBe("**bold**");
  });
});

describe("exported utilities", () => {
  describe("isWithinCodeBlock", () => {
    // parity:23f87a025e1f0626a99735ae4f9734e3b3d85a9f5b85894f161f9a11dd3cdcfe
    it("should detect position inside code block", () => {
      const text = "```\ncode\n```";
      expect(isWithinCodeBlock(text, 5)).toBe(true);
    });

    // parity:a54bcdbed3421f30f7b5bfcc4417fe564e96a91265dbc4962c7bf9974200453a
    it("should detect position outside code block", () => {
      const text = "before ```code``` after";
      expect(isWithinCodeBlock(text, 2)).toBe(false);
    });
  });

  describe("isWithinMathBlock", () => {
    // parity:29f3e3d6ad16685be87ef42e222b87efb6986e6e48faaeb380cdee0351af9277
    it("should detect position inside block math", () => {
      const text = "$$x^2$$";
      expect(isWithinMathBlock(text, 3)).toBe(true);
    });

    // parity:566ec5a3ac45ffeadea7deb397dab7f484248f9a3a52d963385fe88af2679f82
    it("should detect position outside math", () => {
      const text = "before $x$ after";
      expect(isWithinMathBlock(text, 14)).toBe(false);
    });
  });

  describe("isWithinLinkOrImageUrl", () => {
    // parity:4eab2f9e465a1c881305f6097363b4428cb8910982e7dfa7648a355e15fa5841
    it("should detect position inside link URL", () => {
      const text = "[text](http://example.com)";
      expect(isWithinLinkOrImageUrl(text, 10)).toBe(true);
    });

    // parity:cc8e835d61265eeedbd21b8768a7ae28aea9600c862e37552dee0f69d34b8420
    it("should detect position outside link", () => {
      const text = "before [text](url) after";
      expect(isWithinLinkOrImageUrl(text, 2)).toBe(false);
    });
  });

  describe("isWordChar", () => {
    // parity:c5ed606747f311f1f637e86b19ddec8c22b86241b3a876d0916253fb0b1b5e52
    it("should identify word characters", () => {
      expect(isWordChar("a")).toBe(true);
      expect(isWordChar("Z")).toBe(true);
      expect(isWordChar("5")).toBe(true);
      expect(isWordChar("_")).toBe(true);
    });

    // parity:428b44c1ad7679d44dad8943b0a631a5f644f335bd6a738047c557ae3699021b
    it("should identify non-word characters", () => {
      expect(isWordChar(" ")).toBe(false);
      expect(isWordChar("*")).toBe(false);
      expect(isWordChar("")).toBe(false);
    });
  });
});

describe("custom handler example: joke marker", () => {
  // parity:fc8cf7197bd8f86e653abbcda1275b5fe76af9e489d6a183783e12e398ed5667
  it("should complete joke markers", () => {
    const jokeHandler: RemendHandler = {
      name: "joke",
      priority: 80,
      handle: (text) => {
        // Complete <<<JOKE>>> marks
        const match = text.match(JOKE_MARKER_PATTERN);
        if (match && !text.endsWith("<<</JOKE>>>")) {
          return `${text}<<</JOKE>>>`;
        }
        return text;
      },
    };

    expect(
      remend("<<<JOKE>>>Why did the chicken", { handlers: [jokeHandler] })
    ).toBe("<<<JOKE>>>Why did the chicken<<</JOKE>>>");
  });

  // parity:0304bdd350ebd4c64202aa7885a6f10be54de1b5945753d805d63176f89d84a6
  it("should not double-complete joke markers", () => {
    const jokeHandler: RemendHandler = {
      name: "joke",
      priority: 80,
      handle: (text) => {
        const match = text.match(JOKE_MARKER_PATTERN);
        if (match && !text.endsWith("<<</JOKE>>>")) {
          return `${text}<<</JOKE>>>`;
        }
        return text;
      },
    };

    expect(
      remend("<<<JOKE>>>complete<<</JOKE>>>", { handlers: [jokeHandler] })
    ).toBe("<<<JOKE>>>complete<<</JOKE>>>");
  });
});
