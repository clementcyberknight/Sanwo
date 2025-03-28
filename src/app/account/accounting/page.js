"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Loader2,
  FileSpreadsheet,
  Clock,
  TrendingUp,
  DollarSign,
  Briefcase,
  BarChart2,
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Users,
} from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import FinancialReportPDF from "@/app/components/FinancialReportPDF";
import TransactionStatementPDF from "@/app/components/TransactionStatementPDF";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "@/app/config/FirebaseConfig";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth } from "@/app/config/FirebaseConfig";
import { useAccount } from "wagmi";

// Optimized currency formatter using Intl.NumberFormat instance reuse
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return "N/A";

  const numericAmount =
    typeof amount === "number"
      ? amount
      : parseFloat(String(amount).replace(/[^0-9.-]+/g, ""));

  return isNaN(numericAmount)
    ? "Invalid Amount"
    : currencyFormatter.format(numericAmount);
};

// Date formatting utility
const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Animation variants for consistent motion effects
const fadeInUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: 20, transition: { duration: 0.2 } },
};

const FinancialReportingPage = () => {
  // State management
  const [activeTab, setActiveTab] = useState("financial-report");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [financialReportData, setFinancialReportData] = useState(null);
  const [transactionData, setTransactionData] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date(),
  });
  const [transactionFilters, setTransactionFilters] = useState({
    category: "all",
    status: "all",
    minAmount: "",
    maxAmount: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const account = useAccount();
  const router = useRouter();

  // Toast notification helpers
  const showErrorToast = (message) => {
    toast.error(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  const showSuccessToast = (message) => {
    toast.success(message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  // Optimized transaction fetching with caching and filtering
  const fetchFinancialTransactions = async (companyAddress, filters = {}) => {
    try {
      setIsLoadingTransactions(true);

      // Create base query
      const paymentsCollectionRef = collection(
        db,
        `businesses/${companyAddress}/payments`
      );

      // Build query with filters
      let queryConstraints = [orderBy("timestamp", "desc")];

      // Date range filtering
      if (filters.startDate && filters.endDate) {
        const startTimestamp = Timestamp.fromDate(new Date(filters.startDate));
        const endTimestamp = Timestamp.fromDate(new Date(filters.endDate));
        queryConstraints.push(where("timestamp", ">=", startTimestamp));
        queryConstraints.push(where("timestamp", "<=", endTimestamp));
      }

      // Category filtering
      if (filters.category && filters.category !== "all") {
        queryConstraints.push(where("category", "==", filters.category));
      }

      // Status filtering
      if (filters.status && filters.status !== "all") {
        queryConstraints.push(where("status", "==", filters.status));
      }

      const q = query(paymentsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);

      // Process transactions with optimized memory usage
      const transactions = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate() || null;

        // Only include transactions that match amount filters if specified
        const amount = Number(data.amount);
        const minAmount = filters.minAmount ? Number(filters.minAmount) : null;
        const maxAmount = filters.maxAmount ? Number(filters.maxAmount) : null;

        if (
          (minAmount === null || amount >= minAmount) &&
          (maxAmount === null || amount <= maxAmount)
        ) {
          transactions.push({
            id: doc.id,
            amount,
            category: data.category || "unknown",
            status: data.status || "unknown",
            timestamp,
            transactionHash: data.transactionHash || null,
            // Add other fields as needed but keep it minimal
          });
        }
      });

      return transactions;
    } catch (error) {
      console.error("Error fetching financial transactions:", error);
      throw error;
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Optimized algorithm for financial report generation
  const generateFinancialReport = (transactions) => {
    // Use a single pass through the data to calculate all metrics
    const metrics = transactions.reduce(
      (acc, tx) => {
        const amount = Number(tx.amount) || 0;

        // Update transaction count
        acc.transactionCount++;

        // Update total amounts
        acc.totalAmount += amount;

        // Categorize by transaction type
        if (tx.category === "deposit") {
          acc.totalDeposits += amount;
          acc.depositCount++;
        } else if (
          tx.category === "withdrawal" ||
          tx.category === "Payroll" ||
          tx.category === "Contractor Payment"
        ) {
          acc.totalWithdrawals += amount;
          acc.withdrawalCount++;

          // Further categorize withdrawals
          if (
            tx.category === "Payroll" ||
            tx.category === "Contractor Payment"
          ) {
            acc.totalPayroll += amount;
            acc.payrollCount++;
          }
        }

        // Track by status
        if (tx.status === "Success") {
          acc.successfulTransactions++;
          acc.successfulAmount += amount;
        } else if (tx.status === "Failed") {
          acc.failedTransactions++;
        } else if (tx.status === "Pending") {
          acc.pendingTransactions++;
          acc.pendingAmount += amount;
        }

        return acc;
      },
      {
        transactionCount: 0,
        totalAmount: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalPayroll: 0,
        depositCount: 0,
        withdrawalCount: 0,
        payrollCount: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        pendingTransactions: 0,
        successfulAmount: 0,
        pendingAmount: 0,
      }
    );

    // Calculate derived metrics
    const netProfit = metrics.totalDeposits - metrics.totalWithdrawals;
    const avgTransactionAmount =
      metrics.transactionCount > 0
        ? metrics.totalAmount / metrics.transactionCount
        : 0;
    const avgPayrollAmount =
      metrics.payrollCount > 0
        ? metrics.totalPayroll / metrics.payrollCount
        : 0;

    // Get date range for the report
    const dates = transactions.map((tx) => tx.timestamp).filter(Boolean);
    const oldestDate =
      dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
    const newestDate =
      dates.length > 0 ? new Date(Math.max(...dates)) : new Date();

    // Format the report data
    return {
      reportTitle: "Financial Performance Report",
      reportDate: formatDate(new Date()),
      reportingPeriodStart: formatDate(oldestDate),
      reportingPeriodEnd: formatDate(newestDate),
      currency: "USDC",

      // Key metrics
      totalRevenue: formatCurrency(metrics.totalDeposits),
      totalExpenses: formatCurrency(metrics.totalWithdrawals),
      netProfit: formatCurrency(netProfit),
      numberOfTransactions: metrics.transactionCount,

      // Payment statistics
      totalPaymentsToWorkers: formatCurrency(metrics.totalPayroll),
      averageWorkerPayment: formatCurrency(avgPayrollAmount),
      numberOfWorkersPaid: metrics.payrollCount,

      // Transaction details
      totalMoneySentOut: formatCurrency(metrics.totalWithdrawals),
      totalMoneyDeposited: formatCurrency(metrics.totalDeposits),
      transactionFees: formatCurrency(metrics.totalAmount * 0.0), // 1% fee of total transaction volume
      averageTransactionAmount: formatCurrency(avgTransactionAmount),

      // Additional metrics for charts
      depositVsWithdrawal: {
        deposits: metrics.totalDeposits,
        withdrawals: metrics.totalWithdrawals,
      },
      transactionsByStatus: {
        successful: metrics.successfulTransactions,
        failed: metrics.failedTransactions,
        pending: metrics.pendingTransactions,
      },

      // Raw data for custom calculations
      rawMetrics: metrics,

      // Include the first 5 most recent transactions for reference
      recentTransactions: transactions.slice(0, 5),
    };
  };

  // Generate transaction statement data
  const generateTransactionStatement = (transactions) => {
    // Group transactions by month for better organization
    const groupedByMonth = transactions.reduce((acc, tx) => {
      if (!tx.timestamp) return acc;

      const date = new Date(tx.timestamp);
      const monthYear = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }

      acc[monthYear].push({
        ...tx,
        formattedDate: formatDate(tx.timestamp),
        formattedAmount: formatCurrency(tx.amount),
        type: tx.category === "deposit" ? "Credit" : "Debit",
      });

      return acc;
    }, {});

    // Calculate summary statistics
    const summary = {
      totalTransactions: transactions.length,
      totalDeposits: formatCurrency(
        transactions
          .filter((tx) => tx.category === "deposit")
          .reduce((sum, tx) => sum + Number(tx.amount), 0)
      ),
      totalWithdrawals: formatCurrency(
        transactions
          .filter((tx) => tx.category !== "deposit")
          .reduce((sum, tx) => sum + Number(tx.amount), 0)
      ),
      startDate: formatDate(dateRange.startDate),
      endDate: formatDate(dateRange.endDate),
      generatedDate: formatDate(new Date()),
    };

    return {
      transactionsByMonth: groupedByMonth,
      summary,
    };
  };

  // Handle report generation
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setFinancialReportData(null);

    if (!account?.address) {
      showErrorToast("Please connect your wallet to generate report.");
      setIsGeneratingReport(false);
      return;
    }

    try {
      // Fetch transactions with date range filter
      const transactions = await fetchFinancialTransactions(account.address, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      if (transactions.length === 0) {
        showErrorToast("No transactions found in the selected date range.");
        setIsGeneratingReport(false);
        return;
      }

      // Generate report using our optimized algorithm
      const reportData = generateFinancialReport(transactions);
      setFinancialReportData(reportData);
      showSuccessToast("Financial report generated successfully!");
    } catch (error) {
      console.error("Error generating financial report:", error);
      showErrorToast("Failed to generate financial report. Please try again.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Handle transaction statement generation
  const handleGenerateTransactionStatement = async () => {
    setIsLoadingTransactions(true);
    setTransactionData(null);

    if (!account?.address) {
      showErrorToast("Please connect your wallet to generate statement.");
      setIsLoadingTransactions(false);
      return;
    }

    try {
      // Fetch transactions with all filters applied
      const transactions = await fetchFinancialTransactions(account.address, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        category: transactionFilters.category,
        status: transactionFilters.status,
        minAmount: transactionFilters.minAmount,
        maxAmount: transactionFilters.maxAmount,
      });

      if (transactions.length === 0) {
        showErrorToast("No transactions found matching the selected filters.");
        setIsLoadingTransactions(false);
        return;
      }

      // Generate transaction statement
      const statementData = generateTransactionStatement(transactions);
      setTransactionData(statementData);
      showSuccessToast("Transaction statement generated successfully!");
    } catch (error) {
      console.error("Error generating transaction statement:", error);
      showErrorToast(
        "Failed to generate transaction statement. Please try again."
      );
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Handle date range changes
  const handleDateRangeChange = (e, field) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: new Date(e.target.value),
    }));
  };

  // Handle filter changes
  const handleFilterChange = (e, field) => {
    setTransactionFilters((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  // Reset filters
  const resetFilters = () => {
    setTransactionFilters({
      category: "all",
      status: "all",
      minAmount: "",
      maxAmount: "",
    });
    setDateRange({
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: new Date(),
    });
  };

  // Load transactions when tab changes to transaction statement

  useEffect(() => {
    if (
      activeTab === "financial-statement" &&
      account?.address &&
      !transactionData
    ) {
      handleGenerateTransactionStatement();
    }
  }, [activeTab, account?.address]);

  useEffect(() => {
    let authUnsubscribe;

    const initializeAuth = async () => {
      setIsLoading(true);

      authUnsubscribe = auth.onAuthStateChanged(async (user) => {
        setFirebaseUser(user);

        if (!user) {
          // Redirect unauthenticated users immediately
          router.push(
            "/auth/login?redirect=" +
              encodeURIComponent(window.location.pathname)
          );
          return;
        }

        // User is authenticated, now check wallet connection
        if (!account || !account.address) {
          console.log("Wallet connection required for financial data access");
          showErrorToast("Please connect your wallet to view financial data");
          setIsLoading(false);
        } else {
          // Both authentication and wallet connection verified
          try {
            // Fetch initial data only when both auth and wallet are ready
            await fetchFinancialTransactions(account.address);
            showSuccessToast("Financial data loaded successfully");
          } catch (error) {
            console.error("Error loading financial data:", error);
            showErrorToast("Failed to load financial data. Please try again.");
          }
        }

        setIsAuthReady(true);
        setIsLoading(false);
      });
    };

    initializeAuth();

    return () => {
      if (authUnsubscribe) {
        authUnsubscribe();
      }
    };
  }, [account, router]);

  return (
    <motion.div
      className="container mx-auto p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header with company logo */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800 mb-2">
            Financial Reporting
          </h1>
          <p className="text-gray-500">
            Generate financial reports and manage transaction statements
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <nav className="flex">
          <button
            onClick={() => setActiveTab("financial-report")}
            className={`flex items-center gap-2 py-4 px-6 font-medium transition-colors ${
              activeTab === "financial-report"
                ? "border-b-2 border-black text-black"
                : "text-gray-500 hover:text-gray-700"
            } focus:outline-none`}
          >
            <FileSpreadsheet size={18} />
            Financial Report
          </button>
          <button
            onClick={() => setActiveTab("financial-statement")}
            className={`flex items-center gap-2 py-4 px-6 font-medium transition-colors ${
              activeTab === "financial-statement"
                ? "border-b-2 border-black text-black"
                : "text-gray-500 hover:text-gray-700"
            } focus:outline-none`}
          >
            <FileText size={18} />
            Transaction Statement
          </button>
          <button
            onClick={() => setActiveTab("tax-filing")}
            className={`flex items-center gap-2 py-4 px-6 font-medium transition-colors ${
              activeTab === "tax-filing"
                ? "border-b-2 border-black text-black"
                : "text-gray-500 hover:text-gray-700"
            } focus:outline-none`}
          >
            <Clock size={18} />
            Tax Filing{" "}
            <span className="ml-1 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full">
              Soon
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {/* Financial Report Tab */}
        {activeTab === "financial-report" && (
          <motion.div
            variants={fadeInUpVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Date Range Selector and Generate Button */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.startDate.toISOString().split("T")[0]}
                      onChange={(e) => handleDateRangeChange(e, "startDate")}
                      className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.endDate.toISOString().split("T")[0]}
                      onChange={(e) => handleDateRangeChange(e, "endDate")}
                      className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors ${
                    isGeneratingReport ? "opacity-70 cursor-wait" : ""
                  }`}
                >
                  {isGeneratingReport ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet size={18} />
                      Generate Financial Report
                    </>
                  )}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {financialReportData && (
                <motion.div
                  key="reportDisplay"
                  variants={fadeInUpVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="bg-white rounded-lg shadow-md border border-gray-200"
                >
                  {/* Report Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-b border-gray-200 rounded-t-lg">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                          <FileSpreadsheet size={24} className="text-black" />
                          {financialReportData.reportTitle}
                        </h2>
                        <p className="text-gray-600 mt-1">
                          Generated on {financialReportData.reportDate}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar size={14} />
                          Period: {
                            financialReportData.reportingPeriodStart
                          } - {financialReportData.reportingPeriodEnd}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <PDFDownloadLink
                          document={
                            <FinancialReportPDF data={financialReportData} />
                          }
                          fileName={`Financial-Report-${financialReportData.reportDate.replace(
                            /\//g,
                            "-"
                          )}.pdf`}
                          className="flex items-center gap-1 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-900 transition-colors"
                        >
                          {({ loading }) => (
                            <>
                              {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Download size={16} />
                              )}
                              {loading ? "Preparing PDF..." : "Export PDF"}
                            </>
                          )}
                        </PDFDownloadLink>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-gray-200 bg-white">
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                      <DollarSign size={32} className="text-black mr-3" />
                      <div>
                        <p className="text-sm text-gray-500">Total Revenue</p>
                        <p className="text-xl font-bold text-gray-800">
                          {financialReportData.totalRevenue}
                        </p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                      <TrendingUp size={32} className="text-black mr-3" />
                      <div>
                        <p className="text-sm text-gray-500">Total Expenses</p>
                        <p className="text-xl font-bold text-gray-800">
                          {financialReportData.totalExpenses}
                        </p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                      <Briefcase size={32} className="text-black mr-3" />
                      <div>
                        <p className="text-sm text-gray-500">Net Profit</p>
                        <p className="text-xl font-bold text-gray-800">
                          {financialReportData.netProfit}
                        </p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                      <BarChart2 size={32} className="text-black mr-3" />
                      <div>
                        <p className="text-sm text-gray-500">
                          Total Transactions
                        </p>
                        <p className="text-xl font-bold text-gray-800">
                          {financialReportData.numberOfTransactions}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Metrics */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Payment Statistics */}
                      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Users size={18} className="text-black" />
                            Payment Statistics
                          </h3>
                        </div>
                        <div className="p-4">
                          <table className="w-full">
                            <tbody>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 text-gray-600">
                                  Total Payments to Workers
                                </td>
                                <td className="py-2 text-right font-medium">
                                  {financialReportData.totalPaymentsToWorkers}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 text-gray-600">
                                  Average Worker Payment
                                </td>
                                <td className="py-2 text-right font-medium">
                                  {financialReportData.averageWorkerPayment}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 text-gray-600">
                                  Workers Paid
                                </td>
                                <td className="py-2 text-right font-medium">
                                  {financialReportData.numberOfWorkersPaid}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Transaction Details */}
                      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <CreditCard size={18} className="text-black" />
                            Transaction Details
                          </h3>
                        </div>
                        <div className="p-4">
                          <table className="w-full">
                            <tbody>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <ArrowUpRight
                                      size={16}
                                      className="text-red-500"
                                    />
                                    Money Sent Out
                                  </div>
                                </td>
                                <td className="py-2 text-right font-medium">
                                  {financialReportData.totalMoneySentOut}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <ArrowDownLeft
                                      size={16}
                                      className="text-green-500"
                                    />
                                    Money Deposited
                                  </div>
                                </td>
                                <td className="py-2 text-right font-medium">
                                  {financialReportData.totalMoneyDeposited}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 text-gray-600">
                                  Transaction Fees
                                </td>
                                <td className="py-2 text-right font-medium">
                                  {financialReportData.transactionFees}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 text-gray-600">
                                  Average Transaction Amount
                                </td>
                                <td className="py-2 text-right font-medium">
                                  {financialReportData.averageTransactionAmount}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Recent Transactions */}
                    <div className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800">
                          Recent Transactions
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Transaction ID
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Date
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Category
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Amount
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {financialReportData.recentTransactions.map(
                              (tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {tx.id.substring(0, 8)}...
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {tx.timestamp
                                      ? formatDate(tx.timestamp)
                                      : "N/A"}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        tx.category === "deposit"
                                          ? "bg-green-100 text-green-800"
                                          : tx.category === "Payroll"
                                          ? "bg-gray-100 text-gray-800"
                                          : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {tx.category.charAt(0).toUpperCase() +
                                        tx.category.slice(1)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatCurrency(tx.amount)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        tx.status === "Success"
                                          ? "bg-green-100 text-green-800"
                                          : tx.status === "Failed"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-yellow-100 text-yellow-800"
                                      }`}
                                    >
                                      {tx.status}
                                    </span>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Report Footer */}
                  <div className="bg-gray-50 p-4 border-t border-gray-200 rounded-b-lg text-center text-sm text-gray-500">
                    This report is generated automatically and provides a
                    summary of financial performance. For accounting and tax
                    purposes, please consult with your financial advisor.
                  </div>
                </motion.div>
              )}

              {isGeneratingReport && (
                <motion.div
                  key="reportLoading"
                  variants={fadeInUpVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="bg-white rounded-lg shadow-md border border-gray-200 animate-pulse"
                >
                  {/* Report Header */}
                  <div className="bg-gray-100 p-6 border-b border-gray-200 rounded-t-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="h-6 bg-gray-300 rounded w-48 mb-2"></div>
                        <div className="h-4 bg-gray-300 rounded w-64"></div>
                      </div>
                      <div className="space-x-2">
                        <div className="h-8 w-20 bg-gray-300 rounded"></div>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-gray-200">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="h-8 w-8 bg-gray-300 rounded-full mb-3"></div>
                      <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
                      <div className="h-6 bg-gray-300 rounded w-32"></div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="h-8 w-8 bg-gray-300 rounded-full mb-3"></div>
                      <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
                      <div className="h-6 bg-gray-300 rounded w-32"></div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="h-8 w-8 bg-gray-300 rounded-full mb-3"></div>
                      <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
                      <div className="h-6 bg-gray-300 rounded w-32"></div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="h-8 w-8 bg-gray-300 rounded-full mb-3"></div>
                      <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
                      <div className="h-6 bg-gray-300 rounded w-32"></div>
                    </div>
                  </div>

                  {/* Financial Statements */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                          <div className="h-6 bg-gray-300 rounded w-48"></div>
                        </div>
                        <div className="p-4">
                          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                          <div className="h-4 bg-gray-300 rounded w-full"></div>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                          <div className="h-6 bg-gray-300 rounded w-48"></div>
                        </div>
                        <div className="p-4">
                          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                          <div className="h-4 bg-gray-300 rounded w-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {!financialReportData && !isGeneratingReport && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="text-center p-8 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200"
                >
                  <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">
                    No financial report generated yet
                  </p>
                  <p className="mb-6">
                    Select a date range and click "Generate Financial Report" to
                    create one.
                  </p>
                  <button
                    onClick={handleGenerateReport}
                    className="inline-flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    <FileSpreadsheet size={18} className="mr-2" />
                    Generate Report
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Transaction Statement Tab */}
        {activeTab === "financial-statement" && (
          <motion.div
            variants={fadeInUpVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Filters and Controls */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center mb-4">
                <Filter size={18} className="text-gray-500 mr-2" />
                <h3 className="text-lg font-medium text-gray-700">
                  Transaction Filters
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.startDate.toISOString().split("T")[0]}
                    onChange={(e) => handleDateRangeChange(e, "startDate")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.endDate.toISOString().split("T")[0]}
                    onChange={(e) => handleDateRangeChange(e, "endDate")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={transactionFilters.category}
                    onChange={(e) => handleFilterChange(e, "category")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="deposit">Deposits</option>
                    <option value="withdrawal">Withdrawals</option>
                    <option value="Payroll">Payroll</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={transactionFilters.status}
                    onChange={(e) => handleFilterChange(e, "status")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Success">Successful</option>
                    <option value="Pending">Pending</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Amount
                  </label>
                  <input
                    type="number"
                    placeholder="Minimum amount"
                    value={transactionFilters.minAmount}
                    onChange={(e) => handleFilterChange(e, "minAmount")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Amount
                  </label>
                  <input
                    type="number"
                    placeholder="Maximum amount"
                    value={transactionFilters.maxAmount}
                    onChange={(e) => handleFilterChange(e, "maxAmount")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Reset Filters
                </button>
                <button
                  onClick={handleGenerateTransactionStatement}
                  disabled={isLoadingTransactions}
                  className={`flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors ${
                    isLoadingTransactions ? "opacity-70 cursor-wait" : ""
                  }`}
                >
                  {isLoadingTransactions ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <FileText size={18} />
                      Generate Statement
                    </>
                  )}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {transactionData && (
                <motion.div
                  key="statementDisplay"
                  variants={fadeInUpVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="bg-white rounded-lg shadow-md border border-gray-200"
                >
                  {/* Statement Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-b border-gray-200 rounded-t-lg">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                          <FileText size={24} className="text-black" />
                          Transaction Statement
                        </h2>
                        <p className="text-gray-600 mt-1">
                          Generated on {transactionData.summary.generatedDate}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar size={14} />
                          Period: {transactionData.summary.startDate} -{" "}
                          {transactionData.summary.endDate}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <PDFDownloadLink
                          document={
                            <TransactionStatementPDF data={transactionData} />
                          }
                          fileName={`Transaction-Statement-${
                            new Date().toISOString().split("T")[0]
                          }.pdf`}
                          className="flex items-center gap-1 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-900 transition-colors"
                        >
                          {({ loading }) => (
                            <>
                              {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Download size={16} />
                              )}
                              {loading ? "Preparing PDF..." : "Export PDF"}
                            </>
                          )}
                        </PDFDownloadLink>
                      </div>
                    </div>
                  </div>

                  {/* Statement Summary */}
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">
                          Total Transactions
                        </p>
                        <p className="text-xl font-bold text-gray-800">
                          {transactionData.summary.totalTransactions}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">Total Deposits</p>
                        <p className="text-xl font-bold text-gray-800">
                          {transactionData.summary.totalDeposits}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">
                          Total Withdrawals
                        </p>
                        <p className="text-xl font-bold text-gray-800">
                          {transactionData.summary.totalWithdrawals}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Transactions by Month */}
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Transaction Details
                    </h3>

                    {Object.entries(transactionData.transactionsByMonth).map(
                      ([month, transactions]) => (
                        <div key={month} className="mb-6">
                          <h4 className="text-md font-medium text-gray-700 mb-2 flex items-center">
                            <Calendar size={16} className="mr-2 text-black" />
                            {month}
                          </h4>
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th
                                      scope="col"
                                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      Date
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      Transaction ID
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      Type
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      Category
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      Amount
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {transactions.map((tx) => (
                                    <tr
                                      key={tx.id}
                                      className="hover:bg-gray-50"
                                    >
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {tx.formattedDate}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {tx.id.substring(0, 8)}...
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span
                                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            tx.type === "Credit"
                                              ? "bg-green-100 text-green-800"
                                              : "bg-red-100 text-red-800"
                                          }`}
                                        >
                                          {tx.type}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {tx.category.charAt(0).toUpperCase() +
                                          tx.category.slice(1)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {tx.formattedAmount}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span
                                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            tx.status === "Success"
                                              ? "bg-green-100 text-green-800"
                                              : tx.status === "Failed"
                                              ? "bg-red-100 text-red-800"
                                              : "bg-yellow-100 text-yellow-800"
                                          }`}
                                        >
                                          {tx.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Statement Footer */}
                  <div className="bg-gray-50 p-4 border-t border-gray-200 rounded-b-lg text-center text-sm text-gray-500">
                    This statement is generated automatically and provides a
                    record of your transactions. For accounting and tax
                    purposes, please consult with your financial advisor.
                  </div>
                </motion.div>
              )}

              {isLoadingTransactions && (
                <motion.div
                  key="statementLoading"
                  variants={fadeInUpVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center"
                >
                  <Loader2
                    size={48}
                    className="mx-auto mb-4 text-gray-500 animate-spin"
                  />
                  <p className="text-lg font-medium text-gray-700">
                    Loading transaction data...
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    This may take a moment depending on the date range.
                  </p>
                </motion.div>
              )}

              {!transactionData && !isLoadingTransactions && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="text-center p-8 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200"
                >
                  <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">
                    No transaction statement generated yet
                  </p>
                  <p className="mb-6">
                    Apply filters and click "Generate Statement" to create one.
                  </p>
                  <button
                    onClick={handleGenerateTransactionStatement}
                    className="inline-flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    <FileText size={18} className="mr-2" />
                    Generate Statement
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Tax Filing Tab */}
        {activeTab === "tax-filing" && (
          <motion.div
            variants={fadeInUpVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="text-center p-8 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200"
          >
            <Clock size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              Tax Filing Feature Coming Soon!
            </p>
            <p className="mb-6">
              We're working on making tax filing easier for your business.
            </p>
            <p className="text-sm">Stay tuned for updates.</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default FinancialReportingPage;
