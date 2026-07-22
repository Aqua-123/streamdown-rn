import remend, { isWordChar } from "remend";

describe("isWordChar", () => {
  // parity:682852392a2f116ebdfb7674625afd2d0fb02e820d0608d3a3f2e8ce03665aea
  it("should return false for empty string", () => {
    expect(isWordChar("")).toBe(false);
  });

  // parity:0d54cb20963cb35b968a1c882f53f3992a40209b374355fa84c561353bc5b1a3
  it("should return true for ASCII word characters", () => {
    expect(isWordChar("a")).toBe(true);
    expect(isWordChar("Z")).toBe(true);
    expect(isWordChar("5")).toBe(true);
    expect(isWordChar("_")).toBe(true);
  });

  // parity:c51724a21587cb0b59813c8a74476aa0d80a659ff4a82f5db364c26d476f709c
  it("should return false for non-word characters", () => {
    expect(isWordChar(" ")).toBe(false);
    expect(isWordChar("*")).toBe(false);
    expect(isWordChar("-")).toBe(false);
  });

  // parity:8bbc2aef9a95affb60884b7d5d89b1906a6a205e787c6ef19a06c09b85b4dd0a
  it("should handle unicode word characters", () => {
    expect(isWordChar("é")).toBe(true);
    expect(isWordChar("ñ")).toBe(true);
  });
});

describe("findMatchingOpeningBracket", () => {
  // parity:9c851e8f84c8cf3f4c47b4b60f2eb2e6898e8171cf78407ac80cc22e4cd89674
  it("should return -1 when no matching opening bracket exists", () => {
    expect(remend("some text]")).toBe("some text]");
  });

  // parity:67f240494461d12ad17d96833e924f17df1a06e5ddbe3de2d7ddd18a2d3de4bc
  it("should find matching opening bracket for simple case", () => {
    expect(remend("[text]")).toBe("[text]");
  });

  // parity:fef9f70919b04869fcf3001a2c63d1d3d9292e11f01ff1fff0302e6a3ad65208
  // parity:29f0837c9212813883a39a7e337d9243cb4cde2a504b484d68924b9f6c307ea6
  it("should handle nested brackets", () => {
    expect(remend("[outer [inner] text]")).toBe("[outer [inner] text]");
  });
});

describe("findMatchingClosingBracket", () => {
  // parity:91886725ae678051e832395ff001de5ed053da47953d01b894019f0010c1994b
  it("should return -1 when no matching closing bracket exists", () => {
    expect(remend("[some text", { linkMode: "text-only" })).toBe("some text");
  });

  // parity:20bf21a99e8c434bd3fa59469c1b70b7b28a43b8f595349fa5e4ca556084726f
  it("should find matching closing bracket for simple case", () => {
    expect(remend("[text]")).toBe("[text]");
  });

  it("should handle nested brackets", () => {
    expect(remend("[outer [inner] text]")).toBe("[outer [inner] text]");
  });
});
