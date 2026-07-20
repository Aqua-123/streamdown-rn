export interface TableData {
  headers: string[];
  rows: string[][];
}

function escapeDelimited(value: string, delimiter: string): string {
  if (!value.includes(delimiter) && !/["\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function tableDataToCSV({ headers, rows }: TableData): string {
  return [headers, ...rows]
    .filter((row, index) => index > 0 || row.length > 0)
    .map((row) => row.map((cell) => escapeDelimited(cell, ',')).join(','))
    .join('\n');
}

export function tableDataToTSV({ headers, rows }: TableData): string {
  return [headers, ...rows]
    .filter((row, index) => index > 0 || row.length > 0)
    .map((row) =>
      row
        .map((cell) => cell.replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r'))
        .join('\t')
    )
    .join('\n');
}

export function escapeMarkdownTableCell(cell: string): string {
  return cell.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

export function tableDataToMarkdown({ headers, rows }: TableData): string {
  if (!headers.length) return '';
  const render = (row: string[]) =>
    `| ${row.map(escapeMarkdownTableCell).join(' | ')} |`;
  return [
    render(headers),
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) =>
      render(row.length < headers.length ? [...row, ...Array(headers.length - row.length).fill('')] : row)
    ),
  ].join('\n');
}
