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

interface LeadData {
  inquiry_at?: string | null;
  platform?: string | null;
  buyer_name?: string | null;
  company_name?: string | null;
  mobile?: string | null;
  email?: string | null;
  product_name?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
}

export function LeadsListPDFDocument({ leads }: { leads: LeadData[] }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Enquiries Export ({leads.length} items)</Text>
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableRow}>
            <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.cellHeader}>Date</Text></View>
            <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.cellHeader}>Platform</Text></View>
            <View style={[styles.tableColHeader, { width: '12%' }]}><Text style={styles.cellHeader}>Buyer Name</Text></View>
            <View style={[styles.tableColHeader, { width: '12%' }]}><Text style={styles.cellHeader}>Company</Text></View>
            <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.cellHeader}>Mobile</Text></View>
            <View style={[styles.tableColHeader, { width: '12%' }]}><Text style={styles.cellHeader}>Email</Text></View>
            <View style={[styles.tableColHeader, { width: '14%' }]}><Text style={styles.cellHeader}>Product</Text></View>
            <View style={[styles.tableColHeader, { width: '12%' }]}><Text style={styles.cellHeader}>City/State</Text></View>
            <View style={[styles.tableColHeader, { width: '8%' }]}><Text style={styles.cellHeader}>Status</Text></View>
          </View>
          {/* Body Rows */}
          {leads.map((l, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.cellValue}>{l.inquiry_at ? new Date(l.inquiry_at).toLocaleDateString() : ''}</Text></View>
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.cellValue}>{l.platform || ''}</Text></View>
              <View style={[styles.tableCol, { width: '12%' }]}><Text style={styles.cellValue}>{l.buyer_name || ''}</Text></View>
              <View style={[styles.tableCol, { width: '12%' }]}><Text style={styles.cellValue}>{l.company_name || ''}</Text></View>
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.cellValue}>{l.mobile || ''}</Text></View>
              <View style={[styles.tableCol, { width: '12%' }]}><Text style={styles.cellValue}>{l.email || ''}</Text></View>
              <View style={[styles.tableCol, { width: '14%' }]}><Text style={styles.cellValue}>{l.product_name || ''}</Text></View>
              <View style={[styles.tableCol, { width: '12%' }]}><Text style={styles.cellValue}>{[l.city, l.state].filter(Boolean).join(', ')}</Text></View>
              <View style={[styles.tableCol, { width: '8%' }]}><Text style={styles.cellValue}>{l.status || ''}</Text></View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
