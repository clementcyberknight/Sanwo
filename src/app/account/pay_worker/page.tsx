"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Send, Search, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  app,
  getFirestore,
  collection,
  onSnapshot,
  doc,
  writeBatch,
  setDoc,
  updateDoc,
  serverTimestamp,
  auth,
} from "@/app/config/FirebaseConfig";
import { useRouter } from "next/navigation";
import EmployerPool from "../../../sc_/EmployeePoolAbi.json";
import {
  EmployerPoolContractAddress,
  linea_scan
} from "../../../sc_/utils";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits, formatUnits, TransactionExecutionError } from 'viem';
import { lineaSepolia } from 'viem/chains';

const formatCurrency = (amount) => {
    const numericAmount =
      typeof amount === "number"
        ? amount
        : parseFloat(String(amount)?.replace(/[^0-9.-]+/g, ""));

    if (isNaN(numericAmount)) {
      return "N/A";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(numericAmount);
};


const MassPayrollPayment = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatusMessage, setTxStatusMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [gasLimitInput, setGasLimitInput] = useState<string>("400000");
  const [pendingPayrollDocId, setPendingPayrollDocId] = useState<string | null>(null);

  const account = useAccount();
  const businessAddress = account?.address;
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
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

  const showErrorToast = useCallback((message) => {
    toast.error(message, { /* options */ });
  }, []);

  const showSuccessToast = useCallback((message) => {
    toast.success(message, { /* options */ });
  }, []);

   useEffect(() => {
    setIsLoadingWorkers(true);
    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);

      if (user) {
        if (!businessAddress) {
          setTxStatusMessage("Please connect your wallet.");
          setIsLoadingWorkers(false);
          return;
        }

        const db = getFirestore(app);
        const workersCollection = collection(
          db,
          "businesses",
          businessAddress,
          "workers"
        );

        const workersUnsubscribe = onSnapshot(
          workersCollection,
          (snapshot) => {
            const fetchedWorkers = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
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
         setTxStatusMessage("User not authenticated. Redirecting to login...");
        router.push("/auth/login");
      }
    });

    return () => authUnsubscribe();
  }, [businessAddress, router, showErrorToast]);


   const paymentSummary = React.useMemo(() => {
     return selectedWorkers.reduce((sum, workerId) => {
       const worker = workers.find((w) => w.id === workerId);
       if (worker && worker.worker_wallet && worker.worker_salary && !isNaN(Number(worker.worker_salary))) {
         return sum + Number(worker.worker_salary);
       }
       return sum;
     }, 0);
   }, [selectedWorkers, workers]);


   const toggleWorkerSelection = useCallback((workerId: string) => {
        setSelectedWorkers((prev) => {
            if (prev.includes(workerId)) {
                return prev.filter((id) => id !== workerId);
            } else {
                const worker = workers.find(w => w.id === workerId);
                if (worker && worker.worker_wallet && worker.worker_salary) {
                   return [...prev, workerId];
                }
                showErrorToast(`Worker ${worker?.worker_name || workerId} missing wallet or salary info.`);
                return prev;
            }
        });
        setSelectAll(false);
    }, [workers, showErrorToast]);


   const handleSelectAll = useCallback(() => {
       const newSelectAllState = !selectAll;
       setSelectAll(newSelectAllState);
       if (newSelectAllState) {
           const validDisplayedWorkerIds = workers
                .filter(worker =>
                    worker && worker.worker_wallet && worker.worker_salary && !isNaN(Number(worker.worker_salary)) &&
                    (worker.worker_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                     worker.worker_email?.toLowerCase().includes(searchQuery.toLowerCase()))
                 )
                .map((worker) => worker.id);
            setSelectedWorkers(validDisplayedWorkerIds);
        } else {
            setSelectedWorkers([]);
        }
    }, [selectAll, workers, searchQuery]);

  const areAllDisplayedWorkersSelected = React.useMemo(() => {
      const validDisplayedWorkerIds = workers
        .filter(worker =>
          worker && worker.worker_wallet && worker.worker_salary && !isNaN(Number(worker.worker_salary)) &&
          (worker.worker_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           worker.worker_email?.toLowerCase().includes(searchQuery.toLowerCase()))
         )
        .map(w => w.id);
      if (validDisplayedWorkerIds.length === 0) return false;
      return validDisplayedWorkerIds.every((id) => selectedWorkers.includes(id));
  }, [workers, selectedWorkers, searchQuery]);

   const createPendingPayrollRecord = useCallback(async (paymentRecipients: any[], totalAmount: number, workerDetailsMap: Map<string, any>) => {
    if (!businessAddress) {
        throw new Error("Business address not found.");
    }

    const db = getFirestore(app);
    const payrollId = `payroll_${Date.now()}_${businessAddress.slice(-4)}`;
    const timestamp = serverTimestamp();

    const recipientsForStorage = paymentRecipients.map(([address, amountViem]) => {
        const workerDetail = workerDetailsMap.get(address);
        const amountFloat = parseFloat(formatUnits(amountViem, 6));

        return {
          workerId: workerDetail?.id || "Unknown ID",
          recipientName: workerDetail?.worker_name || "Unknown Name",
          recipientEmail: workerDetail?.worker_email || "Unknown Email",
          recipientWalletAddress: address,
          amount: amountFloat || 0,
        };
    });

    const payrollData = {
        payrollId,
        payrollDate: timestamp,
        transactionHash: null,
        totalAmount: Number(totalAmount) || 0,
        payrollToken: "USDC",
        gasFeesEstimate: Number(gasLimitInput) || 0,
        payrollStatus: "Pending",
        businessId: businessAddress,
        payrollPeriod: new Date().toLocaleDateString("en-US", { month: 'long', year: 'numeric' }),
        recipients: recipientsForStorage,
        category: "Payroll",
        errorDetails: null,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    try {
        console.log(`Creating pending payroll record ${payrollId} in Firestore...`, payrollData);
        const payrollRef = doc(db, `businesses/${businessAddress}/payrolls/${payrollId}`);
        await setDoc(payrollRef, payrollData);
        console.log(`Pending payroll record ${payrollId} created.`);
        return payrollId;
    } catch (firestoreError: any) {
        console.error("Error storing PENDING payroll record:", firestoreError);
        throw new Error(`Failed to store pending payroll record: ${firestoreError.message}`);
    }

}, [businessAddress, gasLimitInput]);


 const updatePayrollRecord = useCallback(async (
    payrollDocId: string,
    status: "Success" | "Failed",
    txHash: string | null,
    error?: string,
    gasUsed?: BigInt
 ) => {
    if (!businessAddress || !payrollDocId) {
        console.error("Missing business address or payroll doc ID for update");
        return;
    }

    const db = getFirestore(app);
    const payrollRef = doc(db, `businesses/${businessAddress}/payrolls/${payrollDocId}`);
    const timestamp = serverTimestamp();

    const updateData: any = {
        payrollStatus: status,
        transactionHash: txHash ?? null,
        errorDetails: error || null,
        updatedAt: timestamp,
    };

    try {
        console.log(`Updating payroll record ${payrollDocId} to status: ${status}`, updateData);
        await updateDoc(payrollRef, updateData);
        console.log(`Payroll record ${payrollDocId} updated successfully.`);

    } catch (firestoreError: any) {
        console.error(`Error updating payroll record ${payrollDocId} to ${status}:`, firestoreError);
        setTxStatusMessage(`Payroll ${status}, but failed to update database record.`);
    }
 }, [businessAddress]);


 const handleInitiatePayment = async () => {
    if (!businessAddress || !firebaseUser) {
      setTxStatusMessage("Authentication or wallet connection is missing.");
      showErrorToast("Please ensure you are logged in and your wallet is connected.");
      return;
    }
    if (selectedWorkers.length === 0) {
      setTxStatusMessage("No workers selected for payment.");
      showErrorToast("Please select at least one worker to pay.");
      return;
    }
     const gasLimitNum = Number(gasLimitInput);
    if (isNaN(gasLimitNum) || gasLimitNum <= 21000) {
        setTxStatusMessage("Invalid Gas Limit. Please enter a valid number (e.g., 400000).");
        showErrorToast("Invalid Gas Limit.");
        return;
    }

    setTxStatusMessage("Preparing payroll...");
    setIsProcessing(true);
    setPendingPayrollDocId(null);
    resetPayWorkers();

    let preparedRecipients: string[] = [];
    let preparedAmounts: bigint[] = [];
    let currentTotalAmount = 0;
    const workerDetailsMap = new Map<string, any>();


    try {
        workers
            .filter((worker) => selectedWorkers.includes(worker.id))
            .forEach((worker) => {
                if (!worker.worker_wallet || typeof worker.worker_wallet !== 'string' || !worker.worker_wallet.startsWith('0x') || worker.worker_wallet.length !== 42) {
                    throw new Error(`Worker ${worker.worker_name || worker.id} has an invalid wallet address.`);
                 }
                const salary = Number(worker.worker_salary);
                 if (isNaN(salary) || salary <= 0) {
                     throw new Error(`Worker ${worker.worker_name || worker.id} has an invalid salary.`);
                 }

                const amountParsed = parseUnits(salary.toString(), 6);

                preparedRecipients.push(worker.worker_wallet as `0x${string}`);
                preparedAmounts.push(amountParsed);
                currentTotalAmount += salary;
                workerDetailsMap.set(worker.worker_wallet, worker);
            });

         if (preparedRecipients.length === 0) {
            throw new Error("No valid workers found after filtering for payment.");
         }

         setTxStatusMessage("Creating pending payroll record...");
        const newPayrollDocId = await createPendingPayrollRecord(
             preparedRecipients.map((addr, index) => [addr, preparedAmounts[index]]),
             currentTotalAmount,
             workerDetailsMap
         );
        setPendingPayrollDocId(newPayrollDocId);

         setTxStatusMessage("Please approve the transaction in your wallet...");
         console.log("Executing PayWorkers transaction with args:", preparedRecipients, preparedAmounts);

         executePayWorkers({
             address: EmployerPoolContractAddress as `0x${string}`,
             abi: EmployerPool,
             functionName: 'payWorkers',
             args: [preparedRecipients, preparedAmounts],
             chainId: lineaSepolia.id,
             gas: BigInt(gasLimitNum),
         });

    } catch (error: any) {
        console.error("Error during payment initiation:", error);
        const errorMsg = error.message || "An unexpected error occurred during preparation.";
        setTxStatusMessage(`Error: ${errorMsg}`);
        showErrorToast(`Initiation Failed: ${errorMsg}`);

        if (pendingPayrollDocId) {
            await updatePayrollRecord(pendingPayrollDocId, "Failed", null, `Initiation Failed: ${errorMsg}`);
        }
        setIsProcessing(false);
        setPendingPayrollDocId(null);
        resetPayWorkers();
    }
 };

  useEffect(() => {
    if (payWorkersSuccess && payWorkersTxHash && pendingPayrollDocId) {
      console.log("PayWorkers Transaction Successful! Hash:", payWorkersTxHash);
      setTxStatusMessage("Payroll Submitted Successfully!");
      showSuccessToast("Payroll processed successfully!");

      updatePayrollRecord(
         pendingPayrollDocId,
         "Success",
         payWorkersTxHash,
         undefined
      ).then(() => {
         setSelectedWorkers([]);
         setSelectAll(false);
         setPendingPayrollDocId(null);
         setTimeout(() => {
             setIsProcessing(false);
             setTxStatusMessage("");
         }, 2000);
       }).catch((dbError) => {
         console.error("DB Update failed after successful TX:", dbError);
         setTxStatusMessage("Payroll successful on-chain, but failed to update database record.");
         setIsProcessing(false);
       });
    }
 }, [payWorkersSuccess, payWorkersTxHash, pendingPayrollDocId, updatePayrollRecord, showSuccessToast]);

 useEffect(() => {
     if (payWorkersError && pendingPayrollDocId) {
         const rawError = payWorkersWriteError as any;
         let errorMsg = "Payroll transaction failed.";
         if (rawError instanceof TransactionExecutionError) {
              errorMsg = rawError.shortMessage || rawError.details || errorMsg;
         } else if (rawError instanceof Error) {
             errorMsg = rawError.message;
         }
         errorMsg = errorMsg.length > 150 ? errorMsg.substring(0, 147) + "..." : errorMsg;

         console.error("PayWorkers Transaction Failed:", payWorkersWriteError);
         setTxStatusMessage(`Error: ${errorMsg}`);
         showErrorToast(`Transaction Failed: ${errorMsg}`);

         updatePayrollRecord(
             pendingPayrollDocId,
             "Failed",
             payWorkersTxHash ?? null,
             errorMsg
         );

         setIsProcessing(false);
         setPendingPayrollDocId(null);
     }
 }, [payWorkersError, payWorkersWriteError, pendingPayrollDocId, updatePayrollRecord, showErrorToast, payWorkersTxHash]);


  const canInitiatePayment = !isProcessing && !payWorkersLoading && selectedWorkers.length > 0 && !isLoadingWorkers && isAuthReady && !!businessAddress;

  return (
    <motion.div
      className="container mx-auto p-4 md:p-6 bg-gray-50 min-h-screen" // Light background
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
        <ToastContainer position="top-right" autoClose={4000} theme="colored" />

        {!isAuthReady ? (
             <div className="flex items-center justify-center pt-20">
             <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
           </div>
         ) : (
            <>
                 <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                 Pay Workers (Mass Payroll)
                 </h1>
                 <p className="text-gray-600 mb-6">
                    Select workers, verify the total, set gas limit, and initiate a single USDC payment transaction.
                 </p>

                 {/* --- Control Bar --- */}
                 <div className="flex flex-col md:flex-row justify-between items-center mb-5 gap-4 p-4 bg-white rounded-lg shadow">
                     {/* Search Input */}
                    <div className="relative flex-grow w-full md:w-auto">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <Search size={18} className="text-gray-400" />
                         </div>
                         <input
                         type="text"
                         placeholder="Search by name or email..."
                         value={searchQuery}
                         className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                         onChange={(e) => setSearchQuery(e.target.value)}
                         disabled={isProcessing || payWorkersLoading}
                         />
                    </div>

                    {/* Gas Limit Input */}
                    <div className="flex items-center space-x-2">
                         <label htmlFor="gasLimit" className="text-sm font-medium text-gray-700 whitespace-nowrap">Gas Limit:</label>
                         <input
                         type="number"
                         id="gasLimit"
                         value={gasLimitInput}
                         onChange={(e) => setGasLimitInput(e.target.value)}
                         className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                         placeholder="e.g. 400000"
                         min="21000"
                         max="50000"
                         step="1000"
                         disabled={isProcessing || payWorkersLoading}
                        />
                    </div>

                    {/* Action Button */}
                     <div className="w-full md:w-auto flex justify-end">
                        <button
                         onClick={handleInitiatePayment}
                         disabled={!canInitiatePayment || paymentSummary <= 0}
                         className={`bg-blue-600 text-white rounded-lg py-2.5 px-5 flex items-center justify-center font-semibold shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                                     ${(!canInitiatePayment || paymentSummary <= 0)
                                        ? 'opacity-50 cursor-not-allowed bg-gray-400'
                                        : 'hover:bg-blue-700 active:bg-blue-800'
                                    } `}
                        >
                         {isProcessing || payWorkersLoading ? (
                             <>
                             <Loader2 size={20} className="mr-2 animate-spin" />
                             {payWorkersLoading ? "Processing..." : (txStatusMessage || "Processing...")}
                             </>
                         ) : (
                             <>
                             <Send size={18} className="mr-2" />
                             Pay {selectedWorkers.length} Worker{selectedWorkers.length !== 1 ? 's' : ''}: {formatCurrency(paymentSummary)}
                            </>
                         )}
                         </button>
                    </div>
                 </div>

                 {/* --- Status Message Area --- */}
                 {txStatusMessage && !(isProcessing || payWorkersLoading) && ( // Show only when not actively loading the transaction
                     <div className="mb-4 p-3 rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300 text-sm">
                         {txStatusMessage}
                          {/* Optionally add link to explorer on success/error if hash exists */}
                          {payWorkersTxHash && (
                            <a href={`${linea_scan}/tx/${payWorkersTxHash}`} target="_blank" rel="noopener noreferrer" className="ml-2 font-medium underline hover:text-yellow-900">
                                View Transaction
                            </a>
                           )}
                     </div>
                  )}


                 {/* --- Worker Table --- */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                {isLoadingWorkers ? (
                  <div className="p-6 text-center text-gray-500"> <Loader2 className="inline w-5 h-5 mr-2 animate-spin" />Loading workers...</div>
                 ) : workers.length === 0 ? (
                   <div className="p-6 text-center text-gray-500">No workers found for this business address. Add workers in the Manage Workers section.</div>
                 ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-12">
                          <input
                            type="checkbox"
                             className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                             checked={areAllDisplayedWorkersSelected && selectedWorkers.length > 0} // Reflect selection state
                             onChange={handleSelectAll} // Use consolidated handler
                            disabled={isLoadingWorkers || isProcessing || payWorkersLoading || workers.filter(w => w.worker_wallet && w.worker_salary).length === 0} // Disable if no valid workers or processing
                          />
                         </th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Email
                         </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                           Wallet Address
                         </th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Salary (USDC)
                        </th>
                         {/* Removed Status Column for simplicity in this context */}
                       </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                       {workers
                        .filter( // Filter based on search query
                         (worker) =>
                             worker && (
                                 worker.worker_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 worker.worker_email?.toLowerCase().includes(searchQuery.toLowerCase())
                              )
                         )
                         .map((worker) => {
                           const isSelected = selectedWorkers.includes(worker.id);
                           const isValidWorker = worker.worker_wallet && worker.worker_salary && !isNaN(Number(worker.worker_salary));
                            return (
                                <tr key={worker.id} className={`${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                     <input
                                         type="checkbox"
                                         className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                                        checked={isSelected}
                                         onChange={() => toggleWorkerSelection(worker.id)}
                                         disabled={!isValidWorker || isProcessing || payWorkersLoading} // Disable if worker invalid or processing
                                      />
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">
                                     {worker.worker_name || 'N/A'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                     {worker.worker_email || 'N/A'}
                                </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                                    {worker.worker_wallet ? `${worker.worker_wallet.substring(0, 6)}...${worker.worker_wallet.substring(38)}` : 'Missing'}
                                 </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                                     {isValidWorker ? formatCurrency(worker.worker_salary) : <span className="text-red-500 text-xs">Invalid Salary</span>}
                                 </td>
                                 {/* Removed Status cell */}
                               </tr>
                           );
                       })}
                        {/* Add row if filtered list is empty but workers exist */}
                       {workers.length > 0 && workers.filter(worker => worker && (worker.worker_name?.toLowerCase().includes(searchQuery.toLowerCase()) || worker.worker_email?.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && (
                            <tr>
                               <td colSpan={5} className="text-center py-4 text-gray-500">No workers match your search query.</td>
                             </tr>
                         )}
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