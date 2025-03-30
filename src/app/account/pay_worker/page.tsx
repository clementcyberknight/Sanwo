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
  writeBatch, // writeBatch is imported but not used, consider removing if truly unused
  setDoc,
  updateDoc,
  serverTimestamp,
  auth,
} from "@/app/config/FirebaseConfig";
import { useRouter } from "next/navigation";
import EmployerPool from "../../../sc_/EmployeePoolAbi.json";
import { EmployerPoolContractAddress, linea_scan } from "../../../sc_/utils";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
// Import Address type from viem
import {
  parseUnits,
  formatUnits,
  TransactionExecutionError,
  Address,
} from "viem";
import { lineaSepolia } from "viem/chains";
// Import User type from firebase/auth
import { User } from "firebase/auth";

// --- Define an interface for the Worker data structure ---
interface Worker {
  id: string;
  worker_name?: string; // Use optional fields based on your data guarantees
  worker_email?: string;
  worker_wallet?: string; // Keep as string for Firestore, validate before use
  worker_salary?: number | string; // Allow string from Firestore, parse to number
  // Add any other relevant worker fields from Firestore
}

// --- Define an interface for the Payroll data structure (optional but good practice) ---
interface PayrollRecipientData {
  workerId: string;
  recipientName: string;
  recipientEmail: string;
  recipientWalletAddress: Address; // Use Address type
  amount: number;
}

interface PayrollData {
  payrollId: string;
  payrollDate: any; // Firestore Timestamp placeholder
  transactionHash: string | null;
  totalAmount: number;
  payrollToken: string;
  gasFeesEstimate: number;
  payrollStatus: "Pending" | "Success" | "Failed";
  businessId: Address; // Use Address type
  payrollPeriod: string;
  recipients: PayrollRecipientData[];
  category: string;
  errorDetails: string | null;
  createdAt: any; // Firestore Timestamp placeholder
  updatedAt: any; // Firestore Timestamp placeholder
}

const formatCurrency = (amount: number | string | undefined | null): string => {
  // Added checks for undefined/null and improved parsing robustness
  if (amount === undefined || amount === null) return "N/A";

  const numericAmount =
    typeof amount === "number"
      ? amount
      : parseFloat(String(amount).replace(/[^0-9.-]+/g, "")); // Keep String() conversion

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
  // --- Use the Worker interface for state ---
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatusMessage, setTxStatusMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [gasLimitInput, setGasLimitInput] = useState<string>("400000");
  const [pendingPayrollDocId, setPendingPayrollDocId] = useState<string | null>(
    null
  );

  const account = useAccount();
  // --- Use Address type from viem, handle undefined case ---
  const businessAddress = account?.address;
  // --- Use the User type from firebase/auth ---
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const router = useRouter();
  const publicClient = usePublicClient({ chainId: lineaSepolia.id });

  const {
    writeContract: executePayWorkers,
    isSuccess: payWorkersSuccess,
    isPending: payWorkersLoading,
    isError: payWorkersError,
    error: payWorkersWriteError, // Type is likely Error | null based on wagmi
    reset: resetPayWorkers,
    data: payWorkersTxHash, // Type is `0x${string}` | undefined
  } = useWriteContract();

  const showErrorToast = useCallback((message: string) => {
    toast.error(message, {
      /* options */
    });
  }, []);

  const showSuccessToast = useCallback((message: string) => {
    toast.success(message, {
      /* options */
    });
  }, []);

  useEffect(() => {
    setIsLoadingWorkers(true);
    // --- Explicitly type the user parameter ---
    const authUnsubscribe = auth.onAuthStateChanged((user: User | null) => {
      setFirebaseUser(user);
      setIsAuthReady(true); // Set auth ready regardless of user state initially

      if (user) {
        // --- Check businessAddress after confirming user exists ---
        if (!businessAddress) {
          console.warn(
            "Firebase user authenticated, but wallet not connected yet."
          );
          setTxStatusMessage("Please connect your wallet.");
          // Don't set loading to false here if we expect address later
          // setIsLoadingWorkers(false); // Let the address change trigger loading
          return; // Wait for businessAddress
        }

        setTxStatusMessage("Fetching worker data..."); // Indicate fetching starts
        const db = getFirestore(app);
        const workersCollection = collection(
          db,
          "businesses",
          businessAddress, // businessAddress is now guaranteed to be defined here
          "workers"
        );

        const workersUnsubscribe = onSnapshot(
          workersCollection,
          (snapshot) => {
            const fetchedWorkers = snapshot.docs.map(
              (doc) =>
                ({
                  id: doc.id,
                  ...doc.data(),
                  // --- Assert type, assuming Firestore data matches ---
                  // For more safety, you could add runtime validation here (e.g., with Zod)
                } as Worker)
            );
            setWorkers(fetchedWorkers);
            setIsLoadingWorkers(false);
            setTxStatusMessage(""); // Clear message on success
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
        // User is not logged in
        setIsLoadingWorkers(false);
        setTxStatusMessage("User not authenticated. Redirecting to login...");
        // Add a small delay before redirecting to allow message visibility
        const timer = setTimeout(() => router.push("/auth/login"), 1500);
        return () => clearTimeout(timer); // Cleanup timer on unmount
      }
    });

    return () => authUnsubscribe();
    // --- Add firebaseUser to dependency array if its change should trigger re-auth check ---
  }, [businessAddress, router, showErrorToast, isAuthReady]); // Removed firebaseUser if direct usage isn't needed inside

  const paymentSummary = React.useMemo(() => {
    return selectedWorkers.reduce((sum, workerId) => {
      const worker = workers.find((w) => w.id === workerId);
      // Ensure salary is valid number before adding
      if (worker && worker.worker_wallet && worker.worker_salary) {
        const salaryNum = Number(worker.worker_salary);
        if (!isNaN(salaryNum)) {
          return sum + salaryNum;
        }
      }
      return sum;
    }, 0);
  }, [selectedWorkers, workers]);

  const toggleWorkerSelection = useCallback(
    (workerId: string) => {
      setSelectedWorkers((prev) => {
        if (prev.includes(workerId)) {
          return prev.filter((id) => id !== workerId);
        } else {
          const worker = workers.find((w) => w.id === workerId);
          // Added check for salary being a valid number
          if (
            worker &&
            worker.worker_wallet &&
            worker.worker_salary &&
            !isNaN(Number(worker.worker_salary))
          ) {
            return [...prev, workerId];
          }
          // Provide more specific error
          let reason = "missing required information";
          if (!worker?.worker_wallet) reason = "missing wallet address";
          else if (
            !worker?.worker_salary ||
            isNaN(Number(worker.worker_salary))
          )
            reason = "invalid or missing salary";
          showErrorToast(
            `Cannot select worker ${
              worker?.worker_name || workerId
            }: ${reason}.`
          );
          return prev;
        }
      });
      // Only deselect 'Select All' if an individual item is deselected
      if (selectedWorkers.includes(workerId)) {
        setSelectAll(false);
      }
      // Note: Logic to check if *all* are now selected after adding one is complex,
      // rely on `areAllDisplayedWorkersSelected` memo for the checkbox state.
    },
    [workers, showErrorToast, selectedWorkers]
  ); // Added selectedWorkers dependency

  const handleSelectAll = useCallback(() => {
    const newSelectAllState = !selectAll;
    setSelectAll(newSelectAllState);

    // Filter workers based on search *and* validity for payment
    const filterPredicate = (worker: Worker) =>
      worker &&
      worker.worker_wallet &&
      worker.worker_salary &&
      !isNaN(Number(worker.worker_salary)) &&
      (worker.worker_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.worker_email?.toLowerCase().includes(searchQuery.toLowerCase()));

    if (newSelectAllState) {
      const validDisplayedWorkerIds = workers
        .filter(filterPredicate)
        .map((worker) => worker.id);
      setSelectedWorkers(validDisplayedWorkerIds);
    } else {
      // Deselect only those that *would* have been selected (the currently displayed valid ones)
      // This prevents accidentally deselecting workers not matching the current search
      const displayedWorkerIdsToDeselect = workers
        .filter(filterPredicate)
        .map((worker) => worker.id);
      setSelectedWorkers((prev) =>
        prev.filter((id) => !displayedWorkerIdsToDeselect.includes(id))
      );
      // Alternative simpler: setSelectedWorkers([]); // Deselect all regardless of filter
    }
  }, [selectAll, workers, searchQuery]); // Dependency on searchQuery needed

  const areAllDisplayedWorkersSelected = React.useMemo(() => {
    // Filter workers based on search *and* validity for payment
    const validDisplayedWorkers = workers.filter(
      (worker) =>
        worker &&
        worker.worker_wallet &&
        worker.worker_salary &&
        !isNaN(Number(worker.worker_salary)) &&
        (worker.worker_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
          worker.worker_email
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()))
    );

    const validDisplayedWorkerIds = validDisplayedWorkers.map((w) => w.id);

    if (validDisplayedWorkerIds.length === 0) return false; // Nothing to select

    // Check if every valid *displayed* worker is in the selectedWorkers array
    return validDisplayedWorkerIds.every((id) => selectedWorkers.includes(id));
  }, [workers, selectedWorkers, searchQuery]);

  // --- Add specific types for parameters ---
  const createPendingPayrollRecord = useCallback(
    async (
      paymentRecipients: [Address, bigint][], // Use Address type
      totalAmount: number,
      workerDetailsMap: Map<Address, Worker> // Use Address and Worker types
    ) => {
      if (!businessAddress) {
        // This should ideally be caught before calling, but double-check
        throw new Error(
          "Business address not found. Cannot create payroll record."
        );
      }

      const db = getFirestore(app);
      const payrollId = `payroll_${Date.now()}_${businessAddress.slice(-4)}`;
      const timestamp = serverTimestamp(); // Firestore server timestamp placeholder

      // --- Ensure recipient data matches PayrollRecipientData interface ---
      const recipientsForStorage: PayrollRecipientData[] =
        paymentRecipients.map(([address, amountViem]) => {
          const workerDetail = workerDetailsMap.get(address);
          // Use decimals=6 for USDC
          const amountFloat = parseFloat(formatUnits(amountViem, 6));

          return {
            workerId: workerDetail?.id || "Unknown ID", // Handle potential missing worker detail
            recipientName: workerDetail?.worker_name || "Unknown Name",
            recipientEmail: workerDetail?.worker_email || "Unknown Email",
            recipientWalletAddress: address, // Already Address type
            amount: isNaN(amountFloat) ? 0 : amountFloat, // Ensure amount is a number
          };
        });

      // --- Construct data matching PayrollData interface ---
      const payrollData: PayrollData = {
        payrollId,
        payrollDate: timestamp, // Assign placeholder
        transactionHash: null,
        totalAmount: Number(totalAmount) || 0,
        payrollToken: "USDC", // Assuming USDC
        gasFeesEstimate: Number(gasLimitInput) || 0, // Use state value
        payrollStatus: "Pending",
        businessId: businessAddress, // Assign address
        payrollPeriod: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        recipients: recipientsForStorage,
        category: "Payroll",
        errorDetails: null,
        createdAt: timestamp, // Assign placeholder
        updatedAt: timestamp, // Assign placeholder
      };

      try {
        console.log(
          `Creating pending payroll record ${payrollId} in Firestore...`
        );
        const payrollRef = doc(
          db,
          `businesses/${businessAddress}/payrolls/${payrollId}`
        );
        // Type assertion for setDoc if needed, assuming payrollData matches Firestore structure
        await setDoc(payrollRef, payrollData);
        console.log(`Pending payroll record ${payrollId} created.`);
        return payrollId; // Return the generated ID
      } catch (firestoreError: unknown) {
        // Type error as unknown
        console.error("Error storing PENDING payroll record:", firestoreError);
        // Extract message safely
        const message =
          firestoreError instanceof Error
            ? firestoreError.message
            : String(firestoreError);
        throw new Error(`Failed to store pending payroll record: ${message}`);
      }
    },
    [businessAddress, gasLimitInput]
  ); // Add gasLimitInput dependency

  const updatePayrollRecord = useCallback(
    async (
      payrollDocId: string,
      status: "Success" | "Failed",
      txHash: string | null, // txHash can be null
      error?: string // Error message is optional
      // gasUsed?: bigint // gasUsed isn't available from useWriteContract directly, remove if not used elsewhere
    ) => {
      if (!businessAddress || !payrollDocId) {
        console.error(
          "Missing business address or payroll doc ID for update. Cannot update record."
        );
        // Potentially show a persistent error to the user here
        showErrorToast(
          "Failed to update payroll record in database (missing info)."
        );
        return;
      }

      const db = getFirestore(app);
      const payrollRef = doc(
        db,
        `businesses/${businessAddress}/payrolls/${payrollDocId}`
      );
      const timestamp = serverTimestamp(); // Firestore server timestamp

      // --- Define update data structure explicitly ---
      const updateData: Partial<PayrollData> = {
        // Use Partial<PayrollData> for updates
        payrollStatus: status,
        transactionHash: txHash ?? null, // Handle null explicitly
        errorDetails: error || null, // Store error message or null
        updatedAt: timestamp, // Update timestamp
      };

      try {
        console.log(
          `Updating payroll record ${payrollDocId} to status: ${status}`
        );
        await updateDoc(payrollRef, updateData);
        console.log(`Payroll record ${payrollDocId} updated successfully.`);
      } catch (firestoreError: unknown) {
        // Type error as unknown
        console.error(
          `Error updating payroll record ${payrollDocId} to ${status}:`,
          firestoreError
        );
        // Extract message safely
        const message =
          firestoreError instanceof Error
            ? firestoreError.message
            : String(firestoreError);
        // Inform user about the discrepancy
        setTxStatusMessage(
          `Payroll ${status}, but failed to update database record: ${message}`
        );
        showErrorToast(
          `DB Update Failed: Payroll status update for ${payrollDocId} failed.`
        );
      }
    },
    [businessAddress, showErrorToast]
  ); // Added showErrorToast dependency

  const handleInitiatePayment = async () => {
    if (!businessAddress || !firebaseUser) {
      setTxStatusMessage("Authentication or wallet connection is missing.");
      showErrorToast(
        "Please ensure you are logged in and your wallet is connected."
      );
      return;
    }
    if (selectedWorkers.length === 0) {
      setTxStatusMessage("No workers selected for payment.");
      showErrorToast("Please select at least one worker to pay.");
      return;
    }
    const gasLimitNum = Number(gasLimitInput);
    // Increased max gas limit sanity check
    if (isNaN(gasLimitNum) || gasLimitNum <= 21000 || gasLimitNum > 2000000) {
      setTxStatusMessage(
        "Invalid Gas Limit. Please enter a reasonable number (e.g., 21001 - 2000000)."
      );
      showErrorToast("Invalid Gas Limit specified.");
      return;
    }

    setTxStatusMessage("Preparing payroll...");
    setIsProcessing(true);
    setPendingPayrollDocId(null); // Reset pending ID at the start
    resetPayWorkers(); // Reset wagmi hook state

    // --- Use correct types ---
    let preparedRecipients: Address[] = [];
    let preparedAmounts: bigint[] = [];
    let currentTotalAmount = 0;
    const workerDetailsMap = new Map<Address, Worker>(); // Use Address and Worker

    try {
      // Use a for...of loop for clearer error handling within the loop if needed
      for (const workerId of selectedWorkers) {
        const worker = workers.find((w) => w.id === workerId);

        // Skip if worker not found (shouldn't happen with current logic, but safe)
        if (!worker) continue;

        // Validate Wallet Address (more robust check)
        if (
          !worker.worker_wallet ||
          !/^0x[a-fA-F0-9]{40}$/.test(worker.worker_wallet)
        ) {
          throw new Error(
            `Worker ${
              worker.worker_name || worker.id
            } has an invalid or missing Ethereum wallet address.`
          );
        }
        const workerAddress = worker.worker_wallet as Address; // Assert as Address after validation

        // Validate Salary
        const salaryStr = String(worker.worker_salary ?? "0");
        const salaryNum = Number(salaryStr);
        if (isNaN(salaryNum) || salaryNum <= 0) {
          throw new Error(
            `Worker ${
              worker.worker_name || worker.id
            } has an invalid or missing salary (must be positive number).`
          );
        }

        // Parse salary to USDC units (6 decimals)
        const amountParsed = parseUnits(salaryStr, 6); // Use validated string

        preparedRecipients.push(workerAddress);
        preparedAmounts.push(amountParsed);
        currentTotalAmount += salaryNum; // Add validated number to total
        workerDetailsMap.set(workerAddress, worker); // Map address to worker data
      }

      if (preparedRecipients.length === 0) {
        // This might happen if selectedWorkers had IDs not in the main workers list
        // or if all selected workers failed validation
        throw new Error(
          "No valid workers found for payment after filtering and validation."
        );
      }

      setTxStatusMessage("Creating pending payroll record in database...");
      // --- Prepare recipient data for Firestore creation ---
      const recipientsForRecord: [Address, bigint][] = preparedRecipients.map(
        (addr, index) => [addr, preparedAmounts[index]]
      );
      const newPayrollDocId = await createPendingPayrollRecord(
        recipientsForRecord,
        currentTotalAmount,
        workerDetailsMap
      );
      setPendingPayrollDocId(newPayrollDocId); // Store the ID

      setTxStatusMessage("Please approve the transaction in your wallet...");
      console.log(
        "Executing PayWorkers transaction with args:",
        preparedRecipients,
        preparedAmounts
      );

      // --- Execute Contract Call ---
      executePayWorkers({
        address: EmployerPoolContractAddress as Address, // Ensure contract address is Address type
        abi: EmployerPool, // ABI type is usually implicitly handled
        functionName: "payWorkers",
        args: [preparedRecipients, preparedAmounts],
        chainId: lineaSepolia.id,
        gas: BigInt(gasLimitNum), // Use validated gas limit
        // Consider adding value if the contract requires ETH payment alongside args
        // value: parseEther('0.0'),
      });
    } catch (error: unknown) {
      // Type error as unknown
      console.error("Error during payment initiation:", error);
      // Extract message safely
      const errorMsg = error instanceof Error ? error.message : String(error);
      const displayMsg = `Error: ${errorMsg.substring(0, 100)}${
        errorMsg.length > 100 ? "..." : ""
      }`; // Truncate long messages
      setTxStatusMessage(displayMsg);
      showErrorToast(`Initiation Failed: ${errorMsg}`);

      // If a pending record was created before the error, mark it as failed
      if (pendingPayrollDocId) {
        try {
          await updatePayrollRecord(
            pendingPayrollDocId,
            "Failed",
            null,
            `Initiation Failed: ${errorMsg}`
          );
        } catch (updateError) {
          console.error(
            "Additionally failed to update the pending record to Failed status:",
            updateError
          );
        }
      }

      setIsProcessing(false);
      setPendingPayrollDocId(null); // Clear ID on failure
      resetPayWorkers(); // Reset wagmi state
    }
  };

  // Effect for successful transaction
  useEffect(() => {
    if (payWorkersSuccess && payWorkersTxHash && pendingPayrollDocId) {
      console.log("PayWorkers Transaction Successful! Hash:", payWorkersTxHash);
      setTxStatusMessage(
        `Payroll Submitted Successfully! Tx: ${payWorkersTxHash.substring(
          0,
          10
        )}...`
      ); // Show partial hash
      showSuccessToast("Payroll processed successfully!");

      // --- Update the existing Firestore record to Success ---
      updatePayrollRecord(
        pendingPayrollDocId,
        "Success",
        payWorkersTxHash, // Pass the transaction hash
        undefined // No error message
      ).finally(() => {
        // --- Cleanup regardless of DB update success/failure ---
        setSelectedWorkers([]); // Clear selection
        setSelectAll(false);
        setPendingPayrollDocId(null); // Clear pending ID
        setIsProcessing(false); // Stop processing indicator
        // Optionally clear status message after a delay
        const timer = setTimeout(() => setTxStatusMessage(""), 5000);
        return () => clearTimeout(timer);
      });
      // No need to call resetPayWorkers here, success state is useful
    }
    // Add dependencies: updatePayrollRecord, showSuccessToast
  }, [
    payWorkersSuccess,
    payWorkersTxHash,
    pendingPayrollDocId,
    updatePayrollRecord,
    showSuccessToast,
  ]);

  // Effect for failed transaction
  useEffect(() => {
    if (payWorkersError && pendingPayrollDocId) {
      // --- Type the error more specifically if possible ---
      const rawError = payWorkersWriteError; // Error type from wagmi
      let errorMsg = "Payroll transaction failed on-chain."; // Default message

      // --- Extract user-friendly message from common error types ---
      if (rawError instanceof TransactionExecutionError) {
        // Provides more context potentially (Reverted, Gas estimation failed, etc.)
        errorMsg =
          rawError.shortMessage ||
          rawError.message ||
          "Transaction execution failed.";
      } else if (rawError instanceof Error) {
        // Generic JS error
        errorMsg = rawError.message;
      } else if (rawError) {
        // Handle non-Error objects if wagmi ever returns them
        errorMsg = String(rawError);
      }

      // Prevent overly long messages in UI
      const displayMsg =
        errorMsg.length > 150 ? errorMsg.substring(0, 147) + "..." : errorMsg;

      console.error("PayWorkers Transaction Failed:", rawError); // Log the full error object
      setTxStatusMessage(`Error: ${displayMsg}`);
      showErrorToast(`Transaction Failed: ${displayMsg}`); // Show potentially truncated message

      // --- Update the existing Firestore record to Failed ---
      updatePayrollRecord(
        pendingPayrollDocId,
        "Failed",
        payWorkersTxHash ?? null, // Include hash if the tx was sent but reverted
        errorMsg // Store the detailed error message
      ).finally(() => {
        // --- Cleanup ---
        setIsProcessing(false); // Stop processing indicator
        setPendingPayrollDocId(null); // Clear pending ID
        // Don't clear selection on failure, user might want to retry
        // setSelectedWorkers([]);
        // setSelectAll(false);
        resetPayWorkers(); // Reset wagmi error/loading state is important
      });
    }
    // Add dependencies: updatePayrollRecord, showErrorToast, resetPayWorkers
  }, [
    payWorkersError,
    payWorkersWriteError,
    pendingPayrollDocId,
    payWorkersTxHash,
    updatePayrollRecord,
    showErrorToast,
    resetPayWorkers,
  ]);

  const canInitiatePayment =
    !isProcessing &&
    !payWorkersLoading &&
    selectedWorkers.length > 0 &&
    !isLoadingWorkers &&
    isAuthReady &&
    !!businessAddress &&
    paymentSummary > 0; // Added paymentSummary check

  return (
    <motion.div
      className="container mx-auto p-4 md:p-6 bg-gray-50 min-h-screen" // Light background
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <ToastContainer position="top-right" autoClose={4000} theme="colored" />

      {/* Simplified Loading/Auth Check */}
      {!isAuthReady ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Initializing authentication...</p>
        </div>
      ) : !firebaseUser ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center">
          <XCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-gray-600">
            {txStatusMessage || "Authentication required."}
          </p>
          {/* Optional: Add a manual login button if redirect fails */}
        </div>
      ) : !businessAddress ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">
            {txStatusMessage || "Please connect your wallet..."}
          </p>
        </div>
      ) : (
        // --- Main Content Rendered when Ready ---
        <>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Pay Workers (Mass Payroll)
          </h1>
          <p className="text-gray-600 mb-6">
            Select workers, verify the total, set gas limit, and initiate a
            single USDC payment transaction on Linea Sepolia.
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchQuery(e.target.value)
                } // Added event type
                disabled={isProcessing || payWorkersLoading || isLoadingWorkers} // Also disable during initial load
              />
            </div>

            {/* Gas Limit Input */}
            <div className="flex items-center space-x-2">
              <label
                htmlFor="gasLimit"
                className="text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                Gas Limit:
              </label>
              <input
                type="number"
                id="gasLimit"
                value={gasLimitInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setGasLimitInput(e.target.value)
                } // Added event type
                className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="e.g. 400000"
                min="21000"
                // Removed max, step for flexibility, validation done in handler
                // max="50000" // Removed max limit
                // step="1000" // Removed step
                disabled={isProcessing || payWorkersLoading}
              />
            </div>

            {/* Action Button */}
            <div className="w-full md:w-auto flex justify-end">
              <button
                onClick={handleInitiatePayment}
                disabled={!canInitiatePayment} // Use combined disabled state
                className={`bg-blue-600 text-white rounded-lg py-2.5 px-5 flex items-center justify-center font-semibold shadow transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                                     ${
                                       !canInitiatePayment
                                         ? "opacity-50 cursor-not-allowed bg-gray-400"
                                         : "hover:bg-blue-700 active:bg-blue-800"
                                     } `}
              >
                {isProcessing || payWorkersLoading ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    {/* Show specific status message if available during loading */}
                    {payWorkersLoading
                      ? txStatusMessage || "Processing Tx..."
                      : txStatusMessage || "Preparing..."}
                  </>
                ) : (
                  <>
                    <Send size={18} className="mr-2" />
                    {/* Handle pluralization and formatting */}
                    Pay {selectedWorkers.length} Worker
                    {selectedWorkers.length !== 1 ? "s" : ""} (
                    {formatCurrency(paymentSummary)})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* --- Status Message Area --- */}
          {/* Show status unless actively processing the blockchain TX */}
          {txStatusMessage && !payWorkersLoading && (
            <div
              className={`mb-4 p-3 rounded-md text-sm border ${
                payWorkersError
                  ? "bg-red-100 text-red-800 border-red-300"
                  : payWorkersSuccess
                  ? "bg-green-100 text-green-800 border-green-300"
                  : "bg-yellow-100 text-yellow-800 border-yellow-300" // Default/pending/info style
              }`}
            >
              {txStatusMessage}
              {/* Link to explorer only if hash exists */}
              {payWorkersTxHash && (
                <a
                  href={`${linea_scan}/tx/${payWorkersTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 font-medium underline hover:text-inherit"
                >
                  View Transaction
                </a>
              )}
            </div>
          )}

          {/* --- Worker Table --- */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            {isLoadingWorkers ? (
              <div className="p-6 text-center text-gray-500">
                {" "}
                <Loader2 className="inline w-5 h-5 mr-2 animate-spin" />
                Loading workers...
              </div>
            ) : workers.length === 0 ? ( // Check after loading is complete
              <div className="p-6 text-center text-gray-500">
                No workers found for this business address (
                {businessAddress?.substring(0, 6)}...). Add workers in the
                'Manage Workers' section.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-12">
                      {/* --- Select All Checkbox --- */}
                      <input
                        type="checkbox"
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        // Checked state reflects if all *valid and currently displayed* workers are selected
                        checked={areAllDisplayedWorkersSelected}
                        // Indeterminate state if some but not all are selected
                        ref={(el) => {
                          if (el) {
                            const validDisplayedCount = workers.filter(
                              (worker) =>
                                worker &&
                                worker.worker_wallet &&
                                worker.worker_salary &&
                                !isNaN(Number(worker.worker_salary)) &&
                                (worker.worker_name
                                  ?.toLowerCase()
                                  .includes(searchQuery.toLowerCase()) ||
                                  worker.worker_email
                                    ?.toLowerCase()
                                    .includes(searchQuery.toLowerCase()))
                            ).length;
                            const selectedDisplayedCount = workers.filter(
                              (worker) =>
                                selectedWorkers.includes(worker.id) &&
                                worker &&
                                worker.worker_wallet &&
                                worker.worker_salary &&
                                !isNaN(Number(worker.worker_salary)) &&
                                (worker.worker_name
                                  ?.toLowerCase()
                                  .includes(searchQuery.toLowerCase()) ||
                                  worker.worker_email
                                    ?.toLowerCase()
                                    .includes(searchQuery.toLowerCase()))
                            ).length;
                            el.indeterminate =
                              selectedDisplayedCount > 0 &&
                              selectedDisplayedCount < validDisplayedCount;
                          }
                        }}
                        onChange={handleSelectAll}
                        // Disable if loading, processing, or if there are no valid workers currently displayed
                        disabled={
                          isLoadingWorkers ||
                          isProcessing ||
                          payWorkersLoading ||
                          workers.filter(
                            (w) =>
                              w.worker_wallet &&
                              w.worker_salary &&
                              !isNaN(Number(w.worker_salary)) &&
                              (w.worker_name
                                ?.toLowerCase()
                                .includes(searchQuery.toLowerCase()) ||
                                w.worker_email
                                  ?.toLowerCase()
                                  .includes(searchQuery.toLowerCase()))
                          ).length === 0
                        }
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider pr-4">
                      {" "}
                      {/* Align right */}
                      Salary (USDC)
                    </th>
                  </tr>
                </thead>
                {/* --- Table Body --- */}
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    // Use IIFE to handle filtering and empty states cleanly
                    const filteredWorkers = workers.filter(
                      (worker) =>
                        worker &&
                        (worker.worker_name
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                          worker.worker_email
                            ?.toLowerCase()
                            .includes(searchQuery.toLowerCase()))
                    );

                    if (filteredWorkers.length === 0) {
                      return (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-4 px-4 text-gray-500"
                          >
                            {
                              searchQuery
                                ? "No workers match your search query."
                                : "No workers available." /* Adjust message based on search */
                            }
                          </td>
                        </tr>
                      );
                    }

                    return filteredWorkers.map((worker) => {
                      const isSelected = selectedWorkers.includes(worker.id);
                      // Re-check validity for disabling checkbox and styling
                      const isValidWorker =
                        !!worker.worker_wallet &&
                        !!worker.worker_salary &&
                        !isNaN(Number(worker.worker_salary)) &&
                        Number(worker.worker_salary) > 0 &&
                        /^0x[a-fA-F0-9]{40}$/.test(worker.worker_wallet);

                      return (
                        <tr
                          key={worker.id}
                          className={`${
                            isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                          } ${
                            !isValidWorker ? "opacity-60" : ""
                          } transition-colors`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                              checked={isSelected}
                              onChange={() => toggleWorkerSelection(worker.id)}
                              // Disable checkbox if worker data is invalid or if processing payment
                              disabled={
                                !isValidWorker ||
                                isProcessing ||
                                payWorkersLoading
                              }
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">
                            {worker.worker_name || (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {worker.worker_email || (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </td>
                          <td
                            className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono text-xs"
                            title={worker.worker_wallet}
                          >
                            {" "}
                            {/* Add title for full address hover */}
                            {worker.worker_wallet ? (
                              `${worker.worker_wallet.substring(
                                0,
                                6
                              )}...${worker.worker_wallet.substring(
                                worker.worker_wallet.length - 4
                              )}`
                            ) : (
                              <span className="text-red-500 text-xs">
                                Missing
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium text-right pr-4">
                            {" "}
                            {/* Align right */}
                            {isValidWorker ? (
                              formatCurrency(worker.worker_salary) // Use already validated salary
                            ) : (
                              <span className="text-red-500 text-xs">
                                {!worker.worker_salary ||
                                isNaN(Number(worker.worker_salary))
                                  ? "Invalid Salary"
                                  : "Missing Info"}
                              </span>
                            )}
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
