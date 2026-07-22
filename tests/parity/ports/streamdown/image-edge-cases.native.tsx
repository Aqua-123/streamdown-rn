import { fireEvent, render } from '@testing-library/react-native';
import { SafeImage } from '../../../../src/controls/SafeImage';
import { darkTheme } from '../../../../src/themes';
import { defaultTranslations } from '../../../../src/controls/translations';

describe('ImageComponent native events', () => {
  // parity:9479dda99cba0e8b90bea444513890a7a2d896863091122b9ae3fb0aff50b984
  it('handles a cached native image with valid dimensions', () => {
    const screen = render(<SafeImage uri="https://example.com/cached.png" alt="Cached" width={200} height={100} theme={darkTheme} capabilities={{ files: { save: jest.fn() }, imageDownloads: { download: jest.fn() } }} translations={defaultTranslations} />);
    expect(screen.getByRole('image').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 200, height: 100 })]));
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
  });

  // parity:9d282f367cc43a911dd32c0b20cde1bdb4c8b390c4b9df07d52425bbc8c66049
  it('calls the native onLoad callback after the image loads', () => {
    const onLoad = jest.fn();
    const screen = render(<SafeImage uri="https://example.com/load.png" alt="Load" theme={darkTheme} capabilities={{}} translations={defaultTranslations} onLoad={onLoad} />);
    fireEvent(screen.getByRole('image'), 'load');
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  // parity:8a1224018c1dda742e7388d9c731ed233197408b19af7094c8c8f6aad358f734
  it('shows download immediately when explicit dimensions are supplied', () => {
    const screen = render(<SafeImage uri="https://example.com/sized.png" alt="Sized" width={320} height={180} theme={darkTheme} capabilities={{ files: { save: jest.fn() }, imageDownloads: { download: jest.fn() } }} translations={defaultTranslations} />);
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
  });

  it('replaces a failed explicitly sized image with an accessible fallback', () => {
    const screen = render(<SafeImage uri="https://example.com/broken.png" alt="Broken" width={320} height={180} theme={darkTheme} capabilities={{}} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'error');
    expect(screen.getByText('Image not available')).toBeTruthy();
  });

  // parity:4951d45ad234d2037c8d154ef1f1c519dd7a595883b340860b462f06903f5d1a
  it('forwards native load and failure events', () => {
    const onLoad = jest.fn();
    const onError = jest.fn();
    const screen = render(<SafeImage uri="https://example.com/a.png" alt="A" theme={darkTheme} capabilities={{}} translations={defaultTranslations} onLoad={onLoad} onError={onError} />);
    const image = screen.getByRole('image');
    fireEvent(image, 'load');
    expect(onLoad).toHaveBeenCalledTimes(1);
    fireEvent(image, 'error', { nativeEvent: { error: 'network' } });
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
