import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { controlEnabled } from '../../../../src/controls/config';

const markdown = '| A |\n|---|\n| B |\n\n```txt\ncode\n```';
const capabilities = { clipboard: { writeText: jest.fn() }, files: { save: jest.fn() } };

describe('controls prop native configuration', () => {
  it('shows all native controls by default/true and none for false', () => {
    expect(render(<Streamdown mode="static" capabilities={capabilities}>{markdown}</Streamdown>).UNSAFE_getAllByProps({ accessibilityRole: 'toolbar' }).length).toBeGreaterThan(1);
    expect(render(<Streamdown mode="static" capabilities={capabilities} controls>{markdown}</Streamdown>).UNSAFE_getAllByProps({ accessibilityRole: 'toolbar' }).length).toBeGreaterThan(1);
    expect(render(<Streamdown mode="static" controls={false}>{markdown}</Streamdown>).UNSAFE_queryByProps({ accessibilityRole: 'toolbar' })).toBeNull();
  });
  it('supports mixed and granular table/code families', () => {
    const tableOnly = render(<Streamdown mode="static" capabilities={{ clipboard: capabilities.clipboard }} controls={{ code: false, table: { copy: true, download: false, fullscreen: false } }}>{markdown}</Streamdown>);
    expect(tableOnly.getByRole('button', { name: 'Copy table' })).toBeTruthy();
    expect(tableOnly.queryByRole('button', { name: 'Copy Code' })).toBeNull();
    expect(tableOnly.queryByRole('button', { name: 'Download table' })).toBeNull();
    const codeOnly = render(<Streamdown mode="static" capabilities={{ files: capabilities.files }} controls={{ table: false, code: { copy: false } }}>{markdown}</Streamdown>);
    expect(codeOnly.queryByRole('button', { name: 'Copy Code' })).toBeNull();
    expect(codeOnly.getByRole('button', { name: 'Download file' })).toBeTruthy();
  });
  it('exposes Mermaid pan/zoom policy for the optional renderer', () => {
    expect(controlEnabled({ mermaid: false }, 'mermaid', 'panZoom')).toBe(false);
    expect(controlEnabled({ mermaid: { panZoom: false } }, 'mermaid', 'panZoom')).toBe(false);
    expect(controlEnabled({}, 'mermaid', 'panZoom')).toBe(true);
  });
});
