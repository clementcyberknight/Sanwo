"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Send, Search, XCircle } from "lucide-react";
import { motion } from "framer-motion"; 
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  app,
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  auth,
} from "@/app/config/FirebaseConfig";
import { useRouter } from "next/navigation";
import EmployerPool from "../../../sc_/EmployeePoolAbi.json";
import { EmployerPoolContractAddress, linea_scan } from "../../../sc_/utils";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import {
  parseUnits,
  formatUnits,
  TransactionExecutionError,
  Address,
  UserRejectedRequestError,
} from "viem";
import { lineaSepolia } from "viem/chains";
import { User } from "firebase/auth";

interface Worker {
  id: string;
  worker_name?: string;
  worker_email?: string;
  worker_wallet?: string;
  worker_salary?: number | string;
}

interface PayrollRecipientData {
  workerId: string;
  recipientName: string;
  recipientEmail: string;
  recipientWalletAddress: Address;
  amount: number;
}

interface PayrollData {
  payrollId: string;
  payrollDate: any;
  transactionHash: string | null;
  totalAmount: number;
  payrollToken: string;
  gasFeesEstimate: number; 
  payrollStatus: "Pending" | "Success" | "Failed";
  businessId: Address;
  payrollPeriod: string;
  recipients: PayrollRecipientData[];
  category: string;
  errorDetails: string | null;
  createdAt: any;
  updatedAt: any;
}

const formatCurrency = (amount: number | string | undefined | null): string => {
  if (amount === undefined || amount === null) return "N/A";
  const numericAmount =
    typeof amount === "number"
      ? amount
      : parseFloat(String(amount).replace(/[^0-9.-]+/g, ""));
  if (isNaN(numericAmount)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numericAmount);
};

const MIN_GAS_LIMIT = 210000;
const MAX_GAS_LIMIT = 700000;
const BASE_GAS_PER_PAYROLL = 100000; 
const GAS_PER_WORKER = 45000; 

const MassPayrollPayment = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatusMessage, setTxStatusMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [pendingPayrollDocId, setPendingPayrollDocId] = useState<string | null>(
    null
  );

  const account = useAccount();
  const businessAddress = account?.address;
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const router = useRouter();
  const publicClient = usePublicClient({ chainId: lineaSepolia.id });

  const {
    writeContract: executePayWorkers,
    isSuccess: payWorkersSuccess,
    isPending: payWorkersLoading,
    isError: payWorkersError,
    error: payWorkersWriteError,
    reset: resetPayWorkers,
    data: payWorkersTxHash,
  } = useWriteContract();

  const showErrorToast = useCallback((message: string) => {
    toast.error(message, { theme: "colored" });
  }, []);

  const showSuccessToast = useCallback((message: string) => {
    toast.success(message, { theme: "colored" });
  }, []);

  useEffect(() => {
    setIsLoadingWorkers(true);
    const authUnsubscribe = auth.onAuthStateChanged((user: User | null) => {
      setFirebaseUser(user);
      setIsAuthReady(true);

      if (user) {
        if (!businessAddress) {
          console.warn("Wallet not connected yet.");
          setTxStatusMessage("Please connect your wallet.");
          setIsLoadingWorkers(false);
          setWorkers([]);
          return;
        }

        setTxStatusMessage("Fetching worker data...");
        const db = getFirestore(app);
        const workersCollection = collection(
          db, "businesses", businessAddress, "workers"
        );

        const workersUnsubscribe = onSnapshot(
          workersCollection,
          (snapshot) => {
            const fetchedWorkers = snapshot.docs.map(
              (doc) => ({ id: doc.id, ...doc.data() } as Worker)
            );
            setWorkers(fetchedWorkers);
            setIsLoadingWorkers(false);
            setTxStatusMessage("");
          },
          (error) => {
            console.error("Error fetching workers:", error);
            setTxStatusMessage("Error fetching worker data.");
            showErrorToast("Error fetching worker data.");
            setIsLoadingWorkers(false);
          }
        );
        return () => workersUnsubscribe();
      } else {
        setIsLoadingWorkers(false);
        setWorkers([]);
        setTxStatusMessage("User not authenticated. Redirecting...");
        const timer = setTimeout(() => router.push("/auth/login"), 1500);
        return () => clearTimeout(timer);
      }
    });
    return () => authUnsubscribe();
  }, [businessAddress, router, showErrorToast]);

  const paymentSummary = useMemo(() => {
    return selectedWorkers.reduce((sum, workerId) => {
      const worker = workers.find((w) => w.id === workerId);
      if (worker?.worker_wallet && worker.worker_salary) {
        const salaryNum = Number(worker.worker_salary);
        if (!isNaN(salaryNum) && salaryNum > 0) {
          return sum + salaryNum;
        }
      }
      return sum;
    }, 0);
  }, [selectedWorkers, workers]);

  const isValidWorkerForPayment = useCallback((worker: Worker | undefined): boolean => {
      return !!worker &&
             !!worker.worker_wallet &&
             !!worker.worker_salary &&
             !isNaN(Number(worker.worker_salary)) &&
             Number(worker.worker_salary) > 0 &&
             /^0x[a-fA-F0-9]{40}$/.test(worker.worker_wallet);
  }, []);

  const toggleWorkerSelection = useCallback(
    (workerId: string) => {
      setSelectedWorkers((prev) => {
        const worker = workers.find((w) => w.id === workerId);
        if (prev.includes(workerId)) {
          return prev.filter((id) => id !== workerId);
        } else if (isValidWorkerForPayment(worker)) {
           return [...prev, workerId];
        } else {
          let reason = "missing required info";
          if (!worker?.worker_wallet || !/^0x[a-fA-F0-9]{40}$/.test(worker?.worker_wallet || '')) reason = "invalid/missing wallet";
          else if (!worker?.worker_salary || isNaN(Number(worker.worker_salary)) || Number(worker.worker_salary) <= 0) reason = "invalid/missing salary (> 0)";
          showErrorToast(`Cannot select worker ${worker?.worker_name || workerId}: ${reason}.`);
          return prev;
        }
      });
      if (selectedWorkers.includes(workerId)) {
        setSelectAll(false);
      }
    },
    [workers, showErrorToast, selectedWorkers, isValidWorkerForPayment]
  );

  const getFilteredValidWorkerIds = useCallback(() => {
    return workers
      .filter(w => isValidWorkerForPayment(w) &&
                  (w.worker_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   w.worker_email?.toLowerCase().includes(searchQuery.toLowerCase())))
      .map(w => w.id);
  }, [workers, searchQuery, isValidWorkerForPayment]);


  const handleSelectAll = useCallback(() => {
    const newSelectAllState = !selectAll;
    setSelectAll(newSelectAllState);

    if (newSelectAllState) {
        setSelectedWorkers(getFilteredValidWorkerIds());
    } else {
       setSelectedWorkers([]); 
    }
  }, [selectAll, getFilteredValidWorkerIds]);

  const areAllDisplayedWorkersSelected = useMemo(() => {
    const displayedValidIds = getFilteredValidWorkerIds();
    if (displayedValidIds.length === 0) return false;
    return displayedValidIds.every((id) => selectedWorkers.includes(id));
  }, [selectedWorkers, getFilteredValidWorkerIds]);

  const createPendingPayrollRecord = useCallback(
    async (
      paymentRecipients: [Address, bigint][],
      totalAmountNumber: number,
      workerDetailsMap: Map<Address, Worker>,
      calculatedGas: number 
    ): Promise<string> => {
      if (!businessAddress) {
        throw new Error("Business address not found.");
      }

      const db = getFirestore(app);
      const payrollId = `payroll_${Date.now()}_${businessAddress.slice(-4)}`;
      const timestamp = serverTimestamp();

      const recipientsForStorage: PayrollRecipientData[] = paymentRecipients.map(
        ([address, amountViem]) => {
          const workerDetail = workerDetailsMap.get(address);
          const amountFloat = parseFloat(formatUnits(amountViem, 6));
          return {
            workerId: workerDetail?.id || "Unknown",
            recipientName: workerDetail?.worker_name || "Unknown",
            recipientEmail: workerDetail?.worker_email || "Unknown",
            recipientWalletAddress: address,
            amount: isNaN(amountFloat) ? 0 : amountFloat,
          };
        }
      );

      const payrollData: PayrollData = {
        payrollId,
        payrollDate: timestamp,
        transactionHash: null,
        totalAmount: totalAmountNumber,
        payrollToken: "USDC",
        gasFeesEstimate: calculatedGas,
        payrollStatus: "Pending",
        businessId: businessAddress,
        payrollPeriod: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        recipients: recipientsForStorage,
        category: "Payroll",
        errorDetails: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        const payrollRef = doc(db, `businesses/${businessAddress}/payrolls/${payrollId}`);
        await setDoc(payrollRef, payrollData);
        console.log(`Pending payroll record ${payrollId} created.`);
        return payrollId;
      } catch (firestoreError: unknown) {
        console.error("Error storing PENDING payroll record:", firestoreError);
        const message = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
        throw new Error(`Failed to store pending payroll record: ${message}`);
      }
    },
    [businessAddress]
  );

  const updatePayrollRecord = useCallback(
    async (
      payrollDocId: string,
      status: "Success" | "Failed" | "Cancelled",
      txHash: string | null,
      error?: string
    ) => {
      if (!businessAddress || !payrollDocId) {
        console.error("Missing required info for payroll update.");
        showErrorToast("DB record update failed (missing info).");
        return;
      }
      const db = getFirestore(app);
      const payrollRef = doc(db, `businesses/${businessAddress}/payrolls/${payrollDocId}`);
      const timestamp = serverTimestamp();

      const finalStatus = status === "Cancelled" ? "Failed" : status;
      const finalError = status === "Cancelled" ? error || "User cancelled" : error;

      const updateData: Partial<PayrollData> = {
        payrollStatus: finalStatus,
        transactionHash: txHash ?? null,
        errorDetails: finalError || null,
        updatedAt: timestamp,
      };

      try {
        console.log(`Updating payroll ${payrollDocId} to ${finalStatus}`);
        await updateDoc(payrollRef, updateData);
      } catch (firestoreError: unknown) {
        console.error(`Error updating payroll record ${payrollDocId} to ${finalStatus}:`, firestoreError);
        const message = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
        setTxStatusMessage(`Payroll ${status}, but DB update failed: ${message}`);
        showErrorToast(`DB Update Failed for ${payrollDocId}.`);
      }
    },
    [businessAddress, showErrorToast, setTxStatusMessage]
  );

  const handleInitiatePayment = async () => {
    if (!businessAddress || !firebaseUser) {
      showErrorToast("Login and connect wallet.");
      return;
    }
    if (selectedWorkers.length === 0) {
      showErrorToast("Select workers to pay.");
      return;
    }

    setTxStatusMessage("Preparing payroll...");
    setIsProcessing(true);
    setPendingPayrollDocId(null);
    resetPayWorkers();

    const preparedPayments: [Address, bigint][] = [];
    //@ts-ignore
    let totalAmountBigInt: bigint = 0n;
    let totalAmountNumberForRecord: number = 0;
    const workerDetailsMap = new Map<Address, Worker>();

    try {
      for (const workerId of selectedWorkers) {
        const worker = workers.find((w) => w.id === workerId);
        if (!isValidWorkerForPayment(worker)) {
            console.warn(`Skipping invalid worker: ${worker?.worker_name || workerId}`);
            continue;
        }
        const workerAddress = worker!.worker_wallet! as Address;
        const salaryStr = String(worker!.worker_salary!);
        const salaryNum = Number(salaryStr);

        const amountParsed = parseUnits(salaryStr, 6);
        preparedPayments.push([workerAddress, amountParsed]);
        totalAmountBigInt += amountParsed;
        totalAmountNumberForRecord += salaryNum;
        workerDetailsMap.set(workerAddress, worker!);
      }

      if (preparedPayments.length === 0) {
        throw new Error("No valid workers were selected for payment.");
      }

     
      const estimatedGas = BASE_GAS_PER_PAYROLL + (preparedPayments.length * GAS_PER_WORKER);
      const finalGasLimit = Math.max(MIN_GAS_LIMIT, Math.min(estimatedGas, MAX_GAS_LIMIT));
      console.log(`Calculated Gas Limit: ${finalGasLimit} (Estimate: ${estimatedGas}, Workers: ${preparedPayments.length})`);

      setTxStatusMessage("Creating pending payroll record...");
      const newPayrollDocId = await createPendingPayrollRecord(
        preparedPayments,
        totalAmountNumberForRecord,
        workerDetailsMap,
        finalGasLimit 
      );
      setPendingPayrollDocId(newPayrollDocId);
        //skeptical on this gas
      setTxStatusMessage("Please approve transaction...");
      executePayWorkers({
        address: EmployerPoolContractAddress as Address,
        abi: EmployerPool,
        functionName: "payWorkers",
        args: [preparedPayments, totalAmountBigInt],
        chainId: lineaSepolia.id,
        gas: BigInt(finalGasLimit),
       // gas: BigInt(700000),
        // Use the calculated and clamped gas limit
      });
    } catch (error: unknown) {
      console.error("Error initiating payment:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      const displayMsg = `Error: ${errorMsg.substring(0,100)}${errorMsg.length > 100 ? '...':''}`;
      setTxStatusMessage(displayMsg);
      showErrorToast(`Initiation Failed: ${errorMsg}`);

      if (pendingPayrollDocId) {
        try {
          await updatePayrollRecord(pendingPayrollDocId, "Failed", null, `Initiation Error: ${errorMsg}`);
        } catch (updateError) {
          console.error("Also failed to mark pending record as Failed:", updateError);
        }
      }
      setIsProcessing(false);
      setPendingPayrollDocId(null);
      resetPayWorkers();
    }
  };

  // Effect for successful transaction
  useEffect(() => {
    if (payWorkersSuccess && payWorkersTxHash && pendingPayrollDocId) {
      console.log("Payroll Tx Success:", payWorkersTxHash);
      setTxStatusMessage(`Payroll Submitted! Tx: ${payWorkersTxHash.substring(0,10)}...`);
      showSuccessToast("Payroll processed successfully!");

      updatePayrollRecord(pendingPayrollDocId, "Success", payWorkersTxHash).finally(() => {
          setSelectedWorkers([]);
          setSelectAll(false);
          setPendingPayrollDocId(null);
          setIsProcessing(false);
          // Optionally reset message after delay
          const timer = setTimeout(() => setTxStatusMessage(""), 5000);
          return () => clearTimeout(timer);
      });
    }
  }, [payWorkersSuccess, payWorkersTxHash, pendingPayrollDocId, updatePayrollRecord, showSuccessToast]);

  // Effect for failed transaction
  useEffect(() => {
     if (payWorkersError && payWorkersWriteError) { // Check error *object* exists
        const isCancelled = payWorkersWriteError instanceof UserRejectedRequestError || (payWorkersWriteError.message?.includes('rejected'));
        const status = isCancelled ? "Cancelled" : "Failed";
        let errorMsg = isCancelled ? "User rejected transaction" : "Payroll transaction failed.";

        if (!isCancelled) { // Get more detail if it wasn't just cancelled
             if (payWorkersWriteError instanceof TransactionExecutionError) {
                errorMsg = payWorkersWriteError.shortMessage || payWorkersWriteError.message;
             } else if (payWorkersWriteError instanceof Error) {
                 errorMsg = payWorkersWriteError.message;
             }
        }
        const displayMsg = errorMsg.length > 150 ? errorMsg.substring(0, 147) + "..." : errorMsg;

        console.error(`PayWorkers Tx ${status}:`, payWorkersWriteError);
        setTxStatusMessage(`Error: ${displayMsg}`);
        showErrorToast(`Transaction Failed: ${displayMsg}`);

        // Update DB record if it exists, otherwise just reset state
        if (pendingPayrollDocId) {
             updatePayrollRecord(pendingPayrollDocId, status, payWorkersTxHash ?? null, errorMsg)
                .finally(() => {
                    setIsProcessing(false);
                    setPendingPayrollDocId(null); // Clear ID even on failure
                    resetPayWorkers();
                 });
        } else {
            // Error occurred before DB record ID was set
            setIsProcessing(false);
            resetPayWorkers();
        }
     }
  }, [payWorkersError, payWorkersWriteError, pendingPayrollDocId, payWorkersTxHash, updatePayrollRecord, showErrorToast, resetPayWorkers]);

 const canInitiatePayment =
    !isProcessing &&
    !payWorkersLoading &&
    selectedWorkers.length > 0 &&
    !isLoadingWorkers &&
    isAuthReady &&
    !!businessAddress &&
    paymentSummary > 0;

  return (
    <motion.div
      className="container mx-auto p-4 md:p-6 bg-gray-50 min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <ToastContainer position="top-right" autoClose={4000} theme="colored" />

      {/* Auth/Loading Checks */}
      {!isAuthReady ? (
        <div className="flex items-center justify-center pt-20"><Loader2 className="w-12 h-12 animate-spin text-blue-600 mr-3" /><p>Initializing...</p></div>
      ) : !firebaseUser ? (
        <div className="flex items-center justify-center pt-20 text-center text-red-600"><XCircle className="w-12 h-12 mr-3" /><p>{txStatusMessage || "Auth required."}</p></div>
      ) : !businessAddress ? (
         <div className="flex items-center justify-center pt-20 text-center text-yellow-600"><XCircle className="w-12 h-12 mr-3" /><p>{txStatusMessage || "Connect wallet."}</p></div>
      ) : (
        // Main Content
        <>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Mass Payroll Payment
          </h1>
          <p className="text-gray-600 mb-6">
            Select workers to pay with USDC via the Employer Pool contract.
          </p>

          {/* Control Bar - Gas Input REMOVED */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-5 gap-4 p-4 bg-white rounded-lg shadow">
            {/* Search Input */}
            <div className="relative flex-grow w-full md:w-1/2 lg:w-1/3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search name/email..."
                value={searchQuery}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:bg-gray-100"
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isProcessing || payWorkersLoading || isLoadingWorkers}
              />
            </div>

            {/* REMOVED GAS INPUT FIELD */}

            {/* Action Button - Adjusted width/spacing */}
            <div className="w-full md:w-auto flex justify-end mt-4 md:mt-0">
              <button
                onClick={handleInitiatePayment}
                disabled={!canInitiatePayment}
                className={`bg-blue-600 text-white rounded-lg py-2.5 px-5 flex items-center justify-center font-semibold shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                            ${!canInitiatePayment ? "opacity-50 cursor-not-allowed bg-gray-400" : "hover:bg-blue-700 active:bg-blue-800"}`}
              >
                {isProcessing || payWorkersLoading ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    {payWorkersLoading ? txStatusMessage || "Processing..." : txStatusMessage || "Preparing..."}
                  </>
                ) : (
                  <>
                    <Send size={18} className="mr-2" />
                    Pay {selectedWorkers.length} ({formatCurrency(paymentSummary)})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status Message Area */}
          {txStatusMessage && !payWorkersLoading && (
            <div
              className={`my-4 p-3 rounded-md text-sm border ${
                payWorkersError ? "bg-red-100 text-red-800 border-red-300" :
                payWorkersSuccess ? "bg-green-100 text-green-800 border-green-300" :
                "bg-yellow-100 text-yellow-800 border-yellow-300"
              }`}
            >
              {txStatusMessage}
              {payWorkersTxHash && payWorkersSuccess && ( // Show link only on actual success
                <a
                  href={`${linea_scan}/tx/${payWorkersTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 font-medium underline hover:text-inherit"
                >
                  View Tx
                </a>
              )}
            </div>
          )}

          {/* Worker Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            {isLoadingWorkers ? (
                <div className="p-6 text-center"><Loader2 className="inline w-5 h-5 mr-2 animate-spin" />Loading workers...</div>
            ) : workers.length === 0 && !isLoadingWorkers ? ( // Ensure not loading before showing no workers
                <div className="p-6 text-center text-gray-500">No workers found or connect wallet.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50"
                        checked={areAllDisplayedWorkersSelected}
                         ref={(el) => { // Indeterminate logic
                           if (el) {
                               const displayedValidIds = getFilteredValidWorkerIds();
                               const selectedDisplayedCount = displayedValidIds.filter(id => selectedWorkers.includes(id)).length;
                               el.indeterminate = selectedDisplayedCount > 0 && selectedDisplayedCount < displayedValidIds.length;
                           }
                         }}
                        onChange={handleSelectAll}
                        disabled={ isLoadingWorkers || isProcessing || payWorkersLoading || getFilteredValidWorkerIds().length === 0 }
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Wallet Address</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider pr-4"> Salary (USDC)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const filteredWorkers = workers.filter(worker =>
                        (worker.worker_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         worker.worker_email?.toLowerCase().includes(searchQuery.toLowerCase()))
                    );

                    if (filteredWorkers.length === 0 && !isLoadingWorkers) {
                      return (<tr><td colSpan={5} className="text-center py-4 px-4 text-gray-500">{searchQuery ? "No matches found." : "No workers loaded."}</td></tr>);
                    }

                    return filteredWorkers.map((worker) => {
                      const isSelected = selectedWorkers.includes(worker.id);
                      const isValid = isValidWorkerForPayment(worker);
                      return (
                        <tr key={worker.id} className={`${isSelected ? "bg-blue-50" : "hover:bg-gray-50"} ${!isValid ? "opacity-50 cursor-default" : ""} transition-colors`} >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                              checked={isSelected}
                              onChange={() => toggleWorkerSelection(worker.id)}
                              disabled={!isValid || isProcessing || payWorkersLoading}
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">
                            {worker.worker_name || <span className="text-gray-400 italic">N/A</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                             {worker.worker_email || <span className="text-gray-400 italic">N/A</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono text-xs" title={worker.worker_wallet}>
                            {worker.worker_wallet ? (`${worker.worker_wallet.substring(0, 6)}...${worker.worker_wallet.substring(worker.worker_wallet.length - 4)}`) : (<span className="text-red-500">Missing</span>)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium text-right pr-4">
                            {isValid ? formatCurrency(worker.worker_salary) : (<span className="text-red-500 text-xs">Invalid</span>)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
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