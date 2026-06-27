import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    fontSize: 8,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333333',
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    backgroundColor: '#e5e7eb',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
  },
  cellHeader: { fontWeight: 'bold' },
  cellValue: {},
});

interface QuotationData {
  entry_date?: string | null;
  quotation_no?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  mobile?: string | null;
  email?: string | null;
  basic_total?: number | string | null;
  grand_total?: number | string | null;
  status?: string | null;
}

export function QuotationListPDFDocument({ quotations }: { quotations: QuotationData[] }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Quotation Register Export ({quotations.length} items)</Text>
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableRow}>
            <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.cellHeader}>Date</Text></View>
            <View style={[styles.tableColHeader, { width: '13%' }]}><Text style={styles.cellHeader}>Quotation No</Text></View>
            <View style={[styles.tableColHeader, { width: '17%' }]}><Text style={styles.cellHeader}>Company Name</Text></View>
            <View style={[styles.tableColHeader, { width: '13%' }]}><Text style={styles.cellHeader}>Contact Person</Text></View>
            <View style={[styles.tableColHeader, { width: '11%' }]}><Text style={styles.cellHeader}>Mobile</Text></View>
            <View style={[styles.tableColHeader, { width: '14%' }]}><Text style={styles.cellHeader}>Email</Text></View>
            <View style={[styles.tableColHeader, { width: '11%' }]}><Text style={styles.cellHeader}>Grand Total</Text></View>
            <View style={[styles.tableColHeader, { width: '11%' }]}><Text style={styles.cellHeader}>Status</Text></View>
          </View>
          {/* Body Rows */}
          {quotations.map((q, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.cellValue}>{q.entry_date ? new Date(q.entry_date).toLocaleDateString() : ''}</Text></View>
              <View style={[styles.tableCol, { width: '13%' }]}><Text style={styles.cellValue}>{q.quotation_no || ''}</Text></View>
              <View style={[styles.tableCol, { width: '17%' }]}><Text style={styles.cellValue}>{q.company_name || ''}</Text></View>
              <View style={[styles.tableCol, { width: '13%' }]}><Text style={styles.cellValue}>{q.contact_person || ''}</Text></View>
              <View style={[styles.tableCol, { width: '11%' }]}><Text style={styles.cellValue}>{q.mobile || ''}</Text></View>
              <View style={[styles.tableCol, { width: '14%' }]}><Text style={styles.cellValue}>{q.email || ''}</Text></View>
              <View style={[styles.tableCol, { width: '11%' }]}><Text style={styles.cellValue}>{Number(q.grand_total || 0).toLocaleString('en-IN')}</Text></View>
              <View style={[styles.tableCol, { width: '11%' }]}><Text style={styles.cellValue}>{q.status || ''}</Text></View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
