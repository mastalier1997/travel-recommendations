import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { extractText } from './parse-file';

describe('extractText — plain text', () => {
  it('decodes .txt and .md as-is', async () => {
    const buffer = Buffer.from('Fushimi Inari\nNishiki Market', 'utf-8');
    expect(await extractText({ name: 'places.txt', buffer, mimeType: 'text/plain' })).toBe(
      'Fushimi Inari\nNishiki Market',
    );
    expect(await extractText({ name: 'places.md', buffer, mimeType: 'text/markdown' })).toBe(
      'Fushimi Inari\nNishiki Market',
    );
  });
});

describe('extractText — spreadsheet', () => {
  function xlsxBuffer(rows: string[][]): Buffer {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  it('reads the first column of every row, one place per line', async () => {
    const buffer = xlsxBuffer([
      ['Fushimi Inari', 'temple'],
      ['Nishiki Market', 'market'],
    ]);
    const text = await extractText({
      name: 'trip.xlsx',
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(text).toBe('Fushimi Inari\nNishiki Market');
  });

  it('skips blank first-column cells', async () => {
    const buffer = xlsxBuffer([['Fushimi Inari'], [''], ['Nishiki Market']]);
    const text = await extractText({ name: 'trip.xlsx', buffer, mimeType: '' });
    expect(text).toBe('Fushimi Inari\nNishiki Market');
  });

  it('reads a .csv the same way', async () => {
    const buffer = Buffer.from('Fushimi Inari,temple\nNishiki Market,market\n', 'utf-8');
    expect(await extractText({ name: 'trip.csv', buffer, mimeType: 'text/csv' })).toBe(
      'Fushimi Inari\nNishiki Market',
    );
  });

  it('returns empty text for an empty workbook', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Sheet1');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    expect(await extractText({ name: 'empty.xlsx', buffer, mimeType: '' })).toBe('');
  });
});

describe('extractText — pdf', () => {
  it('extracts a text run from a minimal one-page PDF', async () => {
    const buffer = minimalPdf('Fushimi Inari');
    const text = await extractText({ name: 'trip.pdf', buffer, mimeType: 'application/pdf' });
    expect(text).toContain('Fushimi Inari');
  }, 15_000);

  it('strips the page-separator line pdf-parse inserts, so it never becomes a candidate line', async () => {
    const buffer = minimalPdf('Fushimi Inari');
    const text = await extractText({ name: 'trip.pdf', buffer, mimeType: 'application/pdf' });
    expect(text).not.toMatch(/--\s*\d+\s+of\s+\d+\s*--/);
  }, 15_000);
});

/**
 * Builds the smallest PDF pdf.js will actually parse. The xref table intentionally
 * points at offset 0 for every object — pdf.js detects that as unusable and falls
 * back to scanning the file for `N G obj` markers directly, which is far more
 * forgiving than hand-computing exact byte offsets for a one-off test fixture.
 */
function minimalPdf(text: string): Buffer {
  const escaped = text.replace(/([()\\])/g, '\\$1');
  const stream = `BT /F1 24 Tf 10 100 Td (${escaped}) Tj ET`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  const body = objects.map((obj, i) => `${i + 1} 0 obj\n${obj}\nendobj\n`).join('');
  const xrefEntries = ['0000000000 65535 f \n', ...objects.map(() => '0000000000 00000 n \n')].join(
    '',
  );

  const pdf =
    '%PDF-1.4\n' +
    body +
    `xref\n0 ${objects.length + 1}\n${xrefEntries}` +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n0\n%%EOF`;

  return Buffer.from(pdf, 'utf-8');
}
