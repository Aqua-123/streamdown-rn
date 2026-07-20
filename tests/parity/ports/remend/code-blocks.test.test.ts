import remend from "remend";

// Top-level regex for performance (used in multiple tests)
const trailingDoubleUnderscorePattern = /__$/;

describe("code block handling", () => {
  it("should handle incomplete multiline code blocks", () => {
    expect(remend("```javascript\nconst x = 5;")).toBe(
      "```javascript\nconst x = 5;"
    );
    expect(remend("```\ncode here")).toBe("```\ncode here");
  });

  it("should handle complete multiline code blocks", () => {
    const text = "```javascript\nconst x = 5;\n```";
    expect(remend(text)).toBe(text);
  });

  it("should handle code blocks with language and incomplete content", () => {
    expect(remend("```python\ndef hello():")).toBe("```python\ndef hello():");
  });

  it("should handle nested backticks inside code blocks", () => {
    const text = "```\nconst str = `template`;\n```";
    expect(remend(text)).toBe(text);
  });

  it("should handle incomplete code blocks at end of chunked response", () => {
    expect(remend("Some text\n```js\nconsole.log")).toBe(
      "Some text\n```js\nconsole.log"
    );
  });

  it("should handle code blocks with trailing content", () => {
    const text = "```\ncode\n```\nMore text";
    expect(remend(text)).toBe(text);
  });

  it("should handle complete code blocks ending with triple backticks on newline", () => {
    const text =
      '```python\ndef greet(name):\n    return f"Hello, {name}!"\n```';
    expect(remend(text)).toBe(text);
  });

  it("should handle complete code blocks with trailing newline after closing backticks", () => {
    const text =
      '```python\ndef greet(name):\n    return f"Hello, {name}!"\n```\n';
    expect(remend(text)).toBe(text);
  });

  it("should not add extra characters to complete simple code block", () => {
    // Bug report: This was being rendered with extra characters at the end
    const text =
      "```\nSimple code block\nwith multiple lines\nand some special characters: !@#$%^&*()\n```";
    expect(remend(text)).toBe(text);
  });

  it("should not add extra characters to complete Python code block with underscores and asterisks", () => {
    // Bug report: This was being rendered with **_ appended
    const text =
      '```python\ndef hello_world():\n    """A simple function"""\n    name = "World"\n    print(f"Hello, {name}!")\n    \n    # List comprehension\n    numbers = [x**2 for x in range(10) if x % 2 == 0]\n    return numbers\n\nclass TestClass:\n    def __init__(self, value):\n        self.value = value\n```';
    expect(remend(text)).toBe(text);
  });

  it("should not add backticks when code block ends properly", () => {
    // This is the exact case from Grok
    const grokOutput =
      '```python def greet(name): return f"Hello, {name}!"\n```';
    expect(remend(grokOutput)).toBe(grokOutput);
  });

  it("should handle multiple complete code blocks with newlines", () => {
    const text = "```js\ncode1\n```\n\n```python\ncode2\n```";
    expect(remend(text)).toBe(text);
  });

  it("should correctly handle code on same line as opening backticks with closing on newline", () => {
    // This was causing issues - being treated as inline when it should be multiline
    const text = '```python def greet(name): return f"Hello, {name}!"\n```';
    expect(remend(text)).toBe(text);

    // Should NOT be treated as inline triple backticks
    const result = remend(text);
    expect(result).not.toContain("````"); // Should not add extra backticks
  });

  it("should only treat truly inline triple backticks as inline", () => {
    // This SHOULD be treated as inline (no newlines)
    const inline = "```python code```";
    expect(remend(inline)).toBe(inline);

    // This should NOT be treated as inline (has newline)
    const multiline = "```python code\n```";
    expect(remend(multiline)).toBe(multiline);
  });

  it("should not treat brackets inside complete code blocks as incomplete links", () => {
    const text = `Here's some code:
\`\`\`javascript
const arr = [1, 2, 3];
console.log(arr[0]);
\`\`\`
Done with code block.`;

    const result = remend(text);
    expect(result).not.toContain("streamdown:incomplete-link");
    expect(result).toBe(text);
  });

  it("should still detect actual incomplete links outside of code blocks", () => {
    const text = `Here's a code block:
\`\`\`bash
echo "test"
\`\`\`
And here's an [incomplete link`;

    const result = remend(text);
    expect(result).toContain("streamdown:incomplete-link");
    expect(result).toBe(`Here's a code block:
\`\`\`bash
echo "test"
\`\`\`
And here's an [incomplete link](streamdown:incomplete-link)`);
  });

  it("should not add incomplete-link marker after complete code blocks - #227", () => {
    const text_content = `Precisely.

When full-screen TUI applications like **Vim**, **less**, or **htop** start, they switch the terminal into what's called the **alternate screen buffer**—a second, temporary display area separate from the main scrollback buffer.

### How it works
They send ANSI escape sequences such as:
\`\`\`bash
# Enter alternate screen buffer
echo -e "\\\\e[?1049h"

# Exit (back to normal buffer)
echo -e "\\\\e[?1049l"
\`\`\`

- \`\\\\e[?1049h\` — activates the alternate screen.
- \`\\\\e[?1049l\` — deactivates it and restores the previous view.

While in this mode:
- The "scrollback" (your regular terminal history) is hidden.
- The program gets a fresh, empty screen to draw on.
- When the program exits, the screen restores exactly as it was before.

### tmux behavior
\`tmux\` respects these escape sequences by default. When apps use the alternate buffer, tmux holds that screen separately from the main one. That's why, when you scroll in tmux during Vim, you don't see your shell history—you have to leave Vim first.

If someone wants to **disable** this behavior (so the app draws on the main screen and you can scroll back freely), they can set:
\`\`\`bash
set -g terminal-overrides 'xterm*:smcup@:rmcup@'
\`\`\`
in their \`~/.tmux.conf\`, which disables use of the alternate buffer entirely.

Would you like me to show how to conditionally toggle that behavior per app or session?`;

    const result = remend(text_content);

    // Should NOT contain incomplete-link marker
    expect(result).not.toContain("streamdown:incomplete-link");
    // Should preserve original content
    expect(result).toBe(text_content);
  });

  it("should not add extra __ after code block with underscores followed by bullet list (#300)", () => {
    const input = `\`\`\`css
/* Commentary */

[class*="WidgetTitle__Header"] {
  font-size: 18px !important;
}
\`\`\`

Notes and tips:
* Use !important only where necessary in CSS.`;

    const result = remend(input);
    expect(result).toBe(input);
    expect(result).not.toMatch(trailingDoubleUnderscorePattern); // Should not end with __
  });

  it("should handle complete code blocks with underscores followed by asterisk list (#300)", () => {
    const input = `\`\`\`python
def __init__(self):
    pass
\`\`\`

* List item`;

    const result = remend(input);
    expect(result).toBe(input);
    expect(result).not.toMatch(trailingDoubleUnderscorePattern);
  });

  it("should handle code blocks with underscores and following text with asterisks (#300)", () => {
    const input = `Here's some code:
\`\`\`javascript
const my__variable = "test";
const another_var = 5;
\`\`\`

Some notes:
* First note
* Second note`;

    const result = remend(input);
    expect(result).toBe(input);
    expect(result).not.toMatch(trailingDoubleUnderscorePattern);
  });

  it("should not add stray * from [*] in mermaid code blocks", () => {
    const input = `Here's a state diagram:

\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: fetch()
    Loading --> Success: 200 OK
    Loading --> Error: 4xx/5xx
    Error --> Loading: retry()
    Success --> Idle: reset()
\`\`\``;

    const result = remend(input);
    expect(result).toBe(input);
  });

  it("should not add stray * from [*] in incomplete mermaid code blocks (streaming)", () => {
    const input = `Here's a state diagram:

\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: fetch()`;

    const result = remend(input);
    expect(result).toBe(input);
  });

  it("should not add stray * when emphasis exists outside code block with [*] inside", () => {
    const input = `*Note:* Here's a state diagram:

\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
\`\`\``;

    const result = remend(input);
    expect(result).toBe(input);
  });

  it("should still complete emphasis when * is only outside code blocks", () => {
    const input = `\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
\`\`\`

Here is *incomplete italic`;

    const result = remend(input);
    expect(result).toBe(`\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
\`\`\`

Here is *incomplete italic*`);
  });

  it("should handle incomplete markdown after code block (#302)", () => {
    const text = `\`\`\`css
code here
\`\`\`

**incomplete bold`;
    expect(remend(text)).toBe(
      `\`\`\`css
code here
\`\`\`

**incomplete bold**`
    );
  });
});

/* Pinned parity evidence:
 * parity:fc8b9a8338fb1be76c0055e3c8c9228e2b14bd86ba7396cc56029bdee4018966
 * parity:54fa2b4a9f7aa8d30ede4cd9b74cbf8898e2e4aa5d2c50e4b2dd0d35d8831f9c
 * parity:ae6f2e708200bbff76088d4116e9882c9531054713b62ceaf53a1448134d0e93
 * parity:97ba8d5bde539c80b5fb50f35152bf9de46a5412094602d62d5f1c96a3c0a7df
 * parity:5d7a348370a7c8e54ceb2903fcebebc0c70da1becd3db17093d94e5d3676f064
 * parity:27f3637f6873b7c4cc1d8a5a573e0daab0fc6064abe3481a6d6bfd5d6cf453a8
 * parity:bc3c1d067df6f5ce26765101e28ae4d25a431274aed77b9b9b0b726047886da8
 * parity:dda1fa6c07d277fa4471129a6f28470d02d678aeb9fc7e3e186d91a7c24c9737
 * parity:862a31b9c43f42f99164fe0211d7613fd5b2a1190c78a5202815acb5a4f11204
 * parity:f807fc60d6bab72b83463f010b40a70ec9c944d253bfcad8952a2e062eb220e8
 * parity:fe66bb71fc3dee0c3740720a0ecf26e8a7f0758090a87295fbfae3ab43d9f22c
 * parity:6c9c77e346230449d41af3d054ad8030def73a55195f7ea92624023c3e2ca9f9
 * parity:8579df4b047986ba86d2ed4ceb642149d17de107cf98b6b155e0cce445a37fcc
 * parity:a9a40d8b002b4b43ac66b2a1e0f483473a3a8b9aa121ce6ca4372d4ce0bef322
 * parity:2f4c5317db3fb3335ff7641a1455af0a05adf8c2c2f88d888e56b981e7a29cd2
 * parity:3d36aa88ee4924280ddf8db99737833c6a0ba0cf148df3800ee5823504239029
 * parity:0850e41621179a21a5fa57d2a885a7e38201091b672fbddbaadf3b0b925bdba5
 * parity:1e03618f38b55448b332b61f96fd1c71609dd3189813b1fe3fa9d65a014d9788
 * parity:c942374adae14d358ea5ca29f26074a7e7132702c8e5cde57c849d01723940f7
 * parity:57faa671653c9dd4f21afd2cf2a7e1c3e442037d8f42e1b839a467b175d64a39
 * parity:72e3d723cf9192ee5db1c4e461fd90a48a6ab762a5a17f317be1e2c2f7b0d04c
 * parity:cc95b75de2fb6e94cf5cfc08a7cf8a7f03d872b76beae7fd50e8585d355a18bf
 * parity:8b9cbef328dc508972f7fcd372b984a0ff26acb52172a5ff6f2e2d3d3bae1d2f
 * parity:3c2a4739c165004741a042ca2ca86fd38b1853620d3a38c355051a90733b2eea
 * parity:9c4a40175b132d363e4561ff2603143c584f8066f34e1de491bd3278b7a1a47a
 */
