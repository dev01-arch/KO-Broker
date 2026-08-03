import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import {
  formatTemplateLabel,
  parseSectionContent,
  type ProductRow,
  type ValueTiles,
} from '@/lib/pdf/reportContentParsing';

interface ReportSection {
  id: string;
  title: string;
  content: string;
  complianceFlag: string;
  flagReason?: string | null;
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

/** Colour palette aligned with Figma letterhead export (Untitled). */
const C = {
  navy: '#0B1C34',
  green: '#1E8C6E',
  greenTag: '#7EC8B2',
  labelMuted: '#5B7FA6',
  caseLight: '#A8C4DE',
  gold: '#F5A623',
  ink: '#1A1E2E',
  body: '#374151',
  bodyMuted: '#4B5568',
  greyBg: '#F5F7FA',
  greyFooter: '#F7F8FA',
  greyBorder: '#E2E6EF',
  divider: '#E9EBF0',
  greenLight: '#F0FBF7',
  greenBorder: '#A8E0CF',
  greenDark: '#0B3B2B',
  greenRow: '#EBF7F3',
  greenBadge: '#0B6B4F',
  warnBg: '#FEF9EC',
  warnBorder: '#F5D98A',
  warnTitle: '#92610A',
  warnBody: '#78500D',
  white: '#FFFFFF',
  footerMuted: '#9CA3AF',
};

const styles = StyleSheet.create({
  page: {
    width: '100%',
    paddingTop: 0,
    paddingBottom: 64,
    paddingHorizontal: 0,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.55,
    color: C.body,
  },
  header: {
    width: '100%',
    backgroundColor: C.navy,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markBox: {
    width: 38,
    height: 38,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGlyph: {
    fontSize: 16,
    fontWeight: 'bold',
    color: C.white,
  },
  brandText: {
    marginLeft: 12,
  },
  brandName: {
    fontFamily: 'Times-Roman',
    fontSize: 22,
    color: C.white,
    lineHeight: 1.1,
  },
  brandTag: {
    fontSize: 10,
    color: C.greenTag,
    marginTop: 2,
  },
  fcaBlock: {
    textAlign: 'right',
    maxWidth: 200,
  },
  fcaLine: {
    fontSize: 9,
    color: C.labelMuted,
    lineHeight: 1.6,
  },
  accentRow: {
    flexDirection: 'row',
    height: 3,
  },
  accentGreen: {
    flex: 3,
    height: 3,
    backgroundColor: C.green,
  },
  accentGold: {
    flex: 1,
    height: 3,
    backgroundColor: C.gold,
  },
  titleBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 20,
  },
  titleCol: {
    flex: 1,
    paddingRight: 20,
  },
  titleLabel: {
    fontSize: 10,
    color: C.labelMuted,
    marginBottom: 4,
  },
  titleMain: {
    fontFamily: 'Times-Roman',
    fontSize: 28,
    color: C.white,
    lineHeight: 1.15,
  },
  caseCol: {
    textAlign: 'right',
    paddingBottom: 2,
  },
  caseLabel: {
    fontSize: 10,
    color: C.labelMuted,
    marginBottom: 6,
  },
  caseRef: {
    fontSize: 11,
    color: C.white,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  caseDetail: {
    fontSize: 11,
    color: C.caseLight,
    lineHeight: 1.7,
  },
  body: {
    paddingHorizontal: 40,
    paddingTop: 32,
    paddingBottom: 16,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  sectionNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: C.green,
    minWidth: 22,
  },
  sectionTitle: {
    fontFamily: 'Times-Roman',
    fontSize: 20,
    color: C.navy,
    lineHeight: 1.2,
    flex: 1,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: C.divider,
    marginVertical: 24,
  },
  bodyText: {
    fontSize: 10,
    color: C.body,
    lineHeight: 1.75,
    marginBottom: 10,
  },
  callout: {
    backgroundColor: C.greenLight,
    borderWidth: 1,
    borderColor: C.greenBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
    flexDirection: 'row',
  },
  calloutIcon: {
    width: 14,
    height: 14,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  calloutIconText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: C.white,
  },
  calloutContent: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: C.green,
    marginBottom: 3,
  },
  calloutBody: {
    fontSize: 9.5,
    color: C.greenDark,
    lineHeight: 1.65,
  },
  recommendCallout: {
    backgroundColor: C.greenLight,
    borderWidth: 1,
    borderColor: C.greenBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 10,
  },
  recommendTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: C.green,
    marginBottom: 6,
  },
  recommendBody: {
    fontSize: 10,
    color: C.greenDark,
    lineHeight: 1.6,
  },
  warnCallout: {
    backgroundColor: C.warnBg,
    borderWidth: 1,
    borderColor: C.warnBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 10,
  },
  warnTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: C.warnTitle,
    marginBottom: 4,
  },
  warnBody: {
    fontSize: 10,
    color: C.warnBody,
    lineHeight: 1.6,
  },
  tilesRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 16,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.greyBorder,
    backgroundColor: C.greyBg,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginRight: 12,
    alignItems: 'center',
  },
  tileHighlight: {
    flex: 1,
    backgroundColor: C.navy,
    borderWidth: 1,
    borderColor: C.navy,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: C.bodyMuted,
    marginBottom: 4,
  },
  tileLabelDark: {
    fontSize: 9,
    fontWeight: 'bold',
    color: C.greenTag,
    marginBottom: 4,
  },
  tileValue: {
    fontFamily: 'Times-Roman',
    fontSize: 22,
    color: C.navy,
  },
  tileValueDark: {
    fontFamily: 'Times-Roman',
    fontSize: 22,
    color: C.white,
  },
  table: {
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.greyBorder,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.navy,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    color: C.white,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: C.greyBorder,
    backgroundColor: C.greyBg,
  },
  tableRowHighlight: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: C.greyBorder,
    backgroundColor: C.greenRow,
  },
  tableCell: {
    flex: 1,
    fontSize: 9.5,
    color: C.body,
  },
  tableCellHighlight: {
    flex: 1,
    fontSize: 9.5,
    color: C.greenBadge,
    fontWeight: 'bold',
  },
  badge: {
    fontSize: 8,
    fontWeight: 'bold',
    color: C.white,
    backgroundColor: C.green,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  outcomesGrid: {
    marginTop: 16,
    marginBottom: 10,
  },
  outcomesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: C.navy,
    marginBottom: 10,
  },
  outcomesRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  outcomeBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.greyBorder,
    backgroundColor: C.greyBg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  outcomeBoxLast: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.greyBorder,
    backgroundColor: C.greyBg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  outcomeTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: C.navy,
    marginBottom: 4,
  },
  outcomeBody: {
    fontSize: 9.5,
    color: C.bodyMuted,
    lineHeight: 1.6,
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.greyFooter,
    borderTopWidth: 1,
    borderTopColor: C.greyBorder,
    paddingVertical: 14,
    paddingHorizontal: 40,
    height: 52,
  },
  footerLeft: {
    position: 'absolute',
    bottom: 14,
    left: 40,
    fontSize: 8.5,
    color: C.footerMuted,
    lineHeight: 1.6,
    maxWidth: 320,
  },
  footerRight: {
    position: 'absolute',
    bottom: 14,
    right: 40,
    fontSize: 8.5,
    color: C.footerMuted,
    textAlign: 'right',
    lineHeight: 1.6,
  },
  bold: {
    fontWeight: 'bold',
  },
});

function FormattedText({
  text,
  style,
}: {
  text: string;
  style: Record<string, string | number>;
}) {
  if (!text.trim()) return null;

  const segments: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(<Text key={key++}>{text.slice(lastIndex, match.index)}</Text>);
    }
    segments.push(<Text key={key++} style={styles.bold}>{match[1]}</Text>);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push(<Text key={key++}>{text.slice(lastIndex)}</Text>);
  }

  if (segments.length === 0) {
    return <Text style={style}>{text}</Text>;
  }

  return <Text style={style}>{segments}</Text>;
}

function ConsumerDutyCallout({ text }: { text: string }) {
  return (
    <View style={styles.callout}>
      <View style={styles.calloutIcon}>
        <Text style={styles.calloutIconText}>i</Text>
      </View>
      <View style={styles.calloutContent}>
        <Text style={styles.calloutTitle}>CONSUMER DUTY EVIDENCING STATEMENT</Text>
        <FormattedText text={text} style={styles.calloutBody} />
      </View>
    </View>
  );
}

function ValueTilesRow({ tiles }: { tiles: ValueTiles }) {
  const items = [
    { label: 'Property Value', value: tiles.propertyValue, highlight: false },
    { label: 'Loan Amount', value: tiles.loanAmount, highlight: false },
    { label: 'Loan-to-Value', value: tiles.ltv, highlight: true },
  ].filter((item) => item.value);

  if (items.length === 0) return null;

  return (
    <View style={styles.tilesRow}>
      {items.map((item, idx) => {
        if (item.highlight) {
          return (
            <View key={item.label} style={styles.tileHighlight}>
              <Text style={styles.tileLabelDark}>{item.label}</Text>
              <Text style={styles.tileValueDark}>{item.value}</Text>
            </View>
          );
        }
        const tileStyle =
          idx < items.length - 1
            ? styles.tile
            : { ...styles.tile, marginRight: 0 };
        return (
          <View key={item.label} style={tileStyle}>
            <Text style={styles.tileLabel}>{item.label}</Text>
            <Text style={styles.tileValue}>{item.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ProductTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ProductRow[];
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        {headers.map((header) => (
          <Text key={header} style={styles.tableHeaderCell}>{header}</Text>
        ))}
      </View>
      {rows.map((row, idx) => (
        <View
          key={idx}
          style={row.recommended ? styles.tableRowHighlight : styles.tableRow}
        >
          {row.cells.map((cell, cellIdx) => (
            <Text
              key={cellIdx}
              style={row.recommended && cellIdx === 0 ? styles.tableCellHighlight : styles.tableCell}
            >
              {cell}
              {row.recommended &&
                cellIdx === row.cells.length - 1 &&
                !/recommended/i.test(cell) && (
                  <Text style={styles.badge}> RECOMMENDED</Text>
                )}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function RecommendationBox({ text }: { text: string }) {
  return (
    <View style={styles.recommendCallout}>
      <Text style={styles.recommendTitle}>OUR RECOMMENDATION</Text>
      <FormattedText text={text} style={styles.recommendBody} />
    </View>
  );
}

function WarningBox({ text }: { text: string }) {
  return (
    <View style={styles.warnCallout}>
      <Text style={styles.warnTitle}>DATA GAP - ACTION REQUIRED</Text>
      <FormattedText text={text} style={styles.warnBody} />
    </View>
  );
}

function OutcomesGrid({
  outcomes,
}: {
  outcomes: Array<{ title: string; body: string }>;
}) {
  const rows: Array<Array<{ title: string; body: string }>> = [];
  for (let i = 0; i < outcomes.length; i += 2) {
    rows.push(outcomes.slice(i, i + 2));
  }

  return (
    <View style={styles.outcomesGrid}>
      <Text style={styles.outcomesTitle}>CONSUMER DUTY OUTCOMES</Text>
      {rows.map((row, idx) => (
        <View key={idx} style={styles.outcomesRow}>
          {row.map((outcome, outcomeIdx) => (
            <View
              key={outcome.title}
              style={outcomeIdx === row.length - 1 ? styles.outcomeBoxLast : styles.outcomeBox}
            >
              <Text style={styles.outcomeTitle}>{outcome.title}</Text>
              <FormattedText text={outcome.body} style={styles.outcomeBody} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ReportHeader({
  templateType,
  referenceNumber,
  clientName,
  date,
}: {
  templateType: string;
  referenceNumber: string;
  clientName: string;
  date: string;
}) {
  const templateLabel = formatTemplateLabel(templateType);

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.brandRow}>
          <View style={styles.markBox}>
            <Text style={styles.markGlyph}>K</Text>
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandName}>KO Broker</Text>
            <Text style={styles.brandTag}>Mortgage & Protection Advisers</Text>
          </View>
        </View>
        <View style={styles.fcaBlock}>
          <Text style={styles.fcaLine}>KO Brokers Ltd</Text>
          <Text style={styles.fcaLine}>Authorised & Regulated by the</Text>
          <Text style={styles.fcaLine}>Financial Conduct Authority</Text>
        </View>
      </View>

      <View style={styles.accentRow}>
        <View style={styles.accentGreen} />
        <View style={styles.accentGold} />
      </View>

      <View style={styles.titleBand}>
        <View style={styles.titleCol}>
          <Text style={styles.titleLabel}>
            Suitability Report | {templateLabel}
          </Text>
          <Text style={styles.titleMain}>Mortgage Suitability Report</Text>
        </View>
        <View style={styles.caseCol}>
          <Text style={styles.caseLabel}>Case Details</Text>
          <Text style={styles.caseRef}>{referenceNumber}</Text>
          <Text style={styles.caseDetail}>{clientName}</Text>
          <Text style={styles.caseDetail}>{date}</Text>
        </View>
      </View>
    </View>
  );
}

function ReportSectionBlock({
  index,
  section,
}: {
  index: number;
  section: ReportSection;
}) {
  const parsed = parseSectionContent(
    section.content,
    section.id,
    section.title,
    section.complianceFlag,
    section.flagReason,
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionNumber}>{String(index + 1).padStart(2, '0')}</Text>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>

      {parsed.body && <FormattedText text={parsed.body} style={styles.bodyText} />}

      {parsed.valueTiles && <ValueTilesRow tiles={parsed.valueTiles} />}

      {parsed.productHeaders && parsed.productRows && (
        <ProductTable headers={parsed.productHeaders} rows={parsed.productRows} />
      )}

      {parsed.recommendation && <RecommendationBox text={parsed.recommendation} />}

      {parsed.warningText && <WarningBox text={parsed.warningText} />}

      {parsed.outcomes && <OutcomesGrid outcomes={parsed.outcomes} />}

      {parsed.consumerDuty && <ConsumerDutyCallout text={parsed.consumerDuty} />}
    </View>
  );
}

function ReportFooter({
  referenceNumber,
  date,
}: {
  referenceNumber: string;
  date: string;
}) {
  return (
    <>
      <View style={styles.footerBar} fixed />
      <Text style={styles.footerLeft} fixed>
        KO Brokers Ltd | Authorised & Regulated by the Financial Conduct Authority{'\n'}
        This report is confidential and intended solely for the named client.
      </Text>
      <Text
        style={styles.footerRight}
        fixed
        render={({ pageNumber, totalPages }) =>
          `Case Ref: ${referenceNumber}\nGenerated: ${date}\nPage ${pageNumber} of ${totalPages}`
        }
      />
    </>
  );
}

export const ReportDocument: React.FC<ReportDocumentProps> = ({ report }) => {
  const sections: ReportSection[] = Array.isArray(report.sections)
    ? report.sections
    : typeof report.sections === 'string'
      ? JSON.parse(report.sections)
      : [];

  const clientName = `${report.case?.client?.firstName ?? ''} ${report.case?.client?.lastName ?? ''}`.trim();
  const date = new Date(report.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const referenceNumber = report.case?.referenceNumber ?? '';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader
          templateType={report.templateType}
          referenceNumber={referenceNumber}
          clientName={clientName}
          date={date}
        />

        <View style={styles.body}>
          {sections.map((section, idx) => (
            <View key={section.id || idx}>
              <ReportSectionBlock index={idx} section={section} />
              {idx < sections.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <ReportFooter referenceNumber={referenceNumber} date={date} />
      </Page>
    </Document>
  );
};
