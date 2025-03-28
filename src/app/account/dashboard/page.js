"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  DollarSign,
  Users,
  Search,
  X,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
} from "lucide-react";
import {
  auth,
  app,
  getFirestore,
  collection,
  doc,
  onSnapshot,
  getDoc,
} from "@/app/config/FirebaseConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

// Constants (move these to a separate config file for better organization)
const TOAST_CONFIG = {
  position: "top-right",
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
};

const formatCurrency = (amount) => {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : parseFloat(String(amount).replace(/[^0-9.-]+/g, ""));
  if (isNaN(numericAmount)) {
    return "Invalid Amount";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numericAmount);
};

const formatDate = (timestamp) => {
  if (!timestamp) return "N/A";
  try {
    // Handle both Firestore Timestamp and seconds
    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp.seconds * 1000);

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid Date";
  }
};

const calculateMonthlyPayments = (transactions) => {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return transactions.reduce((total, transaction) => {
    const txDate =
      transaction.timestamp?.toDate?.() ||
      new Date(transaction.timestamp?.seconds * 1000);

    if (txDate >= firstDayOfMonth && transaction.status === "Success") {
      return total + (Number(transaction.amount) || 0);
    }
    return total;
  }, 0);
};

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [timeRange, setTimeRange] = useState("All time");
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    workersInPayroll: 0,
    workersPercentageChange: 0,
    nextPaymentDate: null,
    totalPaymentsThisMonth: 0,
    paymentsPercentageChange: 0,
    payrollBalance: 0,
  });
  const { address } = useAccount();
  const [nextPaymentDateDisplay, setNextPaymentDateDisplay] =
    useState("Loading...");
  const [daysFromNow, setDaysFromNow] = useState("");
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState(null);

  const showErrorToast = (message) => {
    toast.error(message, TOAST_CONFIG);
  };

  const showSuccessToast = (message) => {
    toast.success(message, TOAST_CONFIG);
  };

  useEffect(() => {
    let authUnsubscribe;

    const initializeAuth = async () => {
      authUnsubscribe = auth.onAuthStateChanged(async (user) => {
        setFirebaseUser(user);
        setIsAuthReady(true);

        if (user) {
          if (!address) {
            console.log("Please connect your wallet to view worker data.");
            showErrorToast("Please connect your wallet to view worker data.");
            setIsLoading(false);
            return;
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
  }, [address, router]);

  // Fetch transactions and business settings
  useEffect(() => {
    let unsubscribeTransactions;

    if (firebaseUser && address) {
      const db = getFirestore(app);
      const businessDocRef = doc(db, "users", firebaseUser.uid);

      getDoc(businessDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const businessData = docSnap.data();
            const registeredAddress = businessData.wallet_address.toLowerCase();
            const currentAddress = address.toLowerCase();
            if (registeredAddress !== currentAddress) {
              showErrorToast(
                "Connected wallet does not match registered business account."
              );
              router.push("/auth/login");
              return;
            }

            const transactionsRef = collection(
              db,
              "businesses",
              address,
              "payments"
            );
            unsubscribeTransactions = onSnapshot(
              transactionsRef,
              (snapshot) => {
                const transactionsData = snapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                }));
                setTransactions(transactionsData);

                // Calculate total payments this month
                const monthlyTotal = calculateMonthlyPayments(transactionsData);
                setStats((prevStats) => ({
                  ...prevStats,
                  totalPaymentsThisMonth: monthlyTotal,
                }));

                setIsLoading(false);
              },
              (error) => {
                console.error("Error fetching transactions:", error);
                showErrorToast("Error fetching transactions");
                setIsLoading(false);
              }
            );

            // Fetch business data for other stats (workers in payroll, next payment date)
            const businessRef = doc(db, "businesses", address);
            getDoc(businessRef)
              .then((businessSnap) => {
                if (businessSnap.exists()) {
                  const data = businessSnap.data();

                  let nextPaymentDate = null;
                  if (data.settings?.nextPaymentDate?.seconds) {
                    nextPaymentDate = new Date(
                      data.settings.nextPaymentDate.seconds * 1000
                    );
                    setNextPaymentDateDisplay(
                      formatDate(data.settings.nextPaymentDate)
                    );

                    const today = new Date();
                    const diffTime =
                      nextPaymentDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24)
                    );
                    setDaysFromNow(
                      diffDays > 0 ? `${diffDays} days from now` : "Today"
                    );
                  } else {
                    setNextPaymentDateDisplay("No scheduled payroll");
                    setDaysFromNow("");
                  }

                  setStats((prevStats) => ({
                    ...prevStats,
                    workersInPayroll: data.totalPayroll || 0,
                    nextPaymentDate: nextPaymentDate,
                  }));
                }
              })
              .catch((error) => {
                console.error("Error fetching business data for stats", error);
                showErrorToast("Error fetching business stat");
              });
          } else {
            showErrorToast("Business Data Not Found");
            return;
          }
        })
        .catch((error) => {
          console.error("Error fetching business data:", error);
          showErrorToast(`Error fetching business data: ${error.message}`);
          router.push("/auth/login");
        });
    } else {
      setTransactions([]);
      setIsLoading(false);
      setNextPaymentDateDisplay("Loading...");
      setDaysFromNow("");
    }

    return () => {
      if (unsubscribeTransactions) unsubscribeTransactions();
    };
  }, [firebaseUser, address, router]);

  // New useEffect: Listen to the workers collection and sum payroll balance
  useEffect(() => {
    let unsubscribeWorkers;
    if (firebaseUser && address) {
      const db = getFirestore(app);
      const workersRef = collection(db, "businesses", address, "workers");
      unsubscribeWorkers = onSnapshot(
        workersRef,
        (snapshot) => {
          const workersData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          const totalPayrollBalance = workersData.reduce((acc, worker) => {
            if (worker.worker_wallet) {
              return acc + (worker.worker_salary || 0);
            }
            return acc;
          }, 0);
          setStats((prevStats) => ({
            ...prevStats,
            payrollBalance: totalPayrollBalance,
          }));
        },
        (error) => {
          console.error("Error fetching workers:", error);
          showErrorToast("Error fetching workers for payroll balance");
        }
      );
    }
    return () => {
      if (unsubscribeWorkers) unsubscribeWorkers();
    };
  }, [firebaseUser, address]);

  useEffect(() => {
    let filtered = [...transactions];
    const today = new Date();

    if (timeRange !== "All time") {
      const rangeDays = {
        "Last 7 days": 7,
        "Last 30 days": 30,
        "Last 90 days": 90,
      }[timeRange];

      filtered = transactions.filter((transaction) => {
        const transactionDate = transaction.date
          ? new Date(transaction.date.seconds * 1000)
          : null;
        if (!transactionDate) return false;
        const diffTime = Math.abs(today - transactionDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= rangeDays;
      });
    }

    const lowerSearch = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (transaction) =>
        (transaction.workerName &&
          transaction.workerName.toLowerCase().includes(lowerSearch)) ||
        (transaction.transactionId &&
          transaction.transactionid?.toLowerCase().includes(lowerSearch)) || // Corrected
        (transaction.workerId &&
          transaction.workerId.toLowerCase().includes(lowerSearch)) ||
        (transaction.type &&
          transaction.type.toLowerCase().includes(lowerSearch)) ||
        (transaction.amount &&
          formatCurrency(transaction.amount)
            .toLowerCase()
            .includes(lowerSearch)) ||
        (transaction.date &&
          formatDate(transaction.date).toLowerCase().includes(lowerSearch))
    );

    setFilteredTransactions(filtered);
  }, [searchQuery, timeRange, transactions]);

  const handleShowMore = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleCloseModal = () => {
    setSelectedTransaction(null);
  };

  const StatCard = ({
    title,
    value,
    percentageChange,
    icon: Icon,
    isPositiveChange,
    dateString,
  }) => {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow duration-200">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-black" />
            <span className="text-sm font-medium text-gray-600">{title}</span>
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {typeof value === "number" ? formatCurrency(value) : value}
          </div>
          {percentageChange !== undefined && (
            <div
              className={`text-sm font-medium ${
                isPositiveChange ? "text-green-500" : "text-red-500"
              }`}
            >
              {isPositiveChange ? (
                <TrendingUp size={16} className="inline-block mr-1" />
              ) : (
                <TrendingDown size={16} className="inline-block mr-1" />
              )}
              {percentageChange}%
            </div>
          )}
          {dateString && (
            <div className="text-sm text-black mt-1">{dateString}</div>
          )}
        </div>
      </div>
    );
  };

  const TimeRangeDropdown = () => (
    <select
      className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-700"
      value={timeRange}
      onChange={(e) => setTimeRange(e.target.value)}
    >
      <option>All time</option>
      <option>Last 7 days</option>
      <option>Last 30 days</option>
      <option>Last 90 days</option>
    </select>
  );

  const TransactionDateCell = ({ timestamp }) => {
    if (!timestamp) return <div>No Date</div>;

    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp.seconds * 1000);

    return (
      <div>
        <div className="font-medium">
          {date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
        <div className="text-xs text-gray-400">
          {date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800">Dashboard</h1>
            <p className="text-gray-500 mt-1">
              Welcome, Here's a snapshot of your payroll activity.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search transactions..."
                className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 w-64 text-gray-700"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <TimeRangeDropdown />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Workers in Payroll"
            value={stats.workersInPayroll}
            percentageChange={stats.workersPercentageChange}
            icon={Users}
          />
          <StatCard
            title="Next Payment Date"
            value={nextPaymentDateDisplay}
            dateString={daysFromNow}
            icon={Calendar}
          />
          <StatCard
            title="Total Payments (This Month)"
            value={formatCurrency(stats.totalPaymentsThisMonth)}
            percentageChange={stats.paymentsPercentageChange}
            icon={DollarSign}
            isPositiveChange={false}
          />
          {/* New Stat Card: Total Payroll Balance */}
          <StatCard
            title="Total Payroll Paid"
            value={formatCurrency(stats.payrollBalance)}
            icon={CircleDollarSign}
          />
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Recent Transactions
            </h3>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center p-8 text-gray-500">
                Loading transactions...
              </div>
            ) : filteredTransactions.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount (USDC)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTransactions
                    .sort((a, b) => {
                      // Sort by timestamp in descending order (newest first)
                      const dateA =
                        a.timestamp?.seconds ||
                        a.timestamp?.toDate?.().getTime() ||
                        0;
                      const dateB =
                        b.timestamp?.seconds ||
                        b.timestamp?.toDate?.().getTime() ||
                        0;
                      return dateB - dateA;
                    })
                    .map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <TransactionDateCell
                            timestamp={transaction.timestamp}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="font-medium">
                            {transaction.transactionid || "N/A"}
                          </div>
                          <div className="text-xs text-gray-400 truncate max-w-xs">
                            {transaction.transactionHash ? (
                              <span title={transaction.transactionHash}>
                                {`${transaction.transactionHash.substring(
                                  0,
                                  6
                                )}...${transaction.transactionHash.substring(
                                  transaction.transactionHash.length - 4
                                )}`}
                              </span>
                            ) : (
                              "No Hash"
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                            ${
                              transaction.category === "Payroll"
                                ? "bg-gray-100 text-gray-800"
                                : transaction.category === "Bonus"
                                ? "bg-green-100 text-green-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {transaction.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                            ${
                              transaction.status === "Success"
                                ? "bg-green-100 text-green-800"
                                : transaction.status === "Failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handleShowMore(transaction)}
                            className="text-black hover:text-gray-900 focus:outline-none transition-colors duration-200"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center p-8 text-gray-500">
                No transactions found matching your criteria.
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Modal for Transaction Details */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Transaction Details
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="border-b pb-4">
                <p className="text-sm text-gray-500">Transaction Date</p>
                <p className="text-base font-medium">
                  {selectedTransaction.timestamp?.seconds
                    ? new Date(
                        selectedTransaction.timestamp.seconds * 1000
                      ).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "No Date"}
                </p>
              </div>
              <div className="border-b pb-4">
                <p className="text-sm text-gray-500">Transaction ID</p>
                <p className="text-base font-medium">
                  {selectedTransaction.transactionid || "N/A"}
                </p>
              </div>
              <div className="border-b pb-4">
                <p className="text-sm text-gray-500">Amount</p>
                <p className="text-base font-medium">
                  {formatCurrency(selectedTransaction.amount)}
                </p>
              </div>
              <div className="border-b pb-4">
                <p className="text-sm text-gray-500">Category</p>
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                  ${
                    selectedTransaction.category === "Payroll"
                      ? "bg-gray-100 text-gray-800"
                      : selectedTransaction.category === "Bonus"
                      ? "bg-green-100 text-green-800"
                      : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {selectedTransaction.category}
                </span>
              </div>
              <div className="border-b pb-4">
                <p className="text-sm text-gray-500">Status</p>
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                  ${
                    selectedTransaction.status === "Success"
                      ? "bg-green-100 text-green-800"
                      : selectedTransaction.status === "Failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {selectedTransaction.status}
                </span>
              </div>
              {selectedTransaction.transactionHash && (
                <div className="border-b pb-4">
                  <p className="text-sm text-gray-500">Transaction Hash</p>
                  <p className="text-xs font-mono break-all">
                    {selectedTransaction.transactionHash}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
