import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';

function hasLeakedNode(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if ('node' in (record.props as Record<string, unknown> ?? {})) return true;
  return Object.values(record).some(hasLeakedNode);
}

describe('native semantic node attributes', () => {
  it('never forwards parser node objects to native host props', () => {
    const screen = render(<Streamdown mode="static">{'# H1\n\n## H2\n\n- item\n\n[link](https://example.com) `code`\n\n![alt](https://example.com/a.png)\n\n| A |\n|---|\n| B |'}</Streamdown>);
    expect(hasLeakedNode(screen.toJSON())).toBe(false);
  });
  it('still passes immutable semantic nodes to application component overrides', () => {
    const seen: unknown[] = [];
    const Header = ({ semantic }: { semantic: { node: unknown } }) => { seen.push(semantic.node); return <Text>Override</Text>; };
    render(<Streamdown mode="static" components={{ h1: Header }}># Heading</Streamdown>);
    expect(seen[0]).toMatchObject({ type: 'heading', depth: 1 });
  });
});

describe('case-specific native node forwarding proof', () => {
  it.each([
    /* parity:76878ab32b379d9379eb8290b3322e3e2e325a2469a56a1f9b3813e1b27b1afd */ ['ordered list', '1. item'],
    /* parity:8a877dfb8f1de82e66e9371614608f9cc795489179a07cc0e48058095bee73f0 */ ['unordered list', '- item'],
    /* parity:d4e7720c905c64eb85bde674b35d6d57805b6cdd172bb2dbfdfd7a025b37394c */ ['list item', '- item'],
    /* parity:2c3b6f466aedda2e80e713f8e6d15c0946c5de0563dc5072a1d8b406d37fe084 */ ['h1', '# heading'],
    /* parity:d9b652a67b435606649bd6228ece2a901f986db488eccf42855ebfe7de2c9763 */ ['h2', '## heading'],
    /* parity:d5eb988289c60232f6c616952fac1f98ead42e489893e8dbcb9b967b1f8c6259 */ ['h3', '### heading'],
    /* parity:5a62246f7e901d49a0f1683b77ff6f65d08cdaf91b112c5a170e97a80aa03a52 */ ['link', '[link](https://example.com)'],
    /* parity:a97653d7a6d030019c2e18baf4d98264de8aff75078b9e5c423bcb5934acb254 */ ['image', '![alt](https://example.com/a.png)'],
    /* parity:b065ec892f50fb9481d42e930d999456acfdec8deed1b720a47bf03d07cb4882 */ ['inline code', '`code`'],
  ])('does not forward parser nodes through %s host props', (_name, markdown) => {
    expect(hasLeakedNode(render(<Streamdown mode="static">{markdown}</Streamdown>).toJSON())).toBe(false);
  });
  // parity:314d13380c95c78e0d3b2e6caa9a18c9306810729960bf6f35c7582722062f5d
  it('does not forward parser nodes through any mixed host props', () => {
    const markdown = '# H\n\n- item\n\n[link](https://example.com) `code`\n\n![alt](https://example.com/a.png)';
    expect(hasLeakedNode(render(<Streamdown mode="static">{markdown}</Streamdown>).toJSON())).toBe(false);
  });
  it('still exposes the immutable parser node through semantic override data', () => {
    const seen: unknown[] = [];
    const Header = ({ semantic }: { semantic: { node: unknown } }) => { seen.push(semantic.node); return <Text>heading</Text>; };
    render(<Streamdown mode="static" components={{ h1: Header }}># heading</Streamdown>);
    expect(seen[0]).toMatchObject({ type: 'heading', depth: 1 });
  });
  // parity:54ddd4324c997a5e1aac518df8efbf438274e2f8ae1c41756e0ceb54f1b6246e
  it('keeps native table host props free of web data attributes', () => {
    const tree = render(<Streamdown mode="static">{'| H |\n|---|\n| B |'}</Streamdown>).toJSON();
    expect(JSON.stringify(tree)).not.toContain('data-streamdown');
    expect(hasLeakedNode(tree)).toBe(false);
  });
});
