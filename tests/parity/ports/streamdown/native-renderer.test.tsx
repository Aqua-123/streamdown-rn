import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { Streamdown } from '../../../../src';

describe('native adaptation of Streamdown rendering', () => {
  it('renders portable CommonMark and GFM semantics', () => {
    // parity:4d57a8d4d0edf1c6feb77b2a707cb2ed8f836605c99d47e0221c8ae8b89ec237
    // parity:ce67798bdb833ae44961398d60e4879bca76ebd2833c402c8776a0812edc6af7
    // parity:085e18c1dbb1f3509d40faffc7d6be2dc52b8174f2d2bd4b54cc76894c5bf506
    // parity:4c045b62dd832157f97d354a0c4579ed04e2129171a49cd597df8227b9bc0d90
    // parity:6597cc3b75a1671c4d1214b02c47752c7dd23ba414d7462b7237794fa5b4bdee
    // parity:92d730a1a0b48b0c7203ad6bf4f6a26eb549e3cf8283efaf18cc52a55b3612bc
    // parity:d66c96079f0deca84157991042e582ebfced2774f2725f72ffc0eb573f9f954b
    // parity:10b6bb15a8953e5306627f89ab031c9ec83e7f9ca330b03114af9c64adf38c32
    // parity:90a261dacb5f034d3b924d9bed4a521ba76b3445d7dd546f202a64c4971a03b6
    // parity:44debf647774f3ec7d00ed0bb14524408cda02ef222a2407da84e67fb5146aeb
    // parity:00b427856f61e92537555c337060723e33f21f4f4993c18f4f02f37d1a6371da
    // parity:9130152338e6bd77fcce90a6abdc15a43842b2df4fbaea83762c98965e522268
    // parity:d2c3c15c36bee163801631f88bf6ee718582dcc20739d16726086b9832254ebf
    // parity:5a39580744a68be1df5abdd55140a8fe3bb17efeb47adb82e8488848572a3804
    // parity:6cc5e912430930045859d8bb8c2719ab7e161fc720474f278ee15b8e7f4f906b
    // parity:8a2faf41874efe915ac8ebdb1eba521c550cff4017e80587d916b68dfe16f623
    // parity:7ab222ba3dcc3f0e886c041036ba0781f72644af3d5553202a171255c7801b1f
    // parity:d66e79c4a68f8144620131feb8a1e4f3f5363c90cbb5b6e3a64d85612845b475
    // parity:445907946ef11a48e60893034321bcc86af250a4ddb23650c778b1db043fa1fb
    // parity:4c53c514cdad88b070495f1712715e84b06f1977fef326f5cd3beca968c9c9af
    // parity:d3c425d951309b950c819610653a87840f3e85af1bff31c983fd7adecf4236d1
    const markdown = [
      '# Heading one',
      '## Heading two',
      '',
      '**bold** *italic* `inline` [link](https://example.com)',
      '',
      '> quote',
      '',
      '- first',
      '  - nested',
      '',
      '1. ordered',
      '',
      '---',
      '',
      '```ts',
      'const answer = 42;',
      '```',
      '',
      '    indented code',
      '',
      '| Head |',
      '| --- |',
      '| Cell |',
      '',
      'hard first  ',
      'hard second',
    ].join('\n');
    const screen = render(<Streamdown mode="static">{markdown}</Streamdown>);
    for (const text of [
      'Heading one', 'Heading two', 'bold', 'italic', 'inline', 'link', 'quote',
      'first', 'nested', 'ordered', 'ts', 'const answer = 42;', 'indented code', 'Head', 'Cell',
    ]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'link' })).toBeTruthy();
    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('hard first\nhard second')).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(View).some((view) => view.props.style?.height === 1)).toBe(true);
  });

  it('renders empty input without native output', () => {
    // parity:b89953afc624006d57757d415836b6fbb2cb4a3cecbe756393a8f10ebd458d5b
    // parity:0e70f9b9fc480fe813887a0164ecf840699ec8965d7d4ab730c0700cb229b524
    expect(render(<Streamdown mode="static">{''}</Streamdown>).toJSON()).toBeNull();
    expect(render(<Streamdown mode="static" />).toJSON()).toBeNull();
  });

  it('uses native semantic overrides and keeps block and inline code independent', () => {
    // parity:78363612de6a879c1fe592991b46b21526dc1d0b88434a8491e092e2b026c5fc
    // parity:e555465eb98c32ea7604979252f7e4ada61e2dd05c8c804c2052e55928283ec7
    // parity:f5fc4b8681396534bd30ab244bc51d59ec0b3ec706188db2d9daae3cac32a9ec
    // parity:bb978d6dc22f0891c5984c7437b605f7a63cdfdf2a92c4213238f8e238f7bbf1
    // parity:b386b86e598ea2b1a41090fdfdd6f4e8508b2071233523a136b5dc8a70dd4990
    // parity:b588e9fbf050697ff0d47032d266216d40fa022d31045e19bb3b45a3931c99b1
    // parity:b36c8b0aa44c89cbfcdeba0d838ff7775924c7a0cac98e2083ec91c0db5091e1
    // parity:e89287687df6b96896af4db803ca03305ccffd95c451324aabaea90896841030
    // parity:daeb0f1e44ae09cc24439fc67a03507c9d8147a652ac35947b5283a461a3f1f0
    const Override = ({ children, semantic }: { children?: React.ReactNode; semantic: { type: string } }) => (
      <Text>{semantic.type}:{children}</Text>
    );
    const screen = render(
      <Streamdown
        mode="static"
        components={{ h1: Override as never, p: Override as never, a: Override as never, pre: Override as never, inlineCode: Override as never }}
      >
        {'# heading\n\n[link](https://example.com) and `inline`\n\n```txt\nblock\n```'}
      </Streamdown>
    );
    expect(screen.getByText('heading:heading')).toBeTruthy();
    expect(screen.getByText('link:link')).toBeTruthy();
    expect(screen.getByText('inlineCode:inline')).toBeTruthy();
    expect(screen.getByText('code:block')).toBeTruthy();
  });

  it('keeps declared literal tag content readable and unformatted', () => {
    // parity:009f2e05f85169fcc07ba7b7ab2bd42288ead87272080c09d3c49639bca247a6
    // parity:a0353681b696bcfac6ad847300510ef87ce78a4e36a7237033edea278ca5162c
    // parity:089ee5a75045a308bf72e86aeb2d635adce07cddcb97e7ad28ed92fad7874c6c
    const Mention = ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>;
    const screen = render(
      <Streamdown mode="static" allowedTags={{ mention: [] }} literalTagContent={['mention']} components={{ mention: Mention as never }}>
        {'<mention>@_literal_ **bold** `code`</mention>'}
      </Streamdown>
    );
    expect(screen.getByText('@_literal_ **bold** `code`')).toBeTruthy();
    const multiline = render(
      <Streamdown mode="static" allowedTags={{ mention: [] }} literalTagContent={['mention']} components={{ mention: Mention as never }}>
        {'<mention>first\n\nsecond</mention>'}
      </Streamdown>
    );
    expect(multiline.getByText('first\n\nsecond')).toBeTruthy();
  });

  it('updates native output when plugins or component overrides change', () => {
    // parity:cdc3860d5ae5fe7c59647f5ad11a9894756cc3c04124c68b05a967bc277234e8
    // parity:8316482eb496e815117253879b556efc59b6eda78fe4d0e2dc302d2312814ff5
    // parity:f81f91f2374f7b8f07de2b96aa0adbdb6f8087d3f02a80875939a4704fc3bb58
    // parity:ccc184ce2057743c19c90a3b273a972d6d1b91a667acdc97054fc46dc3098683
    // parity:55e5fa893caa735626d408e1a5d4c9f5cfdde21eb9f6fbf7e3f4241da1ca9288
    const plugin = (value: string) => () => (tree: { children?: Array<{ children?: Array<{ value?: string }> }> }) => {
      const text = tree.children?.[0]?.children?.[0];
      if (text) text.value = value;
    };
    const First = ({ children }: { children?: React.ReactNode }) => <Text>first:{children}</Text>;
    const Second = ({ children }: { children?: React.ReactNode }) => <Text>second:{children}</Text>;
    const screen = render(
      <Streamdown isComplete remarkPlugins={[plugin('one')]} components={{ p: First as never }}>source</Streamdown>
    );
    expect(screen.getByText('first:one')).toBeTruthy();
    screen.rerender(
      <Streamdown isComplete remarkPlugins={[plugin('two')]} components={{ p: Second as never }}>source</Streamdown>
    );
    expect(screen.getByText('second:two')).toBeTruthy();
  });
});
