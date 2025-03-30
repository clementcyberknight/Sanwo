"use client";

import React, { useState, useEffect } from "react";
import {
  EmployerPoolContractAddress,
  SanwoUtilityToken,
  linea_scan,
} from "../../../sc_/utils";
import EmployerPoolAbi from "../../../sc_/EmployeePoolAbi.json";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { formatUnits, parseAbi, parseGwei } from "viem";
import {
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  Search,
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import WalletDepositModal from "../../components/walletdeposit";
import WalletSendModal from "../../components/walletsend";
import axios from "axios";
import { useRouter } from "next/navigation";
import { auth, getFirestore, doc, getDoc } from "@/app/config/FirebaseConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import TransactionDetailsModal from "../../components/TransactionDetailsModal";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
} from "firebase/firestore";

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal";
  depositAmount?: number;
  withdrawalAmount?: number;
  depositToken?: string;
  withdrawalToken?: string;
  depositStatus?: string;
  withdrawalStatus?: string;
  category: string;
  transactionHash: string;
  createdAt: string | { seconds: number; nanoseconds: number };
  errorDetails?: string;
  depositDate?: string | { seconds: number; nanoseconds: number };
  fromWalletAddress?: string;
  withdrawalDate?: string | { seconds: number; nanoseconds: number };
  recipientWalletAddress?: string;
}

const WalletDashboard = () => {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const activeAccount = useAccount();
  const useraddress = activeAccount?.address;
  const [showBalance, setShowBalance] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [timeRange, setTimeRange] = useState("30D");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showShieldTooltip, setShowShieldTooltip] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [balance, setBalance] = useState<string | null>("00");
  const [tokens, setTokens] = useState([
    {
      symbol: "ETH",
      amount: "10.02",
      price: "$...",
      change: "...",
      total: "$20,043.30",
      icon: "/icons/eth.png",
      changeColor: "text-gray-500",
      balance: 10.02,
    },
    {
      symbol: "USDC",
      amount: "48,000.09",
      price: "$...",
      change: "...",
      total: "$48,004.89",
      icon: "/icons/usdc.png",
      changeColor: "text-gray-500",
      balance: 48000.09,
    },
    {
      symbol: "USDT",
      amount: "5,427.81",
      price: "$...",
      change: "...",
      total: "$5,427.81",
      icon: "/icons/usdt.png",
      changeColor: "text-gray-500",
      balance: 5427.81,
    },
  ]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  const COINGECKO_API_KEY = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;

  const fetchTokenPrices = async () => {
    const tokenIds = "ethereum,usd-coin,tether";
    const vsCurrency = "usd";
    const includeChange = true;

    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-cg-demo-api-key": process.env.NEXT_PUBLIC_COINGECKO_API_KEY,
      },
    };

    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds}&vs_currencies=${vsCurrency}&include_24hr_change=${includeChange}&include_last_updated_at=true&precision=3`,
        options
      );
      const prices = response.data;
      console.log("Coingecko API Response:", prices);

      setTokens((prevTokens) => {
        return prevTokens.map((token) => {
          let price = "$...";
          let change = "...";
          let changeColor = "text-gray-500";

          if (token.symbol === "ETH" && prices.ethereum) {
            price = `$${prices.ethereum.usd}`;
            change = `${prices.ethereum.usd_24h_change.toFixed(2)}%`;
            changeColor =
              prices.ethereum.usd_24h_change >= 0
                ? "text-green-500"
                : "text-red-500";
          } else if (token.symbol === "USDC" && prices["usd-coin"]) {
            price = `$${prices["usd-coin"].usd}`;
            change = `${prices["usd-coin"].usd_24h_change.toFixed(2)}%`;
            changeColor =
              prices["usd-coin"].usd_24h_change >= 0
                ? "text-green-500"
                : "text-red-500";
          } else if (token.symbol === "USDT" && prices.tether) {
            price = `$${prices.tether.usd}`;
            change = `${prices.tether.usd_24h_change.toFixed(2)}%`;
            changeColor =
              prices.tether.usd_24h_change >= 0
                ? "text-green-500"
                : "text-red-500";
          }
          return {
            ...token,
            price: price,
            change: change,
            changeColor: changeColor,
          };
        });
      });
    } catch (error) {
      console.error("Error fetching token prices from Coingecko:", error);
    }
  };

  useEffect(() => {
    fetchTokenPrices();
  }, []);

  const {
    data: employerBalanceData,
    isSuccess: isBalanceSuccess,
    refetch: refetchBalance,
  } = useReadContract({
    address: EmployerPoolContractAddress as `0x${string}`,
    abi: EmployerPoolAbi,
    functionName: "employerBalance",
    args: [useraddress],
    ...(useraddress ? {} : { skip: true }),
    //@ts-ignore
    chainId: 59141,
  });

  useEffect(() => {
    if (isBalanceSuccess && employerBalanceData) {
      try {
        //@ts-ignore
        const formattedBalance = formatUnits(employerBalanceData, 6);
        setBalance(formattedBalance);
        console.log(
          `Wagmi Balance Update: formatted balance ${formattedBalance} and balance state is now ${formattedBalance}`
        );
      } catch (error) {
        console.error("Error formatting balance from Wagmi:", error);
        setBalance(null);
      }
    }
  }, [isBalanceSuccess, employerBalanceData]);

  useEffect(() => {
    if (useraddress) {
      const interval = setInterval(() => {
        refetchBalance();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [useraddress, refetchBalance]);

  const chartDataByRange = {
    "24H": [
      { name: "00:00", value: 72000 },
      { name: "04:00", value: 72500 },
      { name: "08:00", value: 73000 },
      { name: "12:00", value: 72800 },
      { name: "16:00", value: 74500 },
      { name: "20:00", value: 75000 },
      { name: "24:00", value: 75200 },
    ],
    "7D": [
      { name: "Mon", value: 71000 },
      { name: "Tue", value: 72500 },
      { name: "Wed", value: 73000 },
      { name: "Thu", value: 72000 },
      { name: "Fri", value: 74000 },
      { name: "Sat", value: 74500 },
      { name: "Sun", value: 75000 },
    ],
    "30D": [
      { name: "Week 1", value: 68000 },
      { name: "Week 2", value: 70000 },
      { name: "Week 3", value: 72000 },
      { name: "Week 4", value: 75000 },
    ],
    "90D": [
      { name: "Jan", value: 65000 },
      { name: "Feb", value: 68000 },
      { name: "Mar", value: 75000 },
    ],
  };

  const openDepositModal = () => setIsDepositModalOpen(true);
  const closeDepositModal = () => setIsDepositModalOpen(false);
  const openSendModal = () => setIsSendModalOpen(true);
  const closeSendModal = () => setIsSendModalOpen(false);

  useEffect(() => {
    if (!firebaseUser || !useraddress) return;

    let unsubscribe: () => void;

    try {
      const walletTransactionsRef = collection(
        getFirestore(),
        `businesses/${useraddress}/walletTransactions`
      );

      const q = query(
        walletTransactionsRef,
        orderBy("createdAt", "desc"),
        limit(50)
      );

      // Replace getDocs with onSnapshot
      unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const txs = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Transaction[];
          setTransactions(txs);
        },
        (error) => {
          console.error("Error listening to transactions:", error);
          showErrorToast("Failed to load transactions");
        }
      );
    } catch (error) {
      console.error("Error setting up transaction listener:", error);
      showErrorToast("Failed to load transactions");
    }

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [firebaseUser, useraddress]);

  const handleTransactionClick = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  const filteredTransactions = transactions.filter((tx: any) => {
    const matchesSearch =
      searchQuery === "" ||
      tx.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.transactionHash?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "received" && tx.type === "deposit") ||
      (activeTab === "sent" && tx.type === "withdrawal");

    return matchesSearch && matchesTab;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (
    dateString: string | Date | { seconds: number; nanoseconds: number } | null
  ) => {
    try {
      if (!dateString) {
        return "Loading...";
      }

      let date: Date;

      if (typeof dateString === "object" && "seconds" in dateString) {
        // Handle Firebase Timestamp
        date = new Date(dateString.seconds * 1000);
      } else if (dateString instanceof Date) {
        date = dateString;
      } else if (typeof dateString === "string") {
        date = new Date(dateString);
      } else {
        return "Invalid date";
      }

      const options = {
        month: "short",
        day: "numeric",
        year: "numeric",
      } as const;

      return date.toLocaleDateString("en-US", options);
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  const refreshWalletData = () => {
    refetchBalance();
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { when: "beforeChildren", staggerChildren: 0.1 },
    },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };
  const tooltipVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 300, damping: 20 },
    },
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active: boolean;
    payload: any[];
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-md border border-gray-100">
          <p className="font-medium text-gray-900">
            {payload[0].value.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 0,
            })}
          </p>
        </div>
      );
    }
    return null;
  };

  // Add toast notification functions
  const showErrorToast = (message: string) => {
    toast.error(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  // Firebase Authentication Check
  useEffect(() => {
    let authUnsubscribe: any;

    const initializeAuth = async () => {
      authUnsubscribe = auth.onAuthStateChanged(async (user) => {
        setFirebaseUser(user);
        setIsAuthReady(true);

        if (user) {
          if (!activeAccount || !activeAccount.address) {
            showErrorToast("Please connect your wallet to view wallet data.");
            return;
          }

          // Verify wallet address matches registered address
          const db = getFirestore();
          const businessDocRef = doc(db, "users", user.uid);

          try {
            const docSnap = await getDoc(businessDocRef);
            if (docSnap.exists()) {
              const businessData = docSnap.data();
              const registeredAddress =
                businessData.wallet_address.toLowerCase();
              const currentAddress = activeAccount.address.toLowerCase();

              if (registeredAddress !== currentAddress) {
                showErrorToast(
                  "Connected wallet does not match registered business account."
                );
                router.push("/auth/login");
                return;
              }
            }
          } catch (error) {
            console.error("Error verifying wallet address:", error);
            showErrorToast("Error verifying wallet address");
          }
        } else {
          router.push("/auth/login");
        }
      });
    };

    initializeAuth();

    return () => {
      if (authUnsubscribe) authUnsubscribe();
    };
  }, [activeAccount, router]);

  // Don't render anything until auth is ready
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If not authenticated, don't render the dashboard
  if (!firebaseUser) {
    return null;
  }

  const renderTransactionAmount = (tx: Transaction) => {
    const amount =
      tx.type === "deposit" ? tx.depositAmount : tx.withdrawalAmount;
    const token = tx.type === "deposit" ? tx.depositToken : tx.withdrawalToken;
    return `${formatCurrency(Math.abs(amount || 0))} ${token}`;
  };

  const renderTransactionDate = (tx: Transaction) => {
    const date = tx.type === "deposit" ? tx.depositDate : tx.withdrawalDate;
    //@ts-ignore
    return formatDate(date || tx.createdAt);
  };

  const renderTransactionStatus = (tx: Transaction) => {
    return tx.type === "deposit" ? tx.depositStatus : tx.withdrawalStatus;
  };

  const renderTransactionAddress = (tx: Transaction) => {
    return tx.type === "deposit"
      ? tx.fromWalletAddress
      : tx.recipientWalletAddress;
  };

  const calculateQuickStats = (transactions: Transaction[]) => {
    if (!transactions.length) {
      return {
        mostUsedToken: "N/A",
        bestPerformer: "N/A",
        lastDeposit: "N/A",
        lastTransfer: "N/A",
      };
    }

    // Most Used Token
    const tokenUsage = transactions.reduce(
      (acc: { [key: string]: number }, tx) => {
        const token =
          tx.type === "deposit" ? tx.depositToken : tx.withdrawalToken;
        if (token) {
          acc[token] = (acc[token] || 0) + 1;
        }
        return acc;
      },
      {}
    );

    const mostUsedToken =
      Object.entries(tokenUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // Best Performer (using your tokens state data)
    const bestPerformer = tokens.reduce((best, current) => {
      const currentChange = parseFloat(current.change?.replace("%", "") || "0");
      const bestChange = parseFloat(best.change?.replace("%", "") || "0");
      return currentChange > bestChange ? current : best;
    });

    // Helper function to convert any date format to timestamp
    const getTimestamp = (
      date: string | { seconds: number; nanoseconds: number } | null
    ) => {
      if (!date) {
        return Date.now();
      }

      if (typeof date === "object" && "seconds" in date) {
        return date.seconds * 1000;
      }
      return new Date(date).getTime();
    };

    // Last Deposit
    const lastDeposit = transactions
      .filter((tx) => tx.type === "deposit")
      .sort((a, b) => {
        const timeA = getTimestamp(a.depositDate || a.createdAt);
        const timeB = getTimestamp(b.depositDate || b.createdAt);
        return timeB - timeA;
      })[0];

    // Last Transfer (withdrawal)
    const lastTransfer = transactions
      .filter((tx) => tx.type === "withdrawal")
      .sort((a, b) => {
        const timeA = getTimestamp(a.withdrawalDate || a.createdAt);
        const timeB = getTimestamp(b.withdrawalDate || b.createdAt);
        return timeB - timeA;
      })[0];

    return {
      mostUsedToken,
      bestPerformer: `${bestPerformer.symbol} ${bestPerformer.change}`,
      lastDeposit: lastDeposit
        ? formatDate(lastDeposit.depositDate || lastDeposit.createdAt)
        : "N/A",
      lastTransfer: lastTransfer
        ? formatDate(lastTransfer.withdrawalDate || lastTransfer.createdAt)
        : "N/A",
    };
  };

  const quickStats = calculateQuickStats(transactions);

  return (
    <>
      <ToastContainer />
      <div className="bg-white min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-gray-800 to-gray-900 text-white">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-2 relative">
                      <div
                        className="relative"
                        onMouseEnter={() => setShowShieldTooltip(true)}
                        onMouseLeave={() => setShowShieldTooltip(false)}
                      >
                        <Shield size={20} className="cursor-pointer" />
                        <AnimatePresence>
                          {showShieldTooltip && (
                            <motion.div
                              variants={tooltipVariants}
                              initial="hidden"
                              animate="visible"
                              exit="hidden"
                              className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-10"
                            >
                              Protected by Sanwó Guard
                              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <h2 className="font-medium">Total Balance</h2>
                    </div>
                    <button
                      onClick={() => setShowBalance(!showBalance)}
                      className="hover:bg-white/20 p-2 rounded-full transition-colors"
                    >
                      {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  <div className="flex items-end space-x-4">
                    <div className="text-3xl font-bold">
                      {showBalance
                        ? formatCurrency(parseFloat(balance || "0"))
                        : "•••••••"}
                    </div>
                    <div className="text-gray-300 text-sm pb-1 flex items-center">
                      <TrendingUp size={14} className="mr-1" />
                      +4.3% this month
                    </div>
                  </div>
                </div>
                <div className="pt-4 px-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-700">
                      Balance History
                    </h3>
                    <div className="flex space-x-2">
                      {Object.keys(chartDataByRange).map((range) => (
                        <button
                          key={range}
                          onClick={() => setTimeRange(range)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            timeRange === range
                              ? "bg-gray-100 text-gray-900"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          {range}
                        </button>
                      ))}
                      <button
                        onClick={refreshWalletData}
                        className="ml-2 p-1 text-gray-500 hover:text-black rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <RefreshCw
                          size={16}
                          className={isRefreshing ? "animate-spin" : ""}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={
                          //@ts-ignore
                          chartDataByRange[timeRange]
                        }
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorValue"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#000000"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#000000"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#9CA3AF", fontSize: 12 }}
                        />
                        <YAxis hide={true} domain={["auto", "auto"]} />
                        <Tooltip
                          content={
                            //@ts-ignore
                            <CustomTooltip />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#000000"
                          strokeWidth={2}
                          fill="url(#colorValue)"
                          activeDot={{
                            r: 6,
                            strokeWidth: 2,
                            stroke: "#FFFFFF",
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center space-x-2 bg-black text-white font-medium py-3 px-4 rounded-xl hover:bg-gray-900 transition-colors shadow-sm"
                    onClick={openSendModal}
                  >
                    <ArrowUpRight size={18} />
                    <span>Send</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center space-x-2 bg-white text-black font-medium py-3 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                    onClick={openDepositModal}
                  >
                    <ArrowDownLeft size={18} />
                    <span>Deposit</span>
                  </motion.button>
                </div>
              </div>
              <motion.div
                variants={itemVariants}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 mt-6 p-6"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Transactions
                  </h2>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Search transactions..."
                        className="w-64 pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="border-b border-gray-200 mb-6">
                  <div className="flex space-x-8">
                    <button
                      onClick={() => setActiveTab("all")}
                      className={`pb-3 px-1 text-sm font-medium ${
                        activeTab === "all"
                          ? "text-black border-b-2 border-black"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      All Transactions
                    </button>
                    <button
                      onClick={() => setActiveTab("received")}
                      className={`pb-3 px-1 text-sm font-medium ${
                        activeTab === "received"
                          ? "text-black border-b-2 border-black"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Received
                    </button>
                    <button
                      onClick={() => setActiveTab("sent")}
                      className={`pb-3 px-1 text-sm font-medium ${
                        activeTab === "sent"
                          ? "text-black border-b-2 border-black"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Sent
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {filteredTransactions.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {filteredTransactions.map((tx: any) => (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 25,
                          }}
                          className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 cursor-pointer"
                          onClick={() => handleTransactionClick(tx)}
                        >
                          <div className="flex items-center space-x-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                tx.type === "deposit"
                                  ? "bg-green-100"
                                  : "bg-red-100"
                              }`}
                            >
                              {tx.type === "deposit" ? (
                                <ArrowDownLeft
                                  size={20}
                                  className="text-green-600"
                                />
                              ) : (
                                <ArrowUpRight
                                  size={20}
                                  className="text-red-600"
                                />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">
                                {tx.category}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center space-x-2">
                                <span>{renderTransactionDate(tx)}</span>
                                <span>•</span>
                                <span className="font-medium">
                                  {renderTransactionAddress(tx)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-semibold ${
                                tx.type === "deposit"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {tx.type === "deposit" ? "+" : "-"}
                              {renderTransactionAmount(tx)}
                            </div>
                            <div className="text-xs flex items-center justify-end mt-1 text-gray-500">
                              <Clock size={12} className="mr-1" />
                              <span className="capitalize">
                                {renderTransactionStatus(tx)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-10 text-gray-500"
                    >
                      No transactions found.
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">
                  Your Assets
                </h2>
                <div className="space-y-4">
                  {tokens.map((token, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ y: -2, transition: { duration: 0.2 } }}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center">
                          <img
                            src={token.icon}
                            alt={token.symbol}
                            className="w-6 h-6 object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">
                            {token.symbol}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center">
                            <span>{token.price}</span>
                            <span
                              className={`ml-2 ${token.changeColor} flex items-center`}
                            >
                              {token.change.includes("-") ? (
                                <TrendingDown size={12} className="mr-1" />
                              ) : (
                                <TrendingUp size={12} className="mr-1" />
                              )}
                              {token.change}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-800">
                          {token.amount}
                        </div>
                        <div className="text-xs text-gray-500">
                          {token.total}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">
                    Quick Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                    >
                      <div className="text-sm text-gray-500 mb-1">
                        Most Used
                      </div>
                      <div className="font-medium text-gray-800">
                        {quickStats.mostUsedToken}
                      </div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                    >
                      <div className="text-sm text-gray-500 mb-1">
                        Best Performer
                      </div>
                      <div className="font-medium text-gray-800">
                        {quickStats.bestPerformer}
                      </div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                    >
                      <div className="text-sm text-gray-500 mb-1">
                        Last Deposit
                      </div>
                      <div className="font-medium text-gray-800">
                        {quickStats.lastDeposit}
                      </div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                    >
                      <div className="text-sm text-gray-500 mb-1">
                        Last Transfer
                      </div>
                      <div className="font-medium text-gray-800">
                        {quickStats.lastTransfer}
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
          <WalletDepositModal
            isOpen={isDepositModalOpen}
            onClose={closeDepositModal}
          />
          <WalletSendModal isOpen={isSendModalOpen} onClose={closeSendModal} />
          <TransactionDetailsModal
            isOpen={isTransactionModalOpen}
            onClose={() => setIsTransactionModalOpen(false)}
            transaction={selectedTransaction}
          />
        </div>
      </div>
    </>
  );
};

export default WalletDashboard;
