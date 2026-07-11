import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDocument, type ReportDocumentProps } from '@/components/pdf/ReportDocument';
import { uploadToR2 } from '@/lib/storage/r2';

export async function generateReportPdfBuffer(
  report: ReportDocumentProps['report'],
): Promise<Buffer> {
  const element = React.createElement(ReportDocument, { report });
  return renderToBuffer(
    element as unknown as React.ReactElement<import('@react-pdf/renderer').DocumentProps>,
  );
}

export async function generateAndUploadReportPdf(
  report: ReportDocumentProps['report'],
): Promise<string> {
  const buffer = await generateReportPdfBuffer(report);
  const key = `reports/${report.id}/suitability_report_${Date.now()}.pdf`;
  return uploadToR2(buffer, key, 'application/pdf');
}
