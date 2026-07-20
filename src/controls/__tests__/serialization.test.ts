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

  it('uses safe basenames and known code metadata', () => {
    expect(sanitizeBasename('../ quarterly / report ')).toBe('quarterly-report');
    expect(codeFileRequest('const x = 1', 'typescript', '../../demo')).toMatchObject({
      basename: 'demo', extension: 'ts', mimeType: 'text/typescript;charset=utf-8', content: 'const x = 1',
    });
  });

  it('accepts image bytes only with fixed safe MIME metadata', () => {
    expect(imageFileRequest(new Uint8Array([137, 80, 78, 71]), 'image/png', '../chart')).toMatchObject({
      basename: 'chart', extension: 'png', mimeType: 'image/png',
    });
    expect(() => imageFileRequest(new Uint8Array(), 'image/svg+xml')).toThrow('Unsupported image MIME type');
  });

  it('bounds downloaded image bytes before creating a file request', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/png', 'content-length': '5' }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4, 5]).buffer,
    } as Response);
    await expect(fetchImageFileRequest('https://example.com/image.png', 'image', 4))
      .rejects.toThrow('exceeds 4 bytes');
    fetchMock.mockRestore();
  });
});
