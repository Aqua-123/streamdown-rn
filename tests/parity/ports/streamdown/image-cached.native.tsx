import { fireEvent, render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { SafeImage } from '../../../../src/controls/SafeImage';
import { defaultTranslations } from '../../../../src/controls/translations';
import { darkTheme } from '../../../../src/themes';

describe('ImageComponent native cached state', () => {
  // parity:8c09e7f1c50c8b8d259c66bd4760cb88f32d142302e32f2512224d140248bddd
  it('turns an unavailable native cached size into explicit image error state', () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, _success, failure) => failure?.(new Error('no dimensions')));
    const screen = render(<SafeImage uri="https://example.com/invalid.png" alt="invalid" theme={darkTheme} capabilities={{}} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'error');
    expect(screen.getByText('Image not available')).toBeTruthy();
    jest.restoreAllMocks();
  });

  it('uses native size/load state instead of DOM complete/naturalWidth', () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => success(200, 100));
    const screen = render(<SafeImage uri="https://example.com/cached.png" alt="cached" theme={darkTheme} capabilities={{}} translations={defaultTranslations} />);
    const image = screen.getByRole('image');
    fireEvent(image, 'load');
    expect(image.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ aspectRatio: 2 })]));
    jest.restoreAllMocks();
  });
  // parity:69dd080fd91eecd053e0ecddbd853649ecabe8153509c02fc7df9e3a5d5ed586
  it('turns native failure into readable retry and keeps absent src inert', () => {
    const screen = render(<SafeImage uri="https://example.com/broken.png" alt="broken" theme={darkTheme} capabilities={{}} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'error');
    expect(screen.getByRole('button', { name: 'Retry image' })).toBeTruthy();
    expect(render(<Streamdown mode="static">![]()</Streamdown>).queryByRole('image')).toBeNull();
  });
});
