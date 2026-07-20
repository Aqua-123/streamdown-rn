import type { Link, Root, Text } from 'mdast';
import { parseSemanticDocument } from '../../../../src/core/parser';
import { cjk, createCjkPlugin } from '../../../../src/plugins/cjk';

const parse = (markdown: string) => parseSemanticDocument(markdown, {
  before: cjk.remarkPluginsBefore,
  after: cjk.remarkPluginsAfter,
});

function collect<T extends { type: string }>(node: unknown, type: string, output: T[] = []): T[] {
  if (!node || typeof node !== 'object') return output;
  const candidate = node as { type?: string; children?: unknown[] };
  if (candidate.type === type) output.push(candidate as T);
  candidate.children?.forEach((child) => collect(child, type, output));
  return output;
}

describe('streamdown-cjk companion parity', () => {
  // parity:01ac700ec2cd5bba478b9f35c7ff94883f221629643135da055cbf1f0443ee32
  it('has the upstream name and type', () => expect(cjk).toMatchObject({ name: 'cjk', type: 'cjk' }));
  // parity:c906d5ce289c0d2e0e3d0d0e8fe0f6ce0a4f11631a9219da009b026a390c6a2c
  it('provides one before plugin', () => expect(cjk.remarkPluginsBefore).toHaveLength(1));
  // parity:c7e27dcaa69fc9a7c5d768e9b1613cb82215adf1ce935223e27905874c4deb75
  it('provides two after plugins', () => expect(cjk.remarkPluginsAfter).toHaveLength(2));
  // parity:6000d2456072645bb66d50092cbc9bf3a0cf347074a3ef3380aef2179d513bae
  it('provides the combined compatibility list', () => expect(cjk.remarkPlugins).toHaveLength(3));
  // parity:457295d741edf2d7a0c047e98cf271eacf0095d2a7bb3edd8f9db58daf6d0107
  it('creates a complete CJK plugin', () => expect(createCjkPlugin()).toMatchObject({ name: 'cjk', type: 'cjk' }));
  // parity:ca1e81b9394798f45a83ea1c12de98724f5775b83103bf73fab033ea69ed0fdd
  it('creates independent plugin arrays', () => {
    const first = createCjkPlugin();
    const second = createCjkPlugin();
    expect(first).not.toBe(second);
    expect(first.remarkPluginsBefore).not.toBe(second.remarkPluginsBefore);
    expect(first.remarkPluginsAfter).not.toBe(second.remarkPluginsAfter);
  });

  const firstLink = (markdown: string) => collect<Link>(parse(markdown), 'link')[0];
  // parity:5ca063cb109f369f51c8fda09ccd0dd6eecb580b68e807ff688394e7ad738fdb
  it('splits a full stop', () => expect(firstLink('请访问 https://example.com。谢谢').url).toBe('https://example.com'));
  // parity:3e3a15255b80a52d2ef4c3ac71990f2c5ee60176fe1bdfbc4cf99e4c254805a5
  it('splits an ideographic comma', () => expect(firstLink('链接 https://example.com，更多').url).toBe('https://example.com'));
  // parity:c60ee83effbbd6b2d5f5851bb5f99546f95f19df1ad7136b7afdbe817d93e874
  it('splits a question mark', () => expect(firstLink('访问 https://example.com？').url).toBe('https://example.com'));
  // parity:4083396ec2b3e7ed275d50c018b80d66f296ee38217b8529fb5e9c909195536d
  it('splits an exclamation mark', () => expect(firstLink('访问 https://example.com！').url).toBe('https://example.com'));
  // parity:2449c33fbc6b6b2379ce99e240df54363bd58c199b6073bfe1cfd7cf47fb8e92
  it('splits a colon', () => expect(firstLink('访问 https://example.com：后').url).toBe('https://example.com'));
  // parity:159096f32f6da53bbfeae87522236e750b4fffc970b262bc657e6dee27d3fba1
  it('splits parentheses', () => expect(firstLink('（https://example.com）').url).toBe('https://example.com'));
  // parity:2d9836e53ca9b95d2c1ccc872ed223876d7dffae1b68600d18c7318d92110baf
  it('splits bracket families', () => {
    for (const [open, close] of [['【', '】'], ['「', '」'], ['『', '』'], ['〈', '〉'], ['《', '》']]) {
      expect(firstLink(`${open}https://example.com${close}`).url).toBe('https://example.com');
    }
  });
  // parity:fd25811c3c3d363a6659c705e9f3e4a8c72b6d150e1377ab6253fb9571af1bbe
  it('does not split explicit links', () => expect(firstLink('[链接](https://example.com。谢谢)').url).toBe('https://example.com。谢谢'));
  // parity:bd38d586e7ffc155c5c3620de172b7c181b98cea33efd9d6041be6b93ae44f8e
  it('preserves autolinks without punctuation', () => expect(firstLink('Visit https://example.com/path now').url).toBe('https://example.com/path'));
  // parity:8faf8b43c6c6ad91964c79a1043fef03816a451c01dde9a8198930f2dcfa5248
  it('splits multiple autolinks', () => expect(collect<Link>(parse('https://example.com。还有 https://test.com！'), 'link').map((link) => link.url)).toEqual(['https://example.com', 'https://test.com']));
  // parity:c8c4864eb82ad6215b3d87d3d0cb2af9e02e5d7c24b2c84403c53275f62f0c17
  it('splits mailto links', () => expect(firstLink('mailto:test@example.com。谢谢').url).toBe('mailto:test@example.com'));
  // parity:0fa0705e31825dd1538cc5cb8bc55a0b5fe4fb478cce92e00820ef445e8d02b0
  it('preserves www hostnames', () => expect(new URL(firstLink('访问 www.example.com 谢谢').url).hostname).toBe('www.example.com'));
  // parity:32e00a58d8003ed0e0a78a8f952d9e26645e153aff8e891fb497ef0114cb7597
  it('does not include leading punctuation', () => expect(firstLink('。https://example.com').url).toBe('https://example.com'));
  // parity:e2076b8dca0d22a91ae44f1cc450ec47a72354d95277fa835cb5e055a1e3e379
  it('preserves links with multiple children', () => expect(firstLink('[Visit **here**](https://example.com。test)').url).toBe('https://example.com。test'));
  // parity:b40529f5c1ce60cd98c49f5ace4b066d9008e2619064335c53017f2046199d65
  it('preserves links whose label differs', () => expect(firstLink('[Click](https://example.com。test)').url).toBe('https://example.com。test'));
  // parity:972071f3fd93957740874dd404da54be70599e27c38ecadfe54ca59a9b9d511e
  it('does not create ftp autolinks', () => expect(collect<Link>(parse('ftp://example.com。test'), 'link')).toHaveLength(0));
  // parity:73b9e65bdfc100feea3af85944590261bad37c4c9195515241f740cf22d3927f
  it('skips a root link without a parent', () => {
    const root = { type: 'link', url: 'https://example.com。test', children: [{ type: 'text', value: 'https://example.com。test' }] } as unknown as Root;
    (cjk.remarkPluginsAfter[0] as () => (tree: Root) => void)()(root);
    expect((root as unknown as Link).url).toBe('https://example.com。test');
  });
  // parity:02d04a8af15b89aac6f8c51b5ae50b530f2c645c54ee70ffa3e50824d9131c5c
  it('skips unrecognized AST link prefixes', () => {
    const link = { type: 'link', url: 'ftp://example.com。test', children: [{ type: 'text', value: 'ftp://example.com。test' }] } as Link;
    const root = { type: 'root', children: [link] } as Root;
    (cjk.remarkPluginsAfter[0] as () => (tree: Root) => void)()(root);
    expect(link.url).toBe('ftp://example.com。test');
  });
  // parity:aa093c90fbdc76295e3400f040f1dfea83da9ff6ffb40ef11eaffdcb99fb6fdd
  it('recognizes every upstream punctuation boundary', () => {
    for (const punctuation of Array.from('。．，、？！：；（）【】「」『』〈〉《》')) {
      expect(firstLink(`https://example.com${punctuation}后`).url).toBe('https://example.com');
      expect(collect<Text>(parse(`https://example.com${punctuation}后`), 'text').map((node) => node.value).join('')).toContain(`${punctuation}后`);
    }
  });
});
