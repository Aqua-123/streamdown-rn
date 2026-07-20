export interface StreamdownTranslations {
  close: string;
  copied: string;
  copyCode: string;
  copyLink: string;
  copyTable: string;
  copyTableAsCsv: string;
  copyTableAsMarkdown: string;
  copyTableAsTsv: string;
  downloadFile: string;
  downloadDiagram: string;
  downloadDiagramAsMmd: string;
  downloadDiagramAsPng: string;
  downloadDiagramAsSvg: string;
  downloadImage: string;
  downloadTable: string;
  downloadTableAsCsv: string;
  downloadTableAsMarkdown: string;
  exitFullscreen: string;
  externalLinkWarning: string;
  imageNotAvailable: string;
  openExternalLink: string;
  openLink: string;
  mermaidFormatMmd: string;
  mermaidFormatPng: string;
  mermaidFormatSvg: string;
  retryImage: string;
  streamingResponse: string;
  tableFullscreen: string;
  tableFormatCsv: string;
  tableFormatMarkdown: string;
  tableFormatTsv: string;
  unavailable: string;
  viewFullscreen: string;
}

export const defaultTranslations: StreamdownTranslations = {
  close: 'Close',
  copied: 'Copied',
  copyCode: 'Copy Code',
  copyLink: 'Copy link',
  copyTable: 'Copy table',
  copyTableAsCsv: 'Copy table as CSV',
  copyTableAsMarkdown: 'Copy table as Markdown',
  copyTableAsTsv: 'Copy table as TSV',
  downloadFile: 'Download file',
  downloadDiagram: 'Download diagram',
  downloadDiagramAsMmd: 'Download diagram as MMD',
  downloadDiagramAsPng: 'Download diagram as PNG',
  downloadDiagramAsSvg: 'Download diagram as SVG',
  downloadImage: 'Download image',
  downloadTable: 'Download table',
  downloadTableAsCsv: 'Download table as CSV',
  downloadTableAsMarkdown: 'Download table as Markdown',
  exitFullscreen: 'Exit fullscreen',
  externalLinkWarning: "You're about to visit an external website.",
  imageNotAvailable: 'Image not available',
  openExternalLink: 'Open external link?',
  openLink: 'Open link',
  mermaidFormatMmd: 'MMD',
  mermaidFormatPng: 'PNG',
  mermaidFormatSvg: 'SVG',
  retryImage: 'Retry image',
  streamingResponse: 'Streaming response',
  tableFullscreen: 'Table fullscreen',
  tableFormatCsv: 'CSV',
  tableFormatMarkdown: 'Markdown',
  tableFormatTsv: 'TSV',
  unavailable: 'Unavailable',
  viewFullscreen: 'View fullscreen',
};

export function resolveTranslations(overrides?: Partial<StreamdownTranslations>): StreamdownTranslations {
  return { ...defaultTranslations, ...overrides };
}
