/**
 * One-off test: extract fact-find fields from a sample PDF.
 * Usage: npx tsx scripts/test-extract-fact-find.ts [path-to.pdf]
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractFactFindFromDocument } from '../lib/ai/extractFactFindFromDocument';

async function main() {
  const pdfPath =
    process.argv[2] ||
    path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'credit_report_2_david_osei.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error('PDF not found:', pdfPath);
    process.exit(1);
  }

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error('OPENROUTER_API_KEY is not set. Add it to apps/web/.env.local');
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  console.log('Extracting from:', pdfPath);
  console.log('Model:', process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001');
  console.log('---');

  const result = await extractFactFindFromDocument({
    buffer,
    filename: path.basename(pdfPath),
    mimeType: 'application/pdf',
    documentCategory: 'Adverse credit',
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
