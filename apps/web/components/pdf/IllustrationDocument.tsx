import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { IllustrationSection } from '@/lib/documents/illustration-content';

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1A1E2E', lineHeight: 1.4 },
  title: { fontSize: 16, marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#4B5568', marginBottom: 14 },
  section: { marginBottom: 10 },
  heading: { fontSize: 12, marginBottom: 3 },
  line: { marginBottom: 2 },
});

export function IllustrationDocument({
  title,
  subtitle,
  sections,
}: {
  title: string;
  subtitle: string;
  sections: IllustrationSection[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.lines.map((line, index) => (
              <Text key={`${section.heading}-${index}`} style={styles.line}>{line}</Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
