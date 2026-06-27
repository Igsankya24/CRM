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
  cellHeader: {
    fontWeight: 'bold',
  },
  cellValue: {
  }
});

interface SalesData {
  entry_date?: string | null;
  sales_register_no?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  mobile?: string | null;
  email?: string | null;
  basic_total?: number | string | null;
  grand_total?: number | string | null;
  status?: string | null;
}

export function SalesListPDFDocument({ sales }: { sales: SalesData[] }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Sales Register Export ({sales.length} items)</Text>
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableRow}>
            <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.cellHeader}>Date</Text></View>
            <View style={[styles.tableColHeader, { width: '12%' }]}><Text style={styles.cellHeader}>Invoice No</Text></View>
            <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.cellHeader}>Company Name</Text></View>
            <View style={[styles.tableColHeader, { width: '12%' }]}><Text style={styles.cellHeader}>Contact Person</Text></View>
            <View style={[styles.tableColHeader, { width: '11%' }]}><Text style={styles.cellHeader}>Mobile</Text></View>
            <View style={[styles.tableColHeader, { width: '12%' }]}><Text style={styles.cellHeader}>Email</Text></View>
            <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.cellHeader}>Basic Total</Text></View>
            <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.cellHeader}>Grand Total</Text></View>
            <View style={[styles.tableColHeader, { width: '8%' }]}><Text style={styles.cellHeader}>Status</Text></View>
          </View>
          {/* Body Rows */}
          {sales.map((s, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.cellValue}>{s.entry_date ? new Date(s.entry_date).toLocaleDateString() : ''}</Text></View>
              <View style={[styles.tableCol, { width: '12%' }]}><Text style={styles.cellValue}>{s.sales_register_no || ''}</Text></View>
              <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.cellValue}>{s.company_name || ''}</Text></View>
              <View style={[styles.tableCol, { width: '12%' }]}><Text style={styles.cellValue}>{s.contact_person || ''}</Text></View>
              <View style={[styles.tableCol, { width: '11%' }]}><Text style={styles.cellValue}>{s.mobile || ''}</Text></View>
              <View style={[styles.tableCol, { width: '12%' }]}><Text style={styles.cellValue}>{s.email || ''}</Text></View>
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.cellValue}>{Number(s.basic_total || 0).toLocaleString('en-IN')}</Text></View>
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.cellValue}>{Number(s.grand_total || 0).toLocaleString('en-IN')}</Text></View>
              <View style={[styles.tableCol, { width: '8%' }]}><Text style={styles.cellValue}>{s.status || ''}</Text></View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
