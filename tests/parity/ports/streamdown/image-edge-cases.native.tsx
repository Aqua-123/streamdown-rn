import { fireEvent, render } from '@testing-library/react-native';
import { SafeImage } from '../../../../src/controls/SafeImage';
import { darkTheme } from '../../../../src/themes';
import { defaultTranslations } from '../../../../src/controls/translations';

describe('ImageComponent native events', () => {
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
