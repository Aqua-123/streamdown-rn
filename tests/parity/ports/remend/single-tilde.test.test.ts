import remend from "remend";

describe("single tilde escape (#445)", () => {
  // parity:c1bd6bd2ff0cccad13231593077a1dc855c4ba1ffe06f24f4f0b5641cbd577d6
  it("should escape single ~ between numbers", () => {
    expect(remend("20~25°C")).toBe("20\\~25°C");
  });

  // parity:3a7383808201a2b4a4be8854eefa4270f7c7558568902a2e3baf98b53a334374
  it("should escape multiple single tildes between numbers", () => {
    expect(remend("20~25°C。20~25°C")).toBe("20\\~25°C。20\\~25°C");
  });

  // parity:5b4748fd3c7a799934f397d792052e416aa4ecb546ece78407f4a527eb7c33c0
  it("should escape single ~ between letters", () => {
    expect(remend("foo~bar")).toBe("foo\\~bar");
  });

  // parity:52df5514b3891acd5100d040865280292248896c6875300037d8d5bd2e7db26c
  it("should not escape ~~ (double tilde strikethrough)", () => {
    expect(remend("~~strikethrough~~")).toBe("~~strikethrough~~");
  });

  // parity:f8f36949d74a07ece81325d2b431309672072ed26623ebb404f11fbd95e93f14
  it("should not escape ~ at start or end of text", () => {
    expect(remend("~hello")).toBe("~hello");
    expect(remend("hello~")).toBe("hello~");
  });

  // parity:9f541b660e4c005392038b82474c128ca424598735c76871e5f8f4156a439d5f
  it("should not escape ~ surrounded by spaces", () => {
    expect(remend("hello ~ world")).toBe("hello ~ world");
  });

  // parity:eff4e5c1af4ce86b5336bef25b2675eabd1ae392993c267026b4170daaed7eb0
  it("should not escape ~ inside code blocks", () => {
    expect(remend("```\n20~25\n```")).toBe("```\n20~25\n```");
  });

  // parity:aea2aa9819ccd59cf025f52a6ce8e2ae0b619cb94c1efbd8f1e5bf1904a68773
  it("should not escape ~ inside inline code", () => {
    expect(remend("`20~25`")).toBe("`20~25`");
  });

  // parity:f2ce533b75c519aee3c2210b23647f4d1ac51f71cb9225983602c5ee92d0ca43
  it("should handle incomplete strikethrough separately from single tilde", () => {
    expect(remend("20~25 and ~~strike")).toBe("20\\~25 and ~~strike~~");
  });

  // parity:6d7cfa1573a826ed98e17eb2ccabcd0bdd940e98ba8d0667373c2b8c758f7bf6
  it("can be disabled via options", () => {
    expect(remend("20~25°C", { singleTilde: false })).toBe("20~25°C");
  });
});
