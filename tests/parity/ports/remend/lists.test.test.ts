import remend from "remend";

describe("list handling", () => {
  // parity:4ea5c442ec361eb916b9c632c175c2750fdbea9a517f98b1248a7f36b77094e1
  it("should not add asterisk to lists using asterisk markers", () => {
    const text = "* Item 1\n* Item 2\n* Item 3";
    expect(remend(text)).toBe(text);
  });

  // parity:56825b23caca9f6f401fc97497a0a10baddbe9cf87c7037da79989805c2e06f1
  it("should not add asterisk to single list item", () => {
    const text = "* Single item";
    expect(remend(text)).toBe(text);
  });

  // parity:5d124ed38230a93c223527ddb6b0622f7fecfd6662f6637105496547e3384f41
  it("should not add asterisk to nested lists", () => {
    const text = "* Parent item\n  * Nested item 1\n  * Nested item 2";
    expect(remend(text)).toBe(text);
  });

  // parity:6e658bd18c42ae7055d49f487a9ac3c9808ddf67a640228aab13135ffd142272
  it("should handle lists with italic text correctly", () => {
    const text = "* Item with *italic* text\n* Another item";
    expect(remend(text)).toBe(text);
  });

  // parity:5a14547ca90c61e86360c396adfc9c351e9f234dacefa60adb54bc3ad555927b
  it("should complete incomplete italic even in list items", () => {
    // List markers are not counted, but incomplete italic formatting is still completed
    const text = "* Item with *incomplete italic\n* Another item";
    // The function adds an asterisk to complete the italic, though at the end of text
    // This is not ideal but matches current behavior
    expect(remend(text)).toBe(
      "* Item with *incomplete italic\n* Another item*"
    );
  });

  // parity:461caa6adb84a10bd24959d097b1e312063788ba706c19c15c80c5b614a58a97
  it("should handle mixed list markers and italic formatting", () => {
    const text = "* First item\n* Second *italic* item\n* Third item";
    expect(remend(text)).toBe(text);
  });

  // parity:d802d3c9ffef89d8cdddf7ff9ea958e1b3d58e7e24eead7afa0801654079bf2e
  it("should handle lists with tabs for indentation", () => {
    const text = "*\tItem with tab\n*\tAnother item";
    expect(remend(text)).toBe(text);
  });

  // parity:45b5d87c4d6e515a370fedd53f2baddb1959c5aea965e85783feda30191f4883
  it("should not interfere with dash lists", () => {
    const text = "- Item 1\n- Item 2 with *italic*\n- Item 3";
    expect(remend(text)).toBe(text);
  });

  // parity:80182a0ec73401e7773b8cc74ee5450aa4dff81744f4e0a298878e09143ece0b
  it("should handle the Gemini response example from issue", () => {
    const geminiResponse = "* user123\n* user456\n* user789";
    expect(remend(geminiResponse)).toBe(geminiResponse);
  });

  // parity:4cdc688459652a3635c3d743d7b669275d25daf2f0934375d98f596bfbad37b8
  it("should handle lists with incomplete formatting", () => {
    expect(remend("- Item 1\n- Item 2 with **bol")).toBe(
      "- Item 1\n- Item 2 with **bol**"
    );
  });

  // parity:caf78445386db95802926d10d7f946fead286223869279a170b665e93918f82a
  it("should handle lists with emphasis character blocks (#97)", () => {
    // Lists with just emphasis markers should not be auto-completed
    expect(remend("- __")).toBe("- __");
    expect(remend("- **")).toBe("- **");
    expect(remend("- __\n- **")).toBe("- __\n- **");
    expect(remend("\n- __\n- **")).toBe("\n- __\n- **");

    // Multiple list items with emphasis markers
    expect(remend("* __\n* **")).toBe("* __\n* **");
    expect(remend("+ __\n+ **")).toBe("+ __\n+ **");

    // List items with emphasis markers and text should still complete
    expect(remend("- __ text after")).toBe("- __ text after__");
    expect(remend("- ** text after")).toBe("- ** text after**");

    // Mixed list items
    expect(remend("- __\n- Normal item\n- **")).toBe(
      "- __\n- Normal item\n- **"
    );

    // Lists with other emphasis markers
    expect(remend("- ***")).toBe("- ***");
    expect(remend("- *")).toBe("- *");
    expect(remend("- _")).toBe("- _");
    expect(remend("- ~~")).toBe("- ~~");
    expect(remend("- `")).toBe("- `");
  });

  // parity:96cd67dddfcb4f3ab5a578804026c3ad0712039f37a28904315733e725bf0ed2
  it("should not complete list items with emphasis markers spanning multiple lines", () => {
    // When a list item starts with ** followed by content with newline, don't complete
    expect(remend("- **text\nmore text")).toBe("- **text\nmore text");
    expect(remend("* **content\n* Another item")).toBe(
      "* **content\n* Another item"
    );
  });
});
