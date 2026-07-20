import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { SafeImage } from '../../../../src/controls/SafeImage';
import { imageFileRequest } from '../../../../src/controls/serialization';
import { defaultTranslations } from '../../../../src/controls/translations';
import { darkTheme } from '../../../../src/themes';

describe('ImageComponent native outcomes', () => {
  it('keeps missing sources inert and meaningful sources accessible', () => {
    const missing = render(<Streamdown mode="static">![missing]()</Streamdown>);
    expect(missing.queryByRole('image')).toBeNull();
    const image = render(<Streamdown mode="static">![Chart](https://example.com/chart.png)</Streamdown>);
    expect(image.getByRole('image', { name: 'Chart' })).toBeTruthy();
  });
  it.each([
    ['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/gif', 'gif'], ['image/webp', 'webp'], ['image/avif', 'avif'],
  ])('maps %s bytes to a fixed extension', (mimeType, extension) => {
    expect(imageFileRequest(new Uint8Array([1]), mimeType, 'photo.png')).toMatchObject({ basename: 'photo', extension, mimeType });
  });
  it('uses sanitized alt text as filename and exposes download only after load', async () => {
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const response = { ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => new Uint8Array([1]).buffer };
    jest.spyOn(global, 'fetch').mockResolvedValue(response as unknown as Response);
    const screen = render(<SafeImage uri="https://example.com/no-extension" alt="../Chart.png" theme={darkTheme} capabilities={{ files: { save } }} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ basename: 'Chart', extension: 'png', content: expect.any(Uint8Array) })));
    jest.restoreAllMocks();
  });
  it('surfaces fetch failures instead of bypassing link approval with a native open', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network blocked'));
    const screen = render(<SafeImage uri="https://example.com/a.png" alt="A" theme={darkTheme} capabilities={{ files: { save: jest.fn() } }} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(screen.getByText('network blocked')).toBeTruthy());
    jest.restoreAllMocks();
  });
});
