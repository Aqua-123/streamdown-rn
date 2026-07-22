import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src/StreamdownRN';

describe('native image paragraph structure', () => {
  // parity:2204c295eaf10e1498380c1e16def32eb1fce4e91d04cdfab7a4041925a1dbb7
  it('places a standalone image in a native semantic container without a paragraph wrapper', () => {
    const screen = render(<Streamdown mode="static">![One](https://example.com/1.png)</Streamdown>);
    expect(screen.getByRole('image', { name: 'One' })).toBeTruthy();
    expect(screen.queryByText('![One](https://example.com/1.png)')).toBeNull();
  });

  // parity:c19e6630747bc9d0f9a4afa09bda37f3a4b46fd74ed1c15d017cf20a671af0ef
  it('renders ordinary paragraph text as readable native text', () => {
    expect(render(<Streamdown mode="static">Normal paragraph text</Streamdown>).getByText('Normal paragraph text')).toBeTruthy();
  });

  // parity:46b211fa07e02bc21bb62d74ab6ebbe43a22cf0cbe3fa99c7e10fd95d81ceddd
  it('keeps text and an inline image readable in the same paragraph', () => {
    const screen = render(<Streamdown mode="static">Before ![Two](https://example.com/2.png) after</Streamdown>);
    expect(screen.getByText('Before ')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Two' })).toBeTruthy();
    expect(screen.getByText(' after')).toBeTruthy();
  });

  // parity:844d31aa7c35e46cded6a0c64dd9c3019b6965b849b1052a90d6f32d4b59a635
  it('renders standalone, mixed, and multiple images without raw strings under View', () => {
    const standalone = render(<Streamdown mode="static">![One](https://example.com/1.png)</Streamdown>);
    expect(standalone.getByRole('image', { name: 'One' })).toBeTruthy();
    const paragraph = render(<Streamdown mode="static">Normal paragraph text</Streamdown>);
    expect(paragraph.getByText('Normal paragraph text')).toBeTruthy();
    const mixed = render(<Streamdown mode="static">Before ![Two](https://example.com/2.png) after</Streamdown>);
    expect(mixed.getByText('Before ')).toBeTruthy();
    expect(mixed.getByRole('image', { name: 'Two' })).toBeTruthy();
    const many = render(<Streamdown mode="static">{'![A](https://example.com/a.png)\n\n![B](https://example.com/b.png)'}</Streamdown>);
    expect(many.getAllByRole('image')).toHaveLength(2);
  });
});
