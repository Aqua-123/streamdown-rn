import remend from "remend";
import {
  isWithinLinkOrImageUrl,
  isWithinMathBlock,
} from "remend";

describe("empty string through handler pipeline", () => {
  // parity:18528665e7322b762c533b55159ab40f42b4ea91d2c15fd2910996262eae0f28
  it("should handle single space input", () => {
    expect(remend(" ")).toBe("");
  });
});

describe("half-complete double underscore closing", () => {
  // parity:0f46bcafb8af1b07db06a15dfeff1a3b8d75ed170b81f1addd65d5a81da8583c
  it("should complete __content_ to __content__", () => {
    expect(remend("__content_")).toBe("__content__");
  });
});

describe("underscore with trailing double asterisks", () => {
  // parity:caad0bc7af248d8d9b97c0d290fa5a0faae6fc136ea45befffafe9db74e3bac5
  it("should close underscore when trailing ** is unrelated", () => {
    expect(remend("_text**")).toBe("_text**_");
  });
});

describe("bold-italic inside code block", () => {
  // parity:8758a2cab790cf66e3e195b3a19b4c308317559ac3f05052be838b1bf3bbdddc
  it("should not complete *** markers inside code blocks", () => {
    expect(remend("```\n***bold")).toBe("```\n***bold");
  });

  // parity:406622cf4fe2fb9660e5e4f3c14664166ef3b1fd957189c6a681ebbc4382073e
  it("should complete *** outside code block with *** inside", () => {
    expect(remend("```\n***\n```\n***text")).toBe("```\n***\n```\n***text***");
  });
});

describe("countTripleAsterisks", () => {
  // parity:17e21fe0bc8debc19595a98375ab3259916a4840cef9056b3e6a4d70325070e5
  it("should count trailing *** at end of text", () => {
    expect(remend("text***")).toBe("text***");
  });

  // parity:05af28ef3c13ca7304d0e1cbc82ebfc0a85addb7768d4986bd28e591b24626d4
  it("should skip *** inside code blocks", () => {
    expect(remend("```\n***\n```")).toBe("```\n***\n```");
  });

  // parity:9f7ecda31d74527859468d0d0401ba8a7c7cee5cd71c44d647a13687373b64bd
  it("should count *** outside but not inside code blocks", () => {
    expect(remend("```\n***\n```\n***")).toBe("```\n***\n```\n***");
  });

  // parity:7b97ef36df4c9dce9ee125eeee62e7b087071aaac45b59a80164d665aa0db245
  it("should flush pending asterisks before code block toggle", () => {
    expect(remend("***```code```")).toBe("***```code```***");
  });
});

describe("single underscore counting with code blocks", () => {
  // parity:90b7b5eb8dc0cf09cfb294047a49ae48cf2c688fb8dfedb2548908db1b7b4a49
  it("should skip _ inside fenced code blocks", () => {
    expect(remend("```\n_code\n```\n_text")).toBe("```\n_code\n```\n_text_");
  });
});

describe("setext heading with equals sign edge cases", () => {
  // parity:4e772d34ed3934340f285561f6e6be2c16c2f15ef621745b394219f00aef1560
  it("should not modify equals when previous line is empty", () => {
    expect(remend("\n=")).toBe("\n=");
  });

  // parity:8fe06911f617e68e14e60a63e56496ed20a26ebbe57b2401b9e6cec3bbe423b0
  it("should not modify double equals when previous line is empty", () => {
    expect(remend("\n==")).toBe("\n==");
  });
});

describe("strikethrough even tilde pairs", () => {
  // parity:6f5319ca277cf345664e4a9956342220f7b4d22f65bd534c4a12123e810250cc
  it("should not close when tilde pairs are balanced", () => {
    expect(remend("a~~b~~text")).toBe("a~~b~~text");
  });

  // parity:833a22e9ad77961d2a349e364578d3ca8f38177f4dff1a7acdbaadda70b13cfb
  it("should not close half-complete tilde when pairs are balanced", () => {
    expect(remend("a~~b~~c~")).toBe("a~~b~~c~");
  });
});

describe("double underscore counting with code blocks", () => {
  // parity:b2a46dd792aeb106da72b021eb87caa5663e89262c25f3cac286da179f0780e2
  it("should skip __ inside fenced code blocks", () => {
    expect(remend("```\n__code\n```\n__text")).toBe(
      "```\n__code\n```\n__text__"
    );
  });
});

describe("link handler edge cases", () => {
  // parity:dbc379132f0de3933bf91a3233c20e0f0c4e17f639204635629ed6e95404444c
  it("should handle ]( without matching opening bracket", () => {
    expect(remend("](partial")).toBe("](partial");
  });

  // parity:8eec1cf289f7a8ef3c51d3d8f34fe85e11389d75c3dffe77ff6b1ed0401c4f5a
  it("should skip image brackets in text-only mode", () => {
    expect(remend("![img [text", { linkMode: "text-only" })).toBe("![img text");
  });

  // parity:f961f938d8f9d74865c48c7dc5bef5df80631a34f672f8277103a87c1af52345
  it("should skip complete links in text-only mode", () => {
    expect(remend("[link](url) [incomplete", { linkMode: "text-only" })).toBe(
      "[link](url) incomplete"
    );
  });

  // parity:3f5ce89ae79dd596ba83d26b073eda77dd5412342ae05bf6fff0a9e0a7e8ce98
  it("should handle complete bracket pair without link in text-only mode", () => {
    expect(remend("[text] [incomplete", { linkMode: "text-only" })).toBe(
      "[text] incomplete"
    );
  });
});

describe("isBeforeClosingParen edge cases", () => {
  // parity:f9baf3e6a3fa6af53bdf248a31d54c503958d7697a20300495550f50649aa00e
  it("should return false when newline found before )", () => {
    expect(isWithinLinkOrImageUrl("[t](_\nmore)", 4)).toBe(false);
  });

  // parity:b30b5f18c26a3a45811b93f2c1262e086acee42ddd86a0d4dac43788264ebe0e
  it("should return false when text ends without ) or newline", () => {
    expect(isWithinLinkOrImageUrl("[t](_noclose", 4)).toBe(false);
  });
});

describe("isWithinLinkOrImageUrl — ) found before (", () => {
  // parity:9b1aa80e8ee824c865c7dc187f69126ec4582afbfd4cccab4cf6bfc2ead0d9f9
  it("should return false when ) precedes the position", () => {
    expect(isWithinLinkOrImageUrl("[text](url) _after", 12)).toBe(false);
  });

  // parity:9b84227f53cf2b86a5dd282f3d7b54bbd34de46963e327d791c6423d88dde559
  it("should handle underscore after complete link", () => {
    expect(remend("[link](url) _word")).toBe("[link](url) _word_");
  });
});

describe("isWithinLinkOrImageUrl edge cases", () => {
  // parity:4d49ec3b7a08a46c0ec1d7945910a4ae78588b8f934143abef545f0d5db17159
  it("should return false for bare ( not preceded by ]", () => {
    expect(isWithinLinkOrImageUrl("func(arg)", 5)).toBe(false);
  });

  // parity:0b5e993af8788dc3d41724bdc45ae4b1560738c47a5dedf07f2e748540d201f2
  it("should handle underscore after bare parenthesis", () => {
    expect(remend("func(_arg")).toBe("func(_arg_");
  });
});

describe("isWithinHtmlTag edge cases", () => {
  // parity:313217ea7ff92d55e846d3d5c39ca271148064813c4ff3a60243f32f56401bce
  it("should return false when > is found first", () => {
    expect(remend("div> _text")).toBe("div> _text_");
  });

  // parity:0e9df20659aab309c697bf4db65c7a5d398be17f692a98346516e3751787a2dd
  it("should return false for invalid tag start after <", () => {
    expect(remend("3<5 _text")).toBe("3<5 _text_");
  });

  // parity:3082e48d9ddcdc7a2b08211e3fa5a4deb8e17645f188110bcb8b1750abc5becf
  it("should return false when newline found before < or >", () => {
    expect(remend("<div\n_text")).toBe("");
  });

  // parity:6ab486a15bd7216b5793fdd5d3698263dec30b0c9550d1ea6f3f294ac6b19f8c
  it("should handle underscore after > character", () => {
    expect(remend("div> _text")).toBe("div> _text_");
  });

  // parity:dc15210d2d6f4de0dd2473bed7a7b30d067fcef71d398851a7cb08e9f8eee651
  it("should handle underscore near < with invalid tag start", () => {
    expect(remend("3<5 _text")).toBe("3<5 _text_");
  });

  // parity:33d19522b5f880c11d3b8cceee602d8768d4f9288a33d50058ec2439cbd45a37
  it("should handle underscore on new line after HTML element", () => {
    expect(remend("<div>\n_text")).toBe("<div>\n_text_");
  });

  // parity:e59b94044c211b377c3b745b6052d3972ee3b7ceef4580eacc765e7d1a7d66b2
  it("should return true for uppercase tag", () => {
    expect(remend("<DIV class='_test'>")).toBe("<DIV class='_test'>");
  });

  // parity:6ba0942f2acf4d8e3cd7846c8bfe639823fafb1bade759cb502bbff2ebded463
  it("should return true for closing tag with /", () => {
    expect(remend("</div _attr>")).toBe("</div _attr>");
  });

  // parity:e22b914d650ccad51d43b9f0b4b245bb6c9cb4513674b0520ce39809ab1dd1b6
  it("should return false when < is at end of text", () => {
    expect(remend("text<")).toBe("text<");
  });
});

describe("underscore inside link URL", () => {
  // parity:9ee767f54fb335527382fec183ad8b812fbf671b64ee0917f691be1f9b1a79b4
  it("should not close underscore that is part of a link URL", () => {
    expect(remend("[link](a_b) _word")).toBe("[link](a_b) _word_");
  });
});

describe("isWithinMathBlock branch coverage", () => {
  // parity:215e513afce7a9201d2e23600ce0c3b95cbe3e245e225eed44e77462c7b70757
  it("should ignore single $ inside block math", () => {
    expect(isWithinMathBlock("$$x$y$$z", 5)).toBe(true);
  });
});

describe("double underscore half-complete in code block", () => {
  // parity:da6ba474117a05c84e5733f14e36cdb3adeb626e0828a6338091ead03c3afd78
  it("should not complete __content_ inside code block", () => {
    expect(remend("```\n__content_")).toBe("```\n__content_");
  });
});

describe("double underscore half-complete with even pairs", () => {
  // parity:6594de907fdae6df2ba1aee5a81ea096a832821d751e3131b20aebed81f18283
  it("should not complete when __ pairs are balanced", () => {
    expect(remend("__a__ __b__content_")).toBe("__a__ __b__content_");
  });
});

describe("findFirstIncompleteBracket with incomplete URL", () => {
  // parity:80fdd471e76f273fd102decdeb49317eafebf94fe54fad47408550d745a7e5be
  it("should handle [text]( without ) before incomplete bracket", () => {
    expect(remend("[a]( b](c [incomplete", { linkMode: "text-only" })).toBe(
      "[a]( b](c incomplete"
    );
  });
});

describe("isHorizontalRule branch coverage", () => {
  // parity:04e0729883a44e5623f93fd6cf63e6aef451e4515f3f6481d96f36f4a0f79173
  it("should detect horizontal rule with spaces between markers", () => {
    expect(remend("* * *")).toBe("* * *");
  });

  // parity:e1f0552cdc15b63167db12c3ea430bee94a483d2ecca1e8c1a6d7922e1383273
  it("should detect horizontal rule with tabs between markers", () => {
    expect(remend("*\t*\t*")).toBe("*\t*\t*");
  });
});
