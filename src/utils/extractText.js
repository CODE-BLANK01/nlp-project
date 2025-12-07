// src/utils/extractText.js
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Stream PDF and extract page-by-page text
 */
export async function extractTextFromPDF(buffer) {
  const pdf = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  const pages = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const text = tc.items.map(it => it.str ?? '').join(' ').trim();
    if (text) pages.push(text);
  }

  return pages; // returns array of per-page text
}

/**
 * For plain text files
 */
export function extractTextFromTXT(buffer) {
  return buffer.toString('utf8').trim().split(/\n{2,}/); // split paragraphs
}

/**
 * Auto-detect extractor
 */
export async function extractTextFromFile(buffer, mimetype, filename = '') {
  if (mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    return await extractTextFromPDF(buffer);
  }
  if (mimetype.startsWith('text/')) {
    return extractTextFromTXT(buffer);
  }
  throw new Error(`Unsupported file type: ${mimetype}`);
}