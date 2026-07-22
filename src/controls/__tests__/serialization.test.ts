import {
  codeFileRequest,
  fetchImageFileRequest,
  imageFileRequest,
  sanitizeBasename,
  serializeTable,
  tableFileRequest,
} from '../serialization';

const table = { headers: ['Name', 'City'], rows: [['Zoë', '東京']] };

describe('native control serialization', () => {
  // parity:e6e16f2bbf4f3ff60c8c1af998eebbbf11950a2545cf61eae107e84cf86d797d
  // parity:ab628a12d550497b2720fae5604c3496fcc780d7890b98ef37739ff447c5fa1d
  it('serializes table text in CSV, TSV, and Markdown', () => {
    expect(serializeTable(table, 'csv')).toBe('Name,City\nZoë,東京');
    expect(serializeTable(table, 'tsv')).toBe('Name\tCity\nZoë\t東京');
    expect(serializeTable(table, 'markdown')).toContain('| Zoë | 東京 |');
  });

  it('adds a UTF-8 BOM only to downloaded CSV and fixes file metadata', () => {
    expect(tableFileRequest(table, 'csv', '../scores').content).toBe('\uFEFFName,City\nZoë,東京');
    expect(tableFileRequest(table, 'csv', '../scores')).toMatchObject({
      basename: 'scores', extension: 'csv', mimeType: 'text/csv;charset=utf-8',
    });
  });

  it('shares spreadsheet formula neutralization across clipboard and CSV files', () => {
    const unsafe = { headers: ['=Name'], rows: [['@SUM("a,b")']] };
    expect(serializeTable(unsafe, 'csv')).toBe('"\'=Name"\n"\'@SUM(""a,b"")"');
    expect(serializeTable(unsafe, 'tsv')).toBe("'=Name\n'@SUM(\"a,b\")");
    expect(serializeTable(unsafe, 'markdown')).toBe('| =Name |\n| --- |\n| @SUM("a,b") |');
    expect(tableFileRequest(unsafe, 'csv').content).toBe('\uFEFF"\'=Name"\n"\'@SUM(""a,b"")"');
  });

  it('uses safe basenames and known code metadata', () => {
    expect(sanitizeBasename('../ quarterly / report ')).toBe('quarterly-report');
    expect(codeFileRequest('const x = 1', 'typescript', '../../demo')).toMatchObject({
      basename: 'demo', extension: 'ts', mimeType: 'text/typescript;charset=utf-8', content: 'const x = 1',
    });
  });

  it.each([
    ['jsx', 'jsx'], ['tsx', 'tsx'], ['c', 'c'], ['cpp', 'cpp'], ['c++', 'cpp'],
    ['csharp', 'cs'], ['c#', 'cs'], ['go', 'go'], ['java', 'java'], ['rust', 'rs'],
    ['rs', 'rs'], ['shellscript', 'sh'], ['sh', 'sh'],
  ])('maps %s code downloads to .%s', (language, extension) => {
    expect(codeFileRequest('source', language).extension).toBe(extension);
  });

  it('keeps unknown code downloads on the .txt fallback', () => {
    expect(codeFileRequest('source', 'unknown').extension).toBe('txt');
  });

  it('accepts image bytes only with fixed safe MIME metadata', () => {
    expect(imageFileRequest(new Uint8Array([137, 80, 78, 71]), 'image/png', '../chart')).toMatchObject({
      basename: 'chart', extension: 'png', mimeType: 'image/png',
    });
    expect(() => imageFileRequest(new Uint8Array(), 'image/svg+xml')).toThrow('Unsupported image MIME type');
  });

  it('fails closed without allocating a response body when no bounded capability exists', async () => {
    const allocate = jest.fn(async () => new ArrayBuffer(1024));
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      headers: new Headers({ 'content-type': 'image/png' }), arrayBuffer: allocate,
    } as Response);
    await expect(fetchImageFileRequest('https://example.com/missing-length.png'))
      .rejects.toThrow('bounded native imageDownloads capability');
    await expect(fetchImageFileRequest('https://example.com/false-small-length.png'))
      .rejects.toThrow('bounded native imageDownloads capability');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(allocate).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('delegates redirect, byte, MIME, and timeout enforcement to the explicit capability', async () => {
    const download = jest.fn(async (request) => {
      expect(request).toMatchObject({
        uri: 'https://example.com/image.png', basename: 'Chart', maxBytes: 4, timeoutMs: 1234,
        mimeTypes: expect.arrayContaining(['image/png', 'image/avif']),
      });
      expect([
        'https://example.com/image.png',
        'https://cdn.example.com/one',
        'https://cdn.example.com/two',
      ].every(request.validateUrl)).toBe(true);
      expect(request.validateUrl('http://cdn.example.com/final')).toBe(false);
      return { basename: request.basename, extension: 'wrong', mimeType: 'image/png', content: new Uint8Array([1, 2, 3, 4]) };
    });
    await expect(fetchImageFileRequest('https://example.com/image.png', '../Chart', 4, 1234, { download }))
      .resolves.toMatchObject({ basename: 'Chart', extension: 'png', mimeType: 'image/png' });
  });

  it('rejects invalid capability results before saving them', async () => {
    await expect(fetchImageFileRequest('https://example.com/image', 'image', 1, 1000, {
      download: async () => ({ basename: 'image', extension: 'png', mimeType: 'image/png', content: new Uint8Array([1, 2]) }),
    })).rejects.toThrow('exceeds 1 bytes');
    await expect(fetchImageFileRequest('https://example.com/image', 'image', 1, 1000, {
      download: async () => ({ basename: 'image', extension: 'svg', mimeType: 'image/svg+xml', content: new Uint8Array([1]) }),
    })).rejects.toThrow('Unsupported image MIME type');
  });
});
