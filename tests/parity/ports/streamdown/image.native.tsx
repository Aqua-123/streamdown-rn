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
    const download = jest.fn().mockResolvedValue({ basename: 'Chart.png', extension: 'png', mimeType: 'image/png', content: new Uint8Array([1]) });
    const screen = render(<SafeImage uri="https://example.com/no-extension" alt="../Chart.png" theme={darkTheme} capabilities={{ files: { save }, imageDownloads: { download } }} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(expect.objectContaining({ uri: 'https://example.com/no-extension', basename: 'Chart.png' })));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ basename: 'Chart', extension: 'png', content: expect.any(Uint8Array) })));
  });
  it('surfaces native download failures instead of bypassing link approval with a native open', async () => {
    const download = jest.fn().mockRejectedValue(new Error('network blocked'));
    const screen = render(<SafeImage uri="https://example.com/a.png" alt="A" theme={darkTheme} capabilities={{ files: { save: jest.fn() }, imageDownloads: { download } }} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(screen.getByText('network blocked')).toBeTruthy());
  });
  it('fails closed without the explicit bounded downloader', () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const screen = render(<SafeImage uri="https://example.com/a.png" alt="A" theme={darkTheme} capabilities={{ files: { save: jest.fn() } }} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'load');
    expect(screen.queryByRole('button', { name: 'Download image' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
  it('downloads the final transformed URL without running the transform again', async () => {
    const urlTransform = jest.fn((url: string) => `${url}?signed=once`);
    const download = jest.fn().mockResolvedValue({ basename: 'Chart', extension: 'png', mimeType: 'image/png', content: new Uint8Array([1]) });
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const screen = render(<Streamdown mode="static" urlTransform={urlTransform} capabilities={{ files: { save }, imageDownloads: { download } }}>![Chart](https://example.com/chart.png)</Streamdown>);
    fireEvent(screen.getByRole('image'), 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(expect.objectContaining({ uri: 'https://example.com/chart.png?signed=once' })));
    expect(urlTransform).toHaveBeenCalledTimes(1);
  });
});
