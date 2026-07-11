declare module 'pdf-parse/lib/pdf-parse.js' {
  type PdfParseResult = { text?: string; numpages?: number; info?: unknown };

  const pdfParse: (data: Buffer) => Promise<PdfParseResult>;
  export default pdfParse;
}
