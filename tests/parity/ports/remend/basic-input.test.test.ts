import remend from "remend";

describe("basic input handling", () => {
  // parity:f7518b04746df0b0ce00925ca99bbfc559b45230326b31d7ad5eec80f5fc2b1a
  it("should return non-string inputs unchanged", () => {
    expect(remend(null as any)).toBe(null);
    expect(remend(undefined as any)).toBe(undefined);
    expect(remend(123 as any)).toBe(123);
  });

  // parity:961e338c87ab905cbbe3d0acf6aba4daffe113abf8d51d96d213680745bd0bf5
  it("should return empty string unchanged", () => {
    expect(remend("")).toBe("");
  });

  // parity:3f2008a8cd646cec1ca76788291df355195bb7b27576b409b7b811fd3d200e60
  it("should return regular text unchanged", () => {
    const text = "This is plain text without any markdown";
    expect(remend(text)).toBe(text);
  });
});
