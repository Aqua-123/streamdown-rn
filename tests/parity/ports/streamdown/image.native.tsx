import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { SafeImage } from '../../../../src/controls/SafeImage';
import { imageFileRequest } from '../../../../src/controls/serialization';
import { defaultTranslations } from '../../../../src/controls/translations';
import { darkTheme } from '../../../../src/themes';

describe('ImageComponent native outcomes', () => {
  it('rejects an unknown image MIME type instead of writing an unsafe extension', () => {
    expect(() => imageFileRequest(new Uint8Array([1]), 'application/octet-stream', 'image')).toThrow('Unsupported image MIME type');
  });

  // parity:58634fe561d7439961a895f5e1ef4513c446a18fc6d03f433b4152e5d3795056
  it('uses image as the default filename when no alt or path name is available', () => {
    expect(imageFileRequest(new Uint8Array([1]), 'image/png', '')).toMatchObject({ basename: 'image', extension: 'png' });
  });

  // parity:f51a1e79d27bfce5e51dde4266bed2e9b7333b0229acd9f900549a15db5aa7d9
  it('does not expose download without an image source', () => {
    const screen = render(<Streamdown mode="static" capabilities={{ files: { save: jest.fn() }, imageDownloads: { download: jest.fn() } }}>![]()</Streamdown>);
    expect(screen.queryByRole('button', { name: 'Download image' })).toBeNull();
  });
  // parity:adf3edf166ea1c4a423f3b804150026c0afa4ca158e5067d9a9c2cd64b346dcc
  it('renders no native image when src is not provided', () => {
    expect(render(<Streamdown mode="static">![missing]()</Streamdown>).queryByRole('image')).toBeNull();
  });

  // parity:0368517b23ace16d37c6ee1b42efd26213724c4d7921361291c0c0e0df1833a1
  it('passes supported dimensions through to the native image style', () => {
    const screen = render(<SafeImage uri="https://example.com/sized.png" alt="Sized" width={160} height={90} theme={darkTheme} capabilities={{}} translations={defaultTranslations} />);
    expect(screen.getByRole('image').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 160, height: 90 })]));
  });

  it('keeps missing sources inert and meaningful sources accessible', () => {
    const missing = render(<Streamdown mode="static">![missing]()</Streamdown>);
    expect(missing.queryByRole('image')).toBeNull();
    const image = render(<Streamdown mode="static">![Chart](https://example.com/chart.png)</Streamdown>);
    expect(image.getByRole('image', { name: 'Chart' })).toBeTruthy();
  });
  it.each([
    /* parity:93013c7747235aadaa9995885224c2d67030d6d9e732a77e26bc5eb6c1e36b3b */ ['image/png', 'png'],
    /* parity:732029781fa8e593a997f5480e34cb8b34ec6f0ab4a0f2f0b4e9c0038eb3a9a0 */ ['image/jpeg', 'jpg'],
    ['image/gif', 'gif'], ['image/webp', 'webp'],
    /* parity:dc5c1cad86e8866d078552234b225e991c93ab0b067defebb679ac9e9acaf970 */ ['image/avif', 'avif'],
  ])('maps %s bytes to a fixed extension', (mimeType, extension) => {
    expect(imageFileRequest(new Uint8Array([1]), mimeType, 'photo.png')).toMatchObject({ basename: 'photo', extension, mimeType });
  });
  // parity:904f24a695d988e3a78cda130cd393c492789ebd92dd5162290f1bebb6b8ef5e
  it('uses sanitized alt text as filename and exposes download only after load', async () => {
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const download = jest.fn().mockResolvedValue({ basename: 'Chart.png', extension: 'png', mimeType: 'image/png', content: new Uint8Array([1]) });
    const screen = render(<SafeImage uri="https://example.com/no-extension" alt="../Chart.png" theme={darkTheme} capabilities={{ files: { save }, imageDownloads: { download } }} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(expect.objectContaining({ uri: 'https://example.com/no-extension', basename: 'Chart.png' })));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ basename: 'Chart', extension: 'png', content: expect.any(Uint8Array) })));
  });
  // parity:d9881fd49fa6925364455fa58520552f11df168eeb5f63f096523427a1bc49a0
  it('renders the accessible native download action after image load', () => {
    const screen = render(<SafeImage uri="https://example.com/chart.png" alt="Chart" theme={darkTheme} capabilities={{ files: { save: jest.fn() }, imageDownloads: { download: jest.fn() } }} translations={defaultTranslations} />);
    expect(screen.queryByRole('button', { name: 'Download image' })).toBeNull();
    fireEvent(screen.getByRole('image', { name: 'Chart' }), 'load');
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
  });
  // parity:a9e2c110a0f665b52e91723ce5eee8ea24d3fa0192acb0f18cc602d549236737
  it('uses sanitized alt text as the filename when the URL has no name', async () => {
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const download = jest.fn().mockResolvedValue({ basename: 'Chart.png', extension: 'png', mimeType: 'image/png', content: new Uint8Array([1]) });
    const screen = render(<SafeImage uri="https://example.com/" alt="../Chart.png" theme={darkTheme} capabilities={{ files: { save }, imageDownloads: { download } }} translations={defaultTranslations} />);
    fireEvent(screen.getByRole('image'), 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(expect.objectContaining({ basename: 'Chart.png' })));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ basename: 'Chart' })));
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
    const download = jest.fn(async (request) => {
      expect(request.validateUrl(request.uri)).toBe(true);
      expect(request.validateUrl('https://example.com/redirected.png')).toBe(true);
      expect(request.validateUrl('https://attacker.test/redirected.png')).toBe(false);
      return { basename: 'Chart', extension: 'png', mimeType: 'image/png', content: new Uint8Array([1]) };
    });
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const screen = render(<Streamdown mode="static" urlTransform={urlTransform} capabilities={{ files: { save }, imageDownloads: { download } }}>![Chart](https://example.com/chart.png)</Streamdown>);
    fireEvent(screen.getByRole('image'), 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(expect.objectContaining({ uri: 'https://example.com/chart.png?signed=once' })));
    expect(urlTransform).toHaveBeenCalledTimes(1);
  });
});
