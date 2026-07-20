import { fireEvent, render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { SafeImage } from '../../../../src/controls/SafeImage';
import { defaultTranslations } from '../../../../src/controls/translations';
import { darkTheme } from '../../../../src/themes';

describe('ImageComponent native cached state', () => {
  it('uses native size/load state instead of DOM complete/naturalWidth', () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => success(200, 100));
    const screen = render(<SafeImage uri="https://example.com/cached.png" alt="cached" theme={darkTheme} capabilities={{}} translations={defaultTranslations} />);
    const image = screen.getByRole('image');
    fireEvent(image, 'load');
    expect(image.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ aspectRatio: 2 })]));
    jest.restoreAllMocks();
  });
  it('turns native failure into readable retry and keeps absent src inert', () => {
    const screen = render(<SafeImage uri="https://example.com/broken.png" alt="broken" theme={darkTheme} capabilities={{}} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'error');
    expect(screen.getByRole('button', { name: 'Retry image' })).toBeTruthy();
    expect(render(<Streamdown mode="static">![]()</Streamdown>).queryByRole('image')).toBeNull();
  });
});
