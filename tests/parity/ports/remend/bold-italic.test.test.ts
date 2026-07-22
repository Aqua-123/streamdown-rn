import remend from "remend";

describe("bold-italic formatting (***)", () => {
  // parity:886cef2ef6f6dc4256270b7a07e2d40c8c339a1d6b0920b16f90402478db2f99
  it("should complete incomplete bold-italic formatting", () => {
    expect(remend("Text with ***bold-italic")).toBe(
      "Text with ***bold-italic***"
    );
    expect(remend("***incomplete")).toBe("***incomplete***");
  });

  // parity:b2eb4f7f4cfd5027869c3634f0be70bcca672dd6ce1ecc2ffa2ef51fe1d06639
  it("should keep complete bold-italic formatting unchanged", () => {
    const text = "Text with ***bold and italic text***";
    expect(remend(text)).toBe(text);
  });

  // parity:ad098a163e33bc7a6bee561bd0c5933da2b132141f55a06103904549d18ff481
  it("should handle multiple bold-italic sections", () => {
    const text = "***first*** and ***second***";
    expect(remend(text)).toBe(text);
  });

  // parity:c61cd383e981fab60f7642b5e865a3f572ec75af626850e654dbc84280ef8acc
  it("should complete odd number of triple asterisk markers", () => {
    expect(remend("***first*** and ***second")).toBe(
      "***first*** and ***second***"
    );
  });

  // parity:f8db0487995a1674aee4a3cae670e87b1ba983f95302f0f1d262b98818c146ca
  it("should not confuse triple asterisks with single or double", () => {
    expect(remend("*italic* **bold** ***both")).toBe(
      "*italic* **bold** ***both***"
    );
  });

  // parity:d61438362b362474a087027971dfb154a6ad7dfabed2c0137c34ffcb6c626ca9
  it("should handle triple asterisks at start of text", () => {
    expect(remend("***Starting bold-italic")).toBe(
      "***Starting bold-italic***"
    );
  });

  // parity:87fe0bcac37d15132d0de3e946cdb80a5d5a8445fa1d57070973deedc5e319a7
  it("should handle nested formatting with triple asterisks", () => {
    expect(remend("***bold-italic with `code")).toBe(
      "***bold-italic with `code***`"
    );
  });

  // parity:7b9c4082b73bc2ad18b8ca949921d8eab8656adcb32ed56d9dc09b99b5fc2657
  it("should handle bold-italic chunks", () => {
    const chunks = [
      "This is",
      "This is ***very",
      "This is ***very important",
      "This is ***very important***",
      "This is ***very important*** to know",
    ];

    expect(remend(chunks[0])).toBe("This is");
    expect(remend(chunks[1])).toBe("This is ***very***");
    expect(remend(chunks[2])).toBe("This is ***very important***");
    expect(remend(chunks[3])).toBe(chunks[3]);
    expect(remend(chunks[4])).toBe(chunks[4]);
  });

  // parity:68a14a0f24195bbd9b0d38ded815cd1cf47d3637887ea39cd9ff042800da3e0c
  it("should handle text ending with multiple consecutive asterisks", () => {
    // Test the case where text ends with trailing asterisks (>= 3)
    expect(remend("text ***")).toBe("text ***");
    expect(remend("text ****")).toBe("text ****");
    expect(remend("text *****")).toBe("text *****");
    expect(remend("text ******")).toBe("text ******");

    // Test text that ends without any space (lines 136-138 in emphasis-handlers.ts)
    expect(remend("text***")).toBe("text***");
    expect(remend("word****")).toBe("word****");
    expect(remend("end******")).toBe("end******");

    // Test cases where countTripleAsterisks is called with trailing asterisks
    expect(remend("***start***end***")).toBe("***start***end***");
    // 6 asterisks at end = 2 sets of ***, total 3 sets (odd), but this might not close
    // Let me test with different patterns
    expect(remend("***text***")).toBe("***text***");
    expect(remend("***incomplete")).toBe("***incomplete***");

    // Test lines 137-138: text that ends with >= 3 asterisks (but not 4+ consecutive)
    expect(remend("***word text***")).toBe("***word text***");
  });

  // parity:3a1eb3ad3be49b29a2fef34b0193f96124b9252caae14c1c87aa10a734638761
  it("should not add closing markers to overlapping bold and italic (#302)", () => {
    // When we have **bold and *italic***, the *** is closing both ** and *
    // It's not a bold-italic marker, so we shouldn't add closing ***
    expect(remend("Combined **bold and *italic*** text")).toBe(
      "Combined **bold and *italic*** text"
    );
    expect(remend("**bold and *italic*** more text")).toBe(
      "**bold and *italic*** more text"
    );
    expect(remend("test **bold and *italic*** end")).toBe(
      "test **bold and *italic*** end"
    );
    expect(remend("- Combined **bold and *italic*** text")).toBe(
      "- Combined **bold and *italic*** text"
    );
  });
});
