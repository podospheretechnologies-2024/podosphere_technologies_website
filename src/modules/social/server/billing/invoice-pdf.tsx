import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';

export interface BillingInvoicePdfData {
  number: string;
  issuedAt: string;
  organizationName: string;
  sellerGstin: string | null;
  buyerGstin: string | null;
  placeOfSupply: string | null;
  planLabel: string;
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  currency: string;
  gstPercent: number;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  brand: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#666666',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#555555',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 20,
  },
  col: {
    width: '48%',
  },
  label: {
    fontSize: 8,
    color: '#666666',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 10,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  colDesc: { width: '50%' },
  colAmt: { width: '25%', textAlign: 'right' },
  colTax: { width: '25%', textAlign: 'right' },
  totals: {
    marginTop: 16,
    alignSelf: 'flex-end',
    width: '45%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalStrong: {
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999999',
  },
});

function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function BillingInvoiceDocument({ data }: { data: BillingInvoicePdfData }) {
  return (
    <Document title={`Invoice ${data.number}`} author="Podosphere">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Podosphere</Text>
        <Text style={styles.title}>Tax Invoice</Text>
        <Text style={styles.subtitle}>
          {data.number} · {data.issuedAt} · {data.currency}
        </Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Seller</Text>
            <Text style={styles.value}>Podosphere Technologies</Text>
            <Text style={styles.value}>
              GSTIN: {data.sellerGstin ?? '—'}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Buyer</Text>
            <Text style={styles.value}>{data.organizationName}</Text>
            <Text style={styles.value}>
              GSTIN: {data.buyerGstin ?? '—'}
            </Text>
            <Text style={styles.value}>
              Place of supply: {data.placeOfSupply ?? '—'}
            </Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colAmt}>Taxable</Text>
          <Text style={styles.colTax}>GST ({data.gstPercent}%)</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.colDesc}>Podo Social — {data.planLabel}</Text>
          <Text style={styles.colAmt}>{formatInr(data.taxableAmountPaise)}</Text>
          <Text style={styles.colTax}>
            {formatInr(data.cgstPaise + data.sgstPaise + data.igstPaise)}
          </Text>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Taxable value</Text>
            <Text>{formatInr(data.taxableAmountPaise)}</Text>
          </View>
          {data.cgstPaise > 0 ? (
            <View style={styles.totalRow}>
              <Text>CGST</Text>
              <Text>{formatInr(data.cgstPaise)}</Text>
            </View>
          ) : null}
          {data.sgstPaise > 0 ? (
            <View style={styles.totalRow}>
              <Text>SGST</Text>
              <Text>{formatInr(data.sgstPaise)}</Text>
            </View>
          ) : null}
          {data.igstPaise > 0 ? (
            <View style={styles.totalRow}>
              <Text>IGST</Text>
              <Text>{formatInr(data.igstPaise)}</Text>
            </View>
          ) : null}
          <View style={[styles.totalRow, styles.totalStrong]}>
            <Text>Total</Text>
            <Text>{formatInr(data.totalPaise)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Computer-generated GST invoice for Podosphere subscription billing. Amounts include applicable
          GST.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderBillingInvoicePdf(data: BillingInvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<BillingInvoiceDocument data={data} />);
}
