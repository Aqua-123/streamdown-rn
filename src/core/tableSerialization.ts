export interface TableData {
  headers: string[];
  rows: string[][];
}

export function tableDataFromSemanticRows(rows: readonly (readonly string[])[], firstRowIsHeader = true): TableData {
  const normalized = rows.map((row) => row.map((cell) => cell.trim()));
  return firstRowIsHeader
    ? { headers: normalized[0] ? [...normalized[0]] : [], rows: normalized.slice(1).map((row) => [...row]) }
    : { headers: [], rows: normalized.map((row) => [...row]) };
}

function neutralizeSpreadsheetCell(value: string): [string, boolean] {
  const dangerous = /^[=+\-@\t\r\n＝＋－＠]/u.test(value);
  return [dangerous ? `'${value}` : value, dangerous];
}

function escapeDelimited(value: string, delimiter: string, force = false): string {
  if (!force && !value.includes(delimiter) && !/["\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function tableDataToCSV({ headers, rows }: TableData): string {
  return [headers, ...rows]
    .filter((row, index) => index > 0 || row.length > 0)
    .map((row) => row.map((cell) => {
      const [value, dangerous] = neutralizeSpreadsheetCell(cell);
      return escapeDelimited(value, ',', dangerous);
    }).join(','))
    .join('\n');
}

export function tableDataToTSV({ headers, rows }: TableData): string {
  return [headers, ...rows]
    .filter((row, index) => index > 0 || row.length > 0)
    .map((row) =>
      row
        .map((cell) => neutralizeSpreadsheetCell(cell)[0]
          .replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r'))
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
