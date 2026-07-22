import { detectTextDirection } from "../../../../src/core/blockSemantics";

describe("detectTextDirection", () => {
  // parity:1f4f62ace8912df91e476389743315df23c4542a0fa5dc8665f1cec9d64cdf7c
  it("returns ltr for English text", () => {
    expect(detectTextDirection("Hello world")).toBe("ltr");
  });

  // parity:21510bb61500744b432bcf5b1b97e07e978e4acb58cd025c47622c5fc2595e9c
  it("returns rtl for Arabic text", () => {
    expect(detectTextDirection("مرحبا بالعالم")).toBe("rtl");
  });

  // parity:917b3c8d6221407a8214f2774b20338db8ebe62bfc93786d8b2986363d758bd2
  it("returns rtl for Hebrew text", () => {
    expect(detectTextDirection("שלום עולם")).toBe("rtl");
  });

  // parity:45bc397224661532cdd1e8ed6b0847d6726723f7416c6dccc1c7bd410e2da6c2
  it("skips markdown heading syntax", () => {
    expect(detectTextDirection("## مرحبا")).toBe("rtl");
  });

  // parity:17020f8bf43d1b29958bab47a7ed97880aa12b4a23e0a87da1d721deff3bb518
  it("skips leading punctuation and digits", () => {
    expect(detectTextDirection("123. مرحبا")).toBe("rtl");
  });

  // parity:0304b0a55699d8a4d58061e6ce8eadf1d149d197e893fdeea832a46da9d500d8
  it("handles bold/italic markdown", () => {
    expect(detectTextDirection("**שלום**")).toBe("rtl");
  });

  // parity:cf03ba5f1f6ce5f96a077b21eb6048dc96c1e896572f50119150ce7193f5a7b1
  it("returns ltr for empty string", () => {
    expect(detectTextDirection("")).toBe("ltr");
  });

  // parity:7b5c64f13fd3ac8ecb2dfc2859b6f34e93832b412b8336a8320422e1bc56aeb1
  it("returns ltr for numbers only", () => {
    expect(detectTextDirection("12345")).toBe("ltr");
  });

  // parity:b4878356c716f95849a92215e7becf42288a86cca19a8630c346fa81e861227e
  it("returns ltr for mixed starting with Latin", () => {
    expect(detectTextDirection("Hello مرحبا")).toBe("ltr");
  });

  // parity:de97f2c7623e675c52a711aef1f0b956b99be2515ed43a151fa4facaddd014f6
  it("returns rtl for mixed starting with Arabic", () => {
    expect(detectTextDirection("مرحبا Hello")).toBe("rtl");
  });

  // parity:696504861c785e20f975a20c810ae386829d9c701cd0e5635de06684c9c0b6ae
  it("handles Thaana script", () => {
    expect(detectTextDirection("ދިވެހި")).toBe("rtl");
  });

  // parity:6f0a72ddb96f0fdbda508800fe8811e4d074147230d102c5292c12bf34df4fdc
  it("handles inline code", () => {
    expect(detectTextDirection("`code` مرحبا")).toBe("rtl");
  });
});
