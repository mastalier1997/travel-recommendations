export type UploadedFile = { name: string; buffer: Buffer; mimeType: string };

/**
 * Extracts raw text from an uploaded file, dispatched by extension. Splitting that
 * text into candidate lines is split-lines.ts's job, client-side — this stops at
 * "here is the text the file contained."
 */
export async function extractText(file: UploadedFile): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'pdf' || file.mimeType === 'application/pdf') {
    return extractPdf(file.buffer);
  }
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return extractSpreadsheet(file.buffer);
  }
  // md / txt / anything else: treat as plain text.
  return file.buffer.toString('utf-8');
}

// pdf-parse inserts one of these between every page's text. Real page content,
// stripped so it never becomes a bogus candidate line downstream.
const PDF_PAGE_SEPARATOR = /^--\s*\d+\s+of\s+\d+\s*--$/;

async function extractPdf(buffer: Buffer): Promise<string> {
  // v2's API is a class, not the v1 `pdf(buffer)` function most examples show.
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const { text } = await parser.getText();
    return text
      .split('\n')
      .filter((line) => !PDF_PAGE_SEPARATOR.test(line.trim()))
      .join('\n');
  } finally {
    await parser.destroy();
  }
}

async function extractSpreadsheet(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return '';

  // First column of every row — "one place per line" is the convention the rest of
  // the import pipeline expects, so a spreadsheet just becomes that.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  return rows
    .map((r) => String(r[0] ?? '').trim())
    .filter(Boolean)
    .join('\n');
}
