import type { Node, Parent, Root } from 'mdast';
import { parseSemanticDocument } from '../../../../src/core/parser';
import { applySecurityPolicy, sanitizeResourceURL } from '../../../../src/core/security';

function nodeTypes(root: Root): string[] {
  const types: string[] = [];
  const visit = (node: Node) => {
    types.push(node.type);
    if ('children' in node) (node as Parent).children.forEach(visit);
  };
  visit(root);
  return types;
}

function firstUrl(root: Root): string | undefined {
  const paragraph = root.children[0] as Parent;
  return (paragraph.children.find((node) => 'url' in node) as { url?: string } | undefined)?.url;
}

describe('adapted upstream security and filtering semantics', () => {
  // parity:8712cedad0f0edc19c0be9d2f706920fd11c2a2364d5b77abeb46bedd5063b6c
  // parity:f465da020e812aee6cd07f35289f3d44d254f647ddd9cd1534011d111ecba083
  it('keeps safe identity URL transforms while revalidating the result', () => {
    const result = applySecurityPolicy(
      parseSemanticDocument('[link](https://example.com)'),
      { urlTransform: (url) => url }
    );
    expect(firstUrl(result)).toBe('https://example.com');
  });

  // parity:d11b96cd4f1ac6cf2d966e7d078e2ebdcd6262d095bc009d7e041a01a97ccc7d
  // parity:9213509db254505de3ae9e2d6f18a8987b025c1f4723523b7789c6726987c1fa
  it('transforms URLs before validating the native sink', () => {
    const result = applySecurityPolicy(
      parseSemanticDocument('[link](http://example.com)'),
      { urlTransform: (url) => url.replace('http://', 'https://') }
    );
    expect(firstUrl(result)).toBe('https://example.com');
  });

  // parity:e7200eec7d2d2bf6829be65b4acd982929e954a1436295bb76cc61926ecc8a04
  // parity:2af3c1dd881aca14823264f2b88b22296ac0bdbf2ec7142a54e0500956995a14
  it('removes URLs rejected by the host transform', () => {
    const nullResult = applySecurityPolicy(
      parseSemanticDocument('[link](https://example.com)'),
      { urlTransform: () => null }
    );
    const emptyResult = applySecurityPolicy(
      parseSemanticDocument('[link](https://example.com)'),
      { urlTransform: () => '' }
    );
    expect(firstUrl(nullResult)).toBeUndefined();
    expect(firstUrl(emptyResult)).toBeUndefined();
  });

  // parity:b4ab76743f91569ad4b2422de2a4fa12910ae5d43a1ee0f2c500f27aeafb7538
  // parity:5c0f888c8df228b845a5c38b0d3521f30b5918dbd5ecd0c0b7e8a9c794751fb8
  // parity:4a39929860942069d5dd83ae9614a6894ce60b7f358600f8ffc14d9a96f08738
  it('retains only allowed semantic elements and drops disallowed children by default', () => {
    const result = applySecurityPolicy(
      parseSemanticDocument('**bold** and *italic*'),
      { allowedElements: ['p', 'strong'] }
    );
    expect(nodeTypes(result)).toContain('strong');
    expect(nodeTypes(result)).not.toContain('emphasis');
    expect(JSON.stringify(result)).not.toContain('italic');
  });

  // parity:3f6e8325ce477ab869b773bd7f0c10d45fe66e923148c3679b1d90a547d39312
  // parity:584155fda48f71869bcb2aa34e37ef2c98181791abf530d5f3060fa7b565a02f
  // parity:796e08d59a51630ff15a4e498353835e673fe6cc7f75c02e39625e6d6719b55e
  it('removes only explicitly disallowed semantic elements', () => {
    const result = applySecurityPolicy(
      parseSemanticDocument('**bold** and *italic*'),
      { disallowedElements: ['strong'] }
    );
    expect(nodeTypes(result)).not.toContain('strong');
    expect(nodeTypes(result)).toContain('emphasis');
  });

  // parity:4d6a1822bfdb5f2e43efe49a0aa075f883cd60035f6ab5236ce028d66f9c67ec
  // parity:a5c8b18c31f025f114edb35203e66cdc2fcc911e8c4f1d28affe72861a008147
  // parity:024b2f5e15e5d1f9a22498a5a7bfb775e976808e0c125d1e5ebbed02be0717af
  it('composes the allow callback with the static allowlist', () => {
    const result = applySecurityPolicy(parseSemanticDocument('# H1\n\n## H2\n\nText'), {
      allowedElements: ['h1', 'h2', 'p'],
      allowElement: (node) =>
        node.type !== 'heading' || (node as unknown as { depth: number }).depth !== 2,
    });
    const depths = result.children
      .filter((node) => node.type === 'heading')
      .map((node) => node.depth);
    expect(depths).toEqual([1]);
    expect(nodeTypes(result)).toContain('paragraph');
  });

  // parity:732dd03faf508792309dbc4a775f62bf5cb2c942e636734cf44912d6ccc65954
  // parity:7436774b5d4f97a27df1071b053d93dd51b190c6d355dd9367d23de3bac501b9
  // parity:32470d0f031aa7e4cc4d96dfaeae9ac9d4e47d6bc727c1d7bedfa954e1def0e0
  it('unwraps rejected elements when requested', () => {
    const result = applySecurityPolicy(parseSemanticDocument('**bold** and *italic*'), {
      allowedElements: ['p', 'em'],
      unwrapDisallowed: true,
    });
    expect(nodeTypes(result)).not.toContain('strong');
    expect(nodeTypes(result)).toContain('emphasis');
    expect(JSON.stringify(result)).toContain('bold');
  });

  // parity:4834ac6a610744598ba9c2bb26ac7d1e44ce23f9b4b79fd9092d0d444572f0ff
  // parity:5285ea900af18f1772839b4a190e857253a781d91ed3f76be57ed6ad8ef376e4
  // parity:579e34f8f1b80fd33a38961b0c0a88d15d0251876e2ea998f403afe8ebc1606e
  // parity:071f3188fcf930d8f61f6bb66de04a71f2468dacc15312eb3df589d8b3cfcef8
  it('strips raw HTML when requested', () => {
    const result = applySecurityPolicy(
      parseSemanticDocument('before <b>bold</b> after'),
      { skipHtml: true }
    );
    expect(nodeTypes(result)).not.toContain('html');
    expect(JSON.stringify(result)).not.toContain('<b>');
  });

  // parity:ee1aa0c6b05c9060a8bc228c97c211f4d6c40e7a7dffb51566353da7b270d4c5
  // parity:db179a70d70ade9b8327076acd8ac4ba6acf0cd2f76825981e203541025ae0db
  it('converts raw HTML to inert readable text by default', () => {
    const result = applySecurityPolicy(parseSemanticDocument('before <b>bold</b> after'));
    expect(nodeTypes(result)).not.toContain('html');
    expect(JSON.stringify(result)).toContain('<b>');
  });

  // parity:b0ef11be7fe9e0d4324724b393cc3b6212213fe0eee5ce377e5e0825a3669991
  it('applies URL transformation and element filtering in one boundary', () => {
    const result = applySecurityPolicy(
      parseSemanticDocument('**bold** *italic* [link](https://example.com)'),
      {
        allowedElements: ['p', 'strong', 'a'],
        urlTransform: (url) => `${url}?proxied=1`,
      }
    );
    expect(firstUrl(result)).toBe('https://example.com?proxied=1');
    expect(nodeTypes(result)).not.toContain('emphasis');
  });

  // parity:ce8f387da5f25b7daa80307dfa0f44d3bb29136606c6711d4e05673c7d154dfa
  // parity:35b10185236afb89d392aa216a46728f098cc80f8afdb8a8677f25f02f7ef8a0
  // parity:aef48a6a20badb9ba70248a7cad408ad787cba34d1371171aa49e26d2829755c
  it('allows telephone, mail, and HTTP links through the native link policy', () => {
    expect(sanitizeResourceURL('tel:01392498505', 'link')).toBe('tel:01392498505');
    expect(sanitizeResourceURL('tel:+44-1392-498505', 'link')).toBe('tel:+44-1392-498505');
    expect(sanitizeResourceURL('mailto:foo@example.com', 'link')).toBe('mailto:foo@example.com');
    expect(sanitizeResourceURL('http://example.com', 'link')).toBe('http://example.com');
  });
});
