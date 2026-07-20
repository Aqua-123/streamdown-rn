import React from 'react';
import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src';

const markdown = '```js\nconst x = 1;\n```';
const numbered = (source = markdown, lineNumbers?: boolean) => render(
  React.createElement(Streamdown, { mode: 'static', lineNumbers, children: source })
);

describe('native code line numbers', () => {
  it('shows line numbers by default at the code-body level', () => {
    // parity:e242ca99b93ba606cccdf99729dd8c30a4339c970fd609fd2da1d30d887e1138
    expect(numbered().getByLabelText('Line 1')).toBeTruthy();
  });

  it('hides body line numbers when disabled', () => {
    // parity:235ee6ecd29a066823ca7656dd5d6a615011186fd8d46d456edcf3315178f891
    expect(numbered(markdown, false).queryByLabelText('Line 1')).toBeNull();
  });

  it('adds native line semantics when body line numbers are enabled', () => {
    // parity:fd26dc1324cc2540050f97d6ca76b34fbd3a2fa6f438230120034e418aca58d8
    expect(numbered(markdown, true).getByLabelText('Line 1')).toHaveTextContent('1');
  });

  it('omits native line semantics when body line numbers are disabled', () => {
    // parity:405400b0e7044eada74803f01e342d85584e7329b576e0ca68d1dfef5e40c554
    expect(numbered(markdown, false).queryByLabelText('Line 1')).toBeNull();
  });

  it('does not expose a start line when numbering is disabled', () => {
    // parity:af8a4b5fedc408e6468eda4400b9755930559f13819266a6282c57f1b55d9bb0
    expect(numbered('```js startLine=5\nconst x = 1;\n```', false).queryByLabelText('Line 5')).toBeNull();
  });

  it('starts native line semantics at the requested line', () => {
    // parity:c29aeddaafe9a9fd09500eeff4e5c39753a79709854a8af38faa2d40a9fd7a48
    expect(numbered('```js startLine=5\nconst x = 1;\n```', true).getByLabelText('Line 5')).toHaveTextContent('5');
  });

  it('renders a standalone code block with line numbers by default', () => {
    // parity:091786927fd9ab235659d40c31bc7116c3994b8bb17e412a36a72beaa13e235a
    expect(numbered().getAllByLabelText(/^Line /)).toHaveLength(1);
  });

  it('renders a standalone code block without line numbers when disabled', () => {
    // parity:7c51c885b38dd9fe5d3f19349c234c4de37c974302a92f217db2623253d6ebc6
    expect(numbered(markdown, false).queryAllByLabelText(/^Line /)).toHaveLength(0);
  });

  it('defaults Streamdown to visible native line numbers', () => {
    // parity:7283b98b4c93bca396ae019253ec2e41e0a45439dc69dc2a765a76aa5314351b
    expect(numbered().getByText('1')).toBeTruthy();
  });

  it('allows Streamdown to hide line numbers', () => {
    // parity:6ae18be13a781014cbf9377989cb29007ba9901ff8aff52f8184993cd289c940
    expect(numbered(markdown, false).queryByText('1')).toBeNull();
  });

  it('allows Streamdown to show line numbers explicitly', () => {
    // parity:287217c6897801a2911fab91e958eb8ab78bac3165db62c372adb9eb0e94a0c7
    expect(numbered(markdown, true).getByText('1')).toBeTruthy();
  });

  it('lets noLineNumbers fence metadata hide line numbers', () => {
    // parity:04522e306a1e508efa7290fbf79ec58fe1712d5b2f3ff4b9a27525724f6e50d0
    expect(numbered('```js noLineNumbers\nconst x = 1;\n```').queryAllByLabelText(/^Line /)).toHaveLength(0);
  });

  it('lets noLineNumbers metadata override explicit Streamdown numbering', () => {
    // parity:898dea09065f5dadd8b86d698abd7df64019d05a85d6afb506d63a184b8403c5
    expect(numbered('```js noLineNumbers\nconst x = 1;\n```', true).queryAllByLabelText(/^Line /)).toHaveLength(0);
  });
});
