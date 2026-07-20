import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src/StreamdownRN';

describe('native image paragraph structure', () => {
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
