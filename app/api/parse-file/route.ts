import { MOCK, notImplemented } from '@/lib/mock';
import type { ParseFileResponse } from '@/lib/types';
import { RAW_TEXT } from '@/lib/fixtures/sample-draft';

// pdf-parse needs Node APIs. Also note Vercel's ~4.5MB request body cap — if that
// bites, move SheetJS to the client and keep only PDF here.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const form = await req.formData();
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

  // Track C: pdf-parse / SheetJS / plain read → raw text. Extraction stops here;
  // splitting into candidate lines is lib/import/split-lines.ts, client-side.
  return notImplemented('C');
}
