import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

interface ReportSection {
  id: string;
  title: string;
  content: string;
  complianceFlag: string;
}

export interface ReportDocumentProps {
  report: {
    id: string;
    templateType: string;
    sections: ReportSection[] | unknown;
    createdAt: Date | string;
    case: {
      referenceNumber: string;
      client: {
        firstName: string;
        lastName: string;
      };
    };
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
    color: '#333333',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#4a5568',
  },
  meta: {
    marginTop: 10,
    fontSize: 9,
    color: '#718096',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2b6cb0',
    marginBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
  },
  content: {
    fontSize: 10,
    textAlign: 'justify',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    fontSize: 8,
    color: '#a0aec0',
    textAlign: 'center',
  },
});

export const ReportDocument: React.FC<ReportDocumentProps> = ({ report }) => {
  const sections: ReportSection[] = Array.isArray(report.sections)
    ? report.sections
    : typeof report.sections === 'string'
      ? JSON.parse(report.sections)
      : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Mortgage Suitability Report</Text>
          <Text style={styles.subtitle}>Template Type: {report.templateType}</Text>
          <View style={styles.meta}>
            <Text>
              Client: {report.case?.client?.firstName} {report.case?.client?.lastName}
            </Text>
            <Text>Case Reference: {report.case?.referenceNumber}</Text>
            <Text>Date Generated: {new Date(report.createdAt).toLocaleDateString('en-GB')}</Text>
          </View>
        </View>

        {sections.map((section, idx) => (
          <View key={section.id || idx} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.content}>{section.content}</Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages} — Confidential — KO Financials`
          }
          fixed
        />
      </Page>
    </Document>
  );
};
