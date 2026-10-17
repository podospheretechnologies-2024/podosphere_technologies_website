import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';

export interface MonthlyReportPdfData {
  clientName: string;
  organizationName: string;
  title: string;
  periodLabel: string;
  body: string;
  metrics: {
    publishedPosts: number;
    leads: number;
    inboxThreads: number;
    socialReach: number;
    socialImpressions: number;
    adSpend: number;
    adImpressions: number;
    adClicks: number;
    adLeads: number;
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
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
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#555555',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metric: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 10,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  body: {
    marginTop: 8,
    lineHeight: 1.5,
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function MonthlyClientReportDocument({ data }: { data: MonthlyReportPdfData }) {
  const { metrics } = data;
  return (
    <Document title={data.title} author="Podosphere">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Podosphere</Text>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>
          {data.clientName} · {data.organizationName} · {data.periodLabel}
        </Text>

        <Text style={styles.sectionTitle}>Period snapshot</Text>
        <View style={styles.grid}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Published posts</Text>
            <Text style={styles.metricValue}>{formatNumber(metrics.publishedPosts)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Leads</Text>
            <Text style={styles.metricValue}>{formatNumber(metrics.leads)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Inbox threads</Text>
            <Text style={styles.metricValue}>{formatNumber(metrics.inboxThreads)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Social reach</Text>
            <Text style={styles.metricValue}>{formatNumber(metrics.socialReach)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Social impressions</Text>
            <Text style={styles.metricValue}>{formatNumber(metrics.socialImpressions)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Ad spend</Text>
            <Text style={styles.metricValue}>{formatMoney(metrics.adSpend)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Ad impressions</Text>
            <Text style={styles.metricValue}>{formatNumber(metrics.adImpressions)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Ad clicks / leads</Text>
            <Text style={styles.metricValue}>
              {formatNumber(metrics.adClicks)} / {formatNumber(metrics.adLeads)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.body}>{data.body}</Text>

        <Text style={styles.footer}>
          Generated from Podosphere MySQL aggregates. Figures are not live Meta API pulls.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderMonthlyClientReport(data: MonthlyReportPdfData): Promise<Buffer> {
  return renderToBuffer(<MonthlyClientReportDocument data={data} />);
}
