"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Send, Search } from "lucide-react";
import { motion } from "framer-motion";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  app,
  getFirestore,
  collection,
  onSnapshot,
  doc,
  writeBatch,
  auth,
  serverTimestamp,
} from "@/app/config/FirebaseConfig";
import { useRouter } from "next/navigation";
import { abi, payWorkers } from "@/sc_stylus/scabi";
import { ethers, parseUnits } from "ethers";
import { useAccount } from "wagmi";

const formatCurrency = (amount) => {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : parseFloat(amount?.replace(/[^0-9.-]+/g, ""));

  if (isNaN(numericAmount)) {
    return "Invalid Amount";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numericAmount);
};

const MassPayrollPayment = () => {
  // State variables
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [signer, setSigner] = useState(null);

  const account = useAccount();
  const [firebaseUser, setFirebaseUser] = useState(null);
  const router = useRouter();

  // Toast helper functions
  const showErrorToast = (message) => {
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

  const showSuccessToast = (message) => {
    toast.success(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  useEffect(() => {
    async function initSigner() {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          setSigner(signer);
        } catch (error) {
          console.error("Error initializing signer:", error);
          showErrorToast("Failed to initialize wallet signer.");
        }
      } else {
        showErrorToast("Ethereum wallet not found. Please install MetaMask.");
      }
    }
    initSigner();
  }, []);

  // --- Combined Auth and Loading Effect ---
  useEffect(() => {
    let authUnsubscribe;
    let workersUnsubscribe;

    const initializeAuth = async () => {
      authUnsubscribe = auth.onAuthStateChanged(async (user) => {
        setFirebaseUser(user);
        setIsAuthReady(true);

        if (user) {
          if (!account || !account.address) {
            showErrorToast("Please connect your wallet to view worker data.");
            setIsLoading(false);
            return;
          }

          const db = getFirestore(app);
          const workersCollection = collection(
            db,
            "businesses",
            account.address,
            "workers"
          );

          workersUnsubscribe = onSnapshot(
            workersCollection,
            (snapshot) => {
              const fetchedWorkers = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }));
              setWorkers(fetchedWorkers);
              setIsLoading(false);
            },
            (error) => {
              console.error("Error fetching workers:", error);
              showErrorToast("Error fetching worker data.");
              setIsLoading(false);
            }
          );
        } else {
          router.push("/auth/login");
        }
      });
    };

    initializeAuth();

    return () => {
      if (authUnsubscribe) authUnsubscribe();
      if (workersUnsubscribe) workersUnsubscribe();
    };
  }, [account, router]);

  // --- Calculate Payment Summary Effect ---
  useEffect(() => {
    let sum = 0;
    selectedWorkers.forEach((workerId) => {
      const worker = workers.find((x) => x.id === workerId);
      if (worker && worker.worker_wallet && worker.worker_salary) {
        sum += worker.worker_salary || 0;
      }
    });
    setPaymentSummary(sum);
  }, [selectedWorkers, workers]);

  // Optimized worker selection logic using useCallback
  const updateSelectedWorkers = useCallback(() => {
    if (selectAll) {
      const allPayableWorkers = workers.map((worker) => worker.id);
      setSelectedWorkers(allPayableWorkers);
    } else {
      setSelectedWorkers([]);
    }
  }, [selectAll, workers]);

  useEffect(() => {
    updateSelectedWorkers();
  }, [selectAll, workers, updateSelectedWorkers]);

  // --- Handlers ---
  const toggleWorkerSelection = (workerId) => {
    setSelectedWorkers((prev) => {
      if (prev.includes(workerId)) {
        return prev.filter((id) => id !== workerId);
      } else {
        return [...prev, workerId];
      }
    });
  };

  // Add new function to store payroll data
  const storePayrollData = async (
    transactionHash,
    paymentData,
    totalAmount
  ) => {
    try {
      const db = getFirestore(app);
      const batch = writeBatch(db);

      const payrollId = Date.now().toString();
      const timestamp = serverTimestamp();

      // Create payroll document
      const payrollRef = doc(
        db,
        `businesses/${account.address}/payrolls/${payrollId}`
      );
      const recipients = paymentData.map((payment, index) => {
        const worker = workers.find((w) => w.worker_wallet === payment[0]);
        return {
          workerId: worker.id,
          recipientName: worker.worker_name,
          recipientEmail: worker.worker_email,
          recipientWalletAddress: payment[0],
          amount: Number(worker.worker_salary),
        };
      });

      batch.set(payrollRef, {
        payrollId,
        payrollDate: timestamp,
        transactionHash,
        totalAmount: Number(totalAmount),
        payrollToken: "USDC",
        gasFees: 0, // You may want to calculate this from the transaction
        payrollStatus: "Success",
        businessId: account.address,
        payrollPeriod: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        recipients,
        category: "Payroll",
        errorDetails: null,
      });

      // Create general history entries for each recipient
      recipients.forEach((recipient) => {
        const historyRef = doc(
          db,
          `businesses/${account.address}/payments/${payrollId}`
        );
        batch.set(historyRef, {
          amount: recipient.amount,
          payrollId,
          transactionid: `${payrollId}`,
          timestamp: timestamp,
          category: "Payroll",
          status: "Success",
          transactionHash,
        });
      });

      await batch.commit();
    } catch (error) {
      console.error("Error storing payment records:", error);
      showErrorToast("Failed to store payment records");
    }
  };

  // Modify handlePayAll to include null checks
  const handlePayAll = async () => {
    if (!firebaseUser || !account?.address || !signer) {
      showErrorToast("Authentication and wallet connection required.");
      return;
    }

    setIsProcessing(true);

    try {
      let totalAmount = 0;
      const paymentData = workers
        .filter((worker) => selectedWorkers.includes(worker.id))
        .filter(
          (worker) => worker && worker.worker_wallet && worker.worker_salary
        )
        .map((worker) => {
          totalAmount += worker.worker_salary || 0;
          return [
            worker.worker_wallet,
            parseUnits(worker.worker_salary.toString(), 6),
          ];
        });

      if (paymentData.length === 0) {
        showErrorToast("No valid workers selected for payment");
        setIsProcessing(false);
        return;
      }

      const subtotalamount = totalAmount;
      totalAmount = parseUnits(totalAmount.toString(), 6);
      const contract = new ethers.Contract(payWorkers, abi, signer);

      const tx = await contract.payWorkers(paymentData, totalAmount);
      const receipt = await tx.wait();

      // Store the payment data in Firebase
      await storePayrollData(receipt.hash, paymentData, subtotalamount);

      showSuccessToast("Mass payment successful!");
    } catch (error) {
      console.error("Error processing mass payment:", error);
      showErrorToast("Failed to process mass payment.");
    } finally {
      setIsProcessing(false);
      setSelectedWorkers([]);
      setSelectAll(false);
    }
  };

  const anySelected = selectedWorkers.length > 0;
  const allPaid = workers.every((worker) => worker.status === "paid");

  const areAllDisplayedWorkersSelected = () => {
    const displayedWorkerIds = workers
      .filter(
        (worker) =>
          worker &&
          (worker.worker_name
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
            worker.worker_email
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()))
      )
      .map((w) => w.id);
    return (
      displayedWorkerIds.every((id) => selectedWorkers.includes(id)) &&
      displayedWorkerIds.length > 0
    );
  };

  return (
    <motion.div
      className="container mx-auto p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {!isAuthReady ? (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <>
          <ToastContainer position="top-right" autoClose={3000} />
          <h1 className="text-3xl font-semibold text-gray-800 mb-4">
            Pay Workers
          </h1>
          <p className="text-gray-500 mb-6">
            Select workers and initiate a single payment to all selected.
          </p>
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search workers"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="mt-3 md:mt-0 ">
              {paymentSummary != null ? (
                isProcessing ? (
                  <button
                    className="bg-gray-500 text-white rounded-lg py-3 px-6 flex items-center justify-center"
                    disabled
                  >
                    <Loader2 size={20} className="mr-2 animate-spin" />{" "}
                    Processing...
                  </button>
                ) : (
                  <button
                    onClick={handlePayAll}
                    disabled={!anySelected || allPaid || isLoading}
                    className={`bg-black text-white rounded-lg py-3 px-6 flex items-center justify-center ${
                      !anySelected || allPaid || isLoading
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-gray-900 transition-colors"
                    }`}
                  >
                    <Send size={20} className="mr-2" /> Pay Selected:{" "}
                    {formatCurrency(paymentSummary)}
                  </button>
                )
              ) : (
                <button
                  className="bg-white text-gray-600 rounded-lg py-3 px-6 flex items-center justify-center"
                  disabled
                >
                  Select workers and pay the bill
                </button>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            {isLoading ? (
              <div className="p-6">Loading workers...</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        disabled={allPaid}
                        className="rounded text-gray-500 focus:ring-gray-500 h-5 w-5"
                        checked={areAllDisplayedWorkersSelected()}
                        onChange={() => setSelectAll(!selectAll)}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wallet Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Salary (USDC)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workers
                    .filter(
                      (worker) =>
                        worker &&
                        worker.worker_wallet &&
                        (worker.worker_name
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                          worker.worker_email
                            ?.toLowerCase()
                            .includes(searchQuery.toLowerCase()))
                    )
                    .map((worker) => (
                      <tr key={worker.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            disabled={worker.status === "paid"}
                            className="rounded text-gray-500 focus:ring-gray-500 h-5 w-5"
                            checked={selectedWorkers.includes(worker.id)}
                            onChange={() => toggleWorkerSelection(worker.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {worker.worker_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {worker.worker_email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {worker.worker_wallet}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatCurrency(worker.worker_salary)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default MassPayrollPayment;
