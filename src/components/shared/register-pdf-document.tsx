import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 7,
    backgroundColor: '#ffffff',
  },
  // Company Header block
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'column',
    maxWidth: '50%',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    maxWidth: '50%',
  },
  registerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 7,
    color: '#64748b',
    marginBottom: 2,
  },
  companyName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 2,
  },
  companyInfo: {
    fontSize: 7,
    color: '#475569',
    textAlign: 'right',
    marginBottom: 1,
  },
  companyGst: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'right',
    marginTop: 2,
  },
  logo: {
    width: 50,
    height: 25,
    marginBottom: 4,
  },
  // Table styling
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    backgroundColor: '#475569',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
  },
  cellHeader: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontSize: 7,
    textAlign: 'center',
  },
  cellValue: {
    fontSize: 6.5,
    color: '#0f172a',
  },
  // Footer page numbers
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 6.5,
    color: '#64748b',
  },
});

interface CompanySettings {
  company_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  website?: string | null;
  gst_number?: string | null;
  logo_url?: string | null;
}

interface RegisterPDFDocumentProps {
  title: string;
  headers: string[];
  colWidths: string[];
  data: string[][];
  companySettings: CompanySettings | null;
  generatedBy: string;
}

export function RegisterPDFDocument({
  title,
  headers,
  colWidths,
  data,
  companySettings,
  generatedBy,
}: RegisterPDFDocumentProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString();

  // Normalize column widths so that their sum equals 100%
  const numericWidths = colWidths.map((w) => {
    const parsed = parseFloat(w.replace('%', ''));
    return isNaN(parsed) ? 10 : parsed;
  });
  const totalWidth = numericWidths.reduce((acc, curr) => acc + curr, 0);
  const normalizedWidths = totalWidth > 0
    ? numericWidths.map((w) => `${((w / totalWidth) * 100).toFixed(2)}%`)
    : colWidths;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Company & Register Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.registerTitle}>{title}</Text>
            <Text style={styles.metaText}>Generated: {dateStr} at {timeStr}</Text>
            <Text style={styles.metaText}>By: {generatedBy}</Text>
          </View>
          <View style={styles.headerRight}>
            {companySettings?.logo_url && companySettings.logo_url.startsWith('http') ? (
              <Image src={companySettings.logo_url} style={styles.logo} />
            ) : null}
            <Text style={styles.companyName}>{companySettings?.company_name || 'Phoenix CRM'}</Text>
            <Text style={styles.companyInfo}>
              {[
                companySettings?.address,
                companySettings?.city,
                companySettings?.state,
                companySettings?.pincode ? `PIN: ${companySettings.pincode}` : '',
                companySettings?.country,
              ]
                .filter(Boolean)
                .join(', ')}
            </Text>
            <Text style={styles.companyInfo}>
              {companySettings?.phone ? `Phone: ${companySettings.phone}` : ''}
              {companySettings?.alternate_phone ? ` | Mobile: ${companySettings.alternate_phone}` : ''}
            </Text>
            <Text style={styles.companyInfo}>
              {companySettings?.email ? `Email: ${companySettings.email}` : ''}
              {companySettings?.website ? ` | Web: ${companySettings.website}` : ''}
            </Text>
            {companySettings?.gst_number ? (
              <Text style={styles.companyGst}>GSTIN: {companySettings.gst_number}</Text>
            ) : null}
          </View>
        </View>

        {/* Table Register Grid */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableRow}>
            {headers.map((h, index) => {
              const width = normalizedWidths[index] || '10%';
              return (
                <View key={index} style={[styles.tableColHeader, { width }]}>
                  <Text style={styles.cellHeader}>{h.toUpperCase()}</Text>
                </View>
              );
            })}
          </View>

          {/* Table Body */}
          {data.map((row, rowIdx) => (
            <View
              key={rowIdx}
              style={[
                styles.tableRow,
                { backgroundColor: rowIdx % 2 === 1 ? '#f8fafc' : '#ffffff' }, // Zebra striping
              ]}
            >
              {row.map((cellVal, colIdx) => {
                const width = normalizedWidths[colIdx] || '10%';
                const isFirstCol = colIdx === 0;
                return (
                  <View
                    key={colIdx}
                    style={[
                      styles.tableCol,
                      {
                        width,
                        alignItems: isFirstCol ? 'center' : 'flex-start',
                      },
                    ]}
                  >
                    <Text style={styles.cellValue}>{cellVal || ''}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Page Footer and Attribution */}
        <View style={styles.footer} fixed>
          <Text>Phoenix CRM — Enterprise Register Summary</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
