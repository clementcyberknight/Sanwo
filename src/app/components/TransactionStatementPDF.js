import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

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
  summaryBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
  },
  summaryItem: {
    width: "33%",
    padding: 5,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#4a5568",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a202c",
  },
  table: {
    display: "table",
    width: "auto",
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    minHeight: 25,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#f7fafc",
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    padding: 4,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 5,
    color: "#2d3748",
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
  status: {
    fontSize: 10,
    padding: 2,
    borderRadius: 2,
  },
});

const TransactionStatementPDF = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transaction Statement</Text>
        <Text style={styles.subtitle}>
          Generated on: {data.summary.generatedDate}
        </Text>
        <Text style={styles.subtitle}>
          Period: {data.summary.startDate} - {data.summary.endDate}
        </Text>
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Transactions</Text>
            <Text style={styles.summaryValue}>
              {data.summary.totalTransactions}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Deposits</Text>
            <Text style={styles.summaryValue}>
              {data.summary.totalDeposits}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Withdrawals</Text>
            <Text style={styles.summaryValue}>
              {data.summary.totalWithdrawals}
            </Text>
          </View>
        </View>
      </View>

      {/* Transactions by Month */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction Details</Text>
        {Object.entries(data.transactionsByMonth).map(
          ([month, transactions]) => (
            <View key={month}>
              <Text style={styles.monthTitle}>{month}</Text>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={styles.tableCell}>Date</Text>
                  <Text style={styles.tableCell}>ID</Text>
                  <Text style={styles.tableCell}>Type</Text>
                  <Text style={styles.tableCell}>Category</Text>
                  <Text style={styles.tableCell}>Amount</Text>
                  <Text style={styles.tableCell}>Status</Text>
                </View>

                {/* Table Rows */}
                {transactions.map((tx) => (
                  <View key={tx.id} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{tx.formattedDate}</Text>
                    <Text style={styles.tableCell}>
                      {tx.id.substring(0, 8)}...
                    </Text>
                    <Text style={styles.tableCell}>{tx.type}</Text>
                    <Text style={styles.tableCell}>
                      {tx.category.charAt(0).toUpperCase() +
                        tx.category.slice(1)}
                    </Text>
                    <Text style={styles.tableCell}>{tx.formattedAmount}</Text>
                    <Text style={styles.tableCell}>{tx.status}</Text>
                  </View>
                ))}
              </View>
            </View>
          )
        )}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        This statement is generated automatically and provides a record of your
        transactions. For accounting and tax purposes, please consult with your
        financial advisor.
      </Text>
    </Page>
  </Document>
);

export default TransactionStatementPDF;
