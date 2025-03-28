import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1a365d",
  },
  subtitle: {
    fontSize: 12,
    color: "#4a5568",
    marginBottom: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#2d3748",
    padding: 5,
    backgroundColor: "#f7fafc",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 8,
  },
  label: {
    flex: 1,
    fontSize: 12,
    color: "#4a5568",
  },
  value: {
    flex: 1,
    fontSize: 12,
    color: "#1a202c",
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 10,
    color: "#718096",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  metricBox: {
    width: "50%",
    padding: 10,
  },
});

const FinancialReportPDF = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{data.reportTitle}</Text>
        <Text style={styles.subtitle}>Generated on: {data.reportDate}</Text>
        <Text style={styles.subtitle}>
          Period: {data.reportingPeriodStart} - {data.reportingPeriodEnd}
        </Text>
      </View>

      {/* Key Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Total Revenue</Text>
              <Text style={styles.value}>{data.totalRevenue}</Text>
            </View>
          </View>
          <View style={styles.metricBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Total Expenses</Text>
              <Text style={styles.value}>{data.totalExpenses}</Text>
            </View>
          </View>
          <View style={styles.metricBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Net Profit</Text>
              <Text style={styles.value}>{data.netProfit}</Text>
            </View>
          </View>
          <View style={styles.metricBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Total Transactions</Text>
              <Text style={styles.value}>{data.numberOfTransactions}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Payment Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Statistics</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Payments to Workers</Text>
          <Text style={styles.value}>{data.totalPaymentsToWorkers}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Payments to Contractors</Text>
          <Text style={styles.value}>{data.totalPaymentsToContractors}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Average Worker Payment</Text>
          <Text style={styles.value}>{data.averageWorkerPayment}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Number of Workers Paid</Text>
          <Text style={styles.value}>{data.numberOfWorkersPaid}</Text>
        </View>
      </View>

      {/* Transaction Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction Details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Money Sent Out</Text>
          <Text style={styles.value}>{data.totalMoneySentOut}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Money Deposited</Text>
          <Text style={styles.value}>{data.totalMoneyDeposited}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Transaction Fees</Text>
          <Text style={styles.value}>{data.transactionFees}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Average Transaction Amount</Text>
          <Text style={styles.value}>{data.averageTransactionAmount}</Text>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        This report is generated automatically and provides a summary of
        financial performance. For accounting and tax purposes, please consult
        with your financial advisor.
      </Text>
    </Page>
  </Document>
);

export default FinancialReportPDF;
