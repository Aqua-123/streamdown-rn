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
