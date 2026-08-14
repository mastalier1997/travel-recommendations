import { MOCK } from '@/lib/mock';
import type { ParseFileResponse } from '@/lib/types';
import { RAW_TEXT } from '@/lib/fixtures/sample-draft';
import { extractText } from '@/lib/import/parse-file';

// pdf-parse needs Node APIs. Also note Vercel's ~4.5MB request body cap — if that
// bites, move SheetJS to the client and keep only PDF here.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    // A request with no multipart boundary at all (not "the form was submitted
    // with an empty file field", which is handled below) — a client bug, not a
    // server error.
    return Response.json({ error: 'Expected a multipart/form-data request.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'file is required' }, { status: 400 });

  if (MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({
      text: RAW_TEXT,
      sourceKind: 'file',
      filename: file.name,
    } satisfies ParseFileResponse);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const text = await extractText({ name: file.name, buffer, mimeType: file.type });
    return Response.json({ text, sourceKind: 'file', filename: file.name } satisfies ParseFileResponse);
  } catch {
    return Response.json({ error: 'Could not read that file.' }, { status: 422 });
  }
}
