"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, Send, Loader2 } from "lucide-react"; // Added Loader2 for spinner
import {
  db,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
} from "@/app/config/FirebaseConfig";
import EmployerPool from "../../sc_/EmployeePoolAbi.json";
import {
  EmployerPoolContractAddress,
  SanwoUtilityToken, // Assuming the pool transfers USDC like the deposit example
  linea_scan,
} from "../../sc_/utils";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, isAddress } from 'viem'; // Use viem's isAddress for validation
import { lineaSepolia } from 'viem/chains';

// Define ABIs - Only EmployerPool ABI is needed for transferByEmployer
const EMPLOYER_POOL_ABI = EmployerPool;

// --- Animation Variants --- (Copied from Deposit Modal)
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { y: "100vh", opacity: 0 },
  visible: {
    y: "-50%", // Center vertically using transform
    opacity: 1,
    transition: { delay: 0.1, duration: 0.4, type: "spring", stiffness: 100 },
  },
  exit: { y: "100vh", opacity: 0 },
};

// --- Component Props Interface ---
interface WalletSendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- Component Implementation ---
const WalletSendModal: React.FC<WalletSendModalProps> = ({ isOpen, onClose }) => {
  // --- State ---
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");
  // Simplified token selection assuming only pool's token (USDC?) is transferred via this function
  const [selectedToken] = useState<string>("USDC"); // Hardcoded for now, remove UI if only USDC
  const [withdrawalCategory, setWithdrawalCategory] = useState<string>("vendor"); // Default category
  const [txStatusMessage, setTxStatusMessage] = useState<string>("");
  const [isValidRecipient, setIsValidRecipient] = useState<boolean>(true);

  // --- Wagmi Hooks ---
  const { address: businessAddress } = useAccount(); // Get connected account address
  const {
    writeContract: transferByEmployer, // Renamed function for clarity
    data: txHash, // Transaction hash returned on successful submission
    isPending: isLoading, // Use isPending for loading state (wagmi v2)
    isSuccess,
    isError,
    error: writeError, // Detailed error object
    reset: resetWriteContract, // Function to reset the hook's state
  } = useWriteContract();

  // --- Constants ---
  const withdrawalCategories = [
    { value: "vendor", label: "Vendor Payment" },
    { value: "refund", label: "Refund" },
    { value: "investment", label: "Investment Return" }, // Clarified label
    { value: "operational", label: "Operational Expense" },
    { value: "dividend", label: "Dividend Payout"}, // Added option
    { value: "partner", label: "Partner Withdrawal"}, // Added option
    { value: "other", label: "Other" },
  ];

  // --- Address Validation ---
  useEffect(() => {
    if (recipientAddress === "") {
      setIsValidRecipient(true); // Valid if empty
    } else {
      setIsValidRecipient(isAddress(recipientAddress)); // Use viem's checker
    }
  }, [recipientAddress]);

  // --- Helper Functions (Consider moving to a utility file if reused) ---
  const getDeviceInfo = useCallback(() => {
    if (typeof window === "undefined") return {}; // Guard for SSR
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    };
  }, []);

  const getLocationInfo = useCallback(async () => {
    // Check if API key is configured - skip if not to avoid errors/costs
    if (!process.env.NEXT_PUBLIC_IPAPI_API_KEY) {
      console.warn("IPAPI API key not configured. Skipping location info.");
      return { country: "N/A", region: "N/A", city: "N/A", ipAddress: "N/A" };
    }
    try {
      // Ensure you have CORS configured if calling from browser directly,
      // or preferably call this from a backend API route.
      const response = await fetch(
        `https://api.ipapi.com/api/check?access_key=${process.env.NEXT_PUBLIC_IPAPI_API_KEY}`
      );
       if (!response.ok) {
           const errorText = await response.text();
           throw new Error(`IPAPI request failed with status ${response.status}: ${errorText}`);
       }
      const data = await response.json();
      if (data.error) {
          throw new Error(`IPAPI Error: ${data.info || 'Unknown error'}`);
      }
      console.log("Location info fetched:", data);
      return {
        country: data.country_name || "Unknown",
        region: data.region_name || "Unknown",
        city: data.city || "Unknown",
        ipAddress: data.ip || "Unknown",
      };
    } catch (error) {
      console.error("Error fetching location info:", error);
      return { country: "Error", region: "Error", city: "Error", ipAddress: "Error" };
    }
  }, []); // Empty dependency array, this function doesn't depend on component state

  // --- Firestore Storage Function ---
  const storeWithdrawalTransaction = useCallback(async (
    amount: string,
    recipient: string,
    category: string,
    token: string,
    txHash: string | null,
    status: "Success" | "Failed",
    error?: string,
    // gasFees?: string // Note: Getting accurate gas AFTER confirmation is complex with just wagmi hooks
  ) => {
    if (!businessAddress) {
      console.error("Business address not available for storing transaction.");
      setTxStatusMessage("Error: Wallet not connected."); // Inform user
      return;
    }
    console.log(`Storing withdrawal: Amount=${amount}, Recipient=${recipient}, Cat=${category}, Token=${token}, Hash=${txHash}, Status=${status}, Error=${error}`);

    try {
      const timestamp = serverTimestamp();
      const txId = txHash ?? `local_${Date.now()}`; // Use tx hash if available, else a temp ID
      const withdrawalId = `wdl_${txId}`;
      const locationInfo = await getLocationInfo(); // Fetch location on save
      const deviceInfo = getDeviceInfo(); // Get device info on save

      // --- Withdrawals Collection --- (Detailed Record)
      const withdrawalsRef = collection(db, `businesses/${businessAddress}/withdrawals`);
      await addDoc(withdrawalsRef, {
        withdrawalId,
        withdrawalDate: timestamp,
        withdrawalAmount: Number(amount) || 0,
        category: category,
        withdrawalToken: token,
        businessId: businessAddress,
        recipientWalletAddress: recipient,
        transactionHash: txHash ?? null,
        withdrawalStatus: status,
        gasFees: null, // Placeholder - hard to get reliably here
        errorDetails: error || null,
        ipAddress: locationInfo.ipAddress,
        geoLocation: {
          country: locationInfo.country,
          region: locationInfo.region,
          city: locationInfo.city,
        },
        deviceInfo: deviceInfo,
        createdAt: timestamp,
        updatedAt: timestamp,
        transactionType: "withdrawal", // Added type for consistency
      });

      // --- Payments Collection --- (Simplified for Payment History?)
      // Consider if this is truly needed alongside Withdrawals and WalletTransactions
      const paymentId = `pay_${withdrawalId}`; // Link to withdrawal
      const paymentsRef = doc(db, `businesses/${businessAddress}/payments/${paymentId}`);
      await setDoc(paymentsRef, {
        amount: Number(amount) || 0,
        paymentId,
        linkedTransactionId: withdrawalId, // Link to the specific withdrawal record
        category: "withdrawal", // Top-level category
        subCategory: category, // The specific withdrawal category
        status: status,
        transactionHash: txHash ?? null,
        timestamp: timestamp,
        type: "withdrawal",
      });

      // --- WalletTransactions Collection --- (For Activity Feed)
      const walletTxId = `wtx_${withdrawalId}`; // Link to withdrawal
      const walletTransactionsRef = collection(db, `businesses/${businessAddress}/walletTransactions`);
      await addDoc(walletTransactionsRef, {
        id: walletTxId,
        linkedTransactionId: withdrawalId,
        type: "withdrawal", // Overall type
        amount: Number(amount) || 0,
        token: token,
        status: status, // Overall status
        category: category, // Specific category for context
        transactionHash: txHash ?? null,
        timestamp: timestamp, // Use Firestore server timestamp consistently
        fromWalletAddress: businessAddress,
        toWalletAddress: recipient,
        errorDetails: error || null,
        description: `${status === 'Success' ? 'Sent' : 'Attempted to send'} ${amount} ${token} to ${recipient.substring(0, 6)}...${recipient.substring(recipient.length - 4)}. Category: ${category}. ${error ? `Error: ${error.substring(0, 50)}...` : ''}`,
        businessId: businessAddress,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      console.log(`Withdrawal transaction (Status: ${status}) stored successfully in Firestore.`);

    } catch (firestoreError: any) {
      console.error("Error storing withdrawal transaction in Firestore:", firestoreError);
      setTxStatusMessage(`Error saving transaction record: ${firestoreError.message}`);
      // Do not throw; allow UI to show the message
    }
  }, [businessAddress, getLocationInfo, getDeviceInfo]); // Dependencies for the callback


  // --- Transaction Initiation ---
  const handleSend = async () => {
    if (!businessAddress) {
      setTxStatusMessage("Please connect your wallet.");
      return;
    }
    if (!isValidRecipient || !recipientAddress) {
      setTxStatusMessage("Invalid recipient address.");
      setIsValidRecipient(false); // Ensure visual feedback if somehow bypassed
      return;
    }
    if (!sendAmount || Number(sendAmount) <= 0) {
      setTxStatusMessage("Invalid send amount.");
      return;
    }
     // Assuming pool transfers USDC (6 decimals)
     if (selectedToken !== "USDC") {
        setTxStatusMessage("Currently, only USDC transfers from the pool are supported.");
        console.warn("Non-USDC token selected, but proceeding with contract logic assuming USDC.");
        // return; // Or handle other tokens if contract supports it
    }

    resetWriteContract(); // Reset previous transaction state
    setTxStatusMessage("Processing transaction..."); // Initial status

    try {
      const amountParsed = parseUnits(sendAmount, 6); // USDC assumed 6 decimals

      console.log(`Attempting to send ${sendAmount} ${selectedToken} (${amountParsed} units) to ${recipientAddress} via EmployerPool`);

      // Call the wagmi hook to initiate the transaction
      transferByEmployer({
        chainId: lineaSepolia.id, // Use imported chain object
        address: EmployerPoolContractAddress as `0x${string}`,
        abi: EMPLOYER_POOL_ABI,
        functionName: 'transferByEmployer',
        args: [recipientAddress as `0x${string}`, amountParsed],
        // Removed hardcoded gas - let wagmi/wallet estimate
      });
      console.log("Withdrawal transaction sent to wallet for confirmation...");
      // The rest (success/error handling) is managed by useEffect hooks

    } catch (initiationError: any) {
      const errorMsg = initiationError.shortMessage || initiationError.message || "Transaction failed to initiate.";
      console.error("Error initiating withdrawal transaction:", initiationError);
      setTxStatusMessage(`Error: ${errorMsg}`);
      // Store failure immediately if initiation fails (won't have a tx hash)
      await storeWithdrawalTransaction(
        sendAmount,
        recipientAddress,
        withdrawalCategory,
        selectedToken,
        null, // No tx hash available
        "Failed",
        `Initiation Failed: ${errorMsg}`
      );
      resetWriteContract(); // Ensure state is clean after failure
    }
  };

  // --- Effect Hook for SUCCESSFUL Transaction ---
  useEffect(() => {
    if (isSuccess && txHash) {
      console.log(`Withdrawal Transaction Successful! Hash: ${txHash}`);
      setTxStatusMessage("Withdrawal Successful!");
      // Store the successful transaction details in Firestore
      storeWithdrawalTransaction(
        sendAmount,
        recipientAddress,
        withdrawalCategory,
        selectedToken,
        txHash,
        "Success"
      ).then(() => {
         console.log("Successful withdrawal stored in DB.");
          // Close modal after a short delay
          setTimeout(() => {
              handleClose();
          }, 2000); // 2-second delay
      }).catch((dbError) => {
         console.error("Failed to store successful withdrawal in DB:", dbError);
         setTxStatusMessage("Withdrawal succeeded but failed to save record.");
         // Keep modal open to show the message if DB save fails
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, txHash, storeWithdrawalTransaction, sendAmount, recipientAddress, withdrawalCategory, selectedToken]);
  // Add handleClose to dependencies if it's used directly inside, but it's better called via timeout outside the direct effect logic for clarity.

  // --- Effect Hook for FAILED Transaction ---
  useEffect(() => {
    if (isError && !isLoading) { // Ensure it's a final error state, not just mid-process
      const errorMsg = writeError?.shortMessage || writeError?.message || "Withdrawal transaction failed.";
      console.error("Withdrawal Transaction Failed:", writeError);
      setTxStatusMessage(`Withdrawal Failed: ${errorMsg}`);
      // Store the failed transaction details
      storeWithdrawalTransaction(
        sendAmount,
        recipientAddress,
        withdrawalCategory,
        selectedToken,
        txHash ?? null, // Include hash if it exists (failed on-chain), else null
        "Failed",
        errorMsg
      ).catch((dbError) => {
          // Log extra error if DB save fails too
          console.error("Additionally, failed to store failed withdrawal record in DB:", dbError);
      });
       // Do not close the modal automatically on error
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, writeError, isLoading, storeWithdrawalTransaction, sendAmount, recipientAddress, withdrawalCategory, selectedToken, txHash]);


  // --- Modal Close Handler ---
  const handleClose = useCallback(() => {
    onClose(); // Call the parent's close handler
    // Reset state after animation duration
    setTimeout(() => {
      setRecipientAddress("");
      setSendAmount("");
      setWithdrawalCategory("vendor");
      setTxStatusMessage("");
      setIsValidRecipient(true);
      resetWriteContract(); // Reset wagmi hook state
    }, 300); // Match animation duration or slightly longer
  }, [onClose, resetWriteContract]);


  // --- Render Logic ---
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 z-50" // Consistent backdrop style
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={handleClose} // Use internal handler
          />

          {/* Modal */}
          <motion.div
             className="fixed top-1/2 left-1/2 bg-gray-900 text-white rounded-2xl shadow-lg p-8 max-w-xl w-11/12 z-50" // Consistent modal style
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ x: "-50%", y: "-50%" }} // Consistent positioning
            onClick={(e) => e.stopPropagation()} // Prevent backdrop clickthrough
          >
            {/* Close Button */}
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white focus:outline-none"
              onClick={handleClose} // Use internal handler
              aria-label="Close"
              disabled={isLoading} // Disable close during transaction
            >
              <XCircle size={24} />
            </button>

            {/* Title */}
            <h2 className="text-2xl font-semibold text-white mb-6">
              Send Crypto from Pool
            </h2>

            {/* Category Selection */}
            <div className="mb-4">
              <label
                htmlFor="withdrawalCategory"
                className="block text-gray-300 text-sm font-medium mb-1"
              >
                Payment Category
              </label>
              <select
                id="withdrawalCategory"
                className="shadow-sm border border-gray-700 rounded w-full py-2 px-3 text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={withdrawalCategory}
                onChange={(e) => setWithdrawalCategory(e.target.value)}
                disabled={isLoading}
              >
                {withdrawalCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Address Input */}
            <div className="mb-4">
              <label
                htmlFor="recipientAddress"
                className="block text-gray-300 text-sm font-medium mb-1"
              >
                Recipient Wallet Address
              </label>
              <input
                type="text"
                id="recipientAddress"
                className={`shadow-sm appearance-none border ${
                    !isValidRecipient ? 'border-red-500' : 'border-gray-700'
                } rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800`}
                placeholder="0x..."
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                disabled={isLoading}
              />
              {!isValidRecipient && recipientAddress !== "" && ( // Show error only if invalid and not empty
                <p className="text-red-500 text-xs mt-1">
                  Invalid wallet address format.
                </p>
              )}
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label
                htmlFor="sendAmount"
                className="block text-gray-300 text-sm font-medium mb-1"
              >
                Amount ({selectedToken}) {/* Show the selected/hardcoded token */}
              </label>
              <input
                type="number"
                id="sendAmount"
                className="shadow-sm appearance-none border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800"
                placeholder="e.g., 50.00"
                value={sendAmount}
                 // Basic validation for positive numbers
                onChange={(e) => setSendAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                min="0" // Prevent negative numbers via browser validation (though state handles > 0 check)
                step="any" // Allow decimals
                disabled={isLoading}
              />
            </div>

             {/* Token Selection (Commented out as only USDC seems handled by contract func) */}
            {/* If multiple tokens ARE supported by `transferByEmployer` based on an argument, re-enable and adjust logic */}
            {/* <div className="mb-6">
               <label className="block text-gray-300 text-sm font-medium mb-2">Select Token:</label>
               <div className="flex space-x-4">
                 {["USDC"].map((token) => ( // Update if other tokens possible
                   <label key={token} className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium cursor-pointer ${selectedToken === token ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                     <input
                       type="radio" className="sr-only" value={token}
                       checked={selectedToken === token}
                       onChange={() => setSelectedToken(token)} // You'd need a setSelectedToken state hook
                       disabled={isLoading}
                     />
                     {token}
                   </label>
                 ))}
               </div>
            </div> */}

            {/* Status Message Area */}
            {txStatusMessage && (
              <div className="mb-4 text-center min-h-[20px]">
                 <p className={`text-sm font-medium ${
                     isError ? 'text-red-400'
                     : isSuccess ? 'text-green-400'
                     : isLoading ? 'text-yellow-400'
                     : 'text-gray-400' // Default or processing messages
                  }`}>
                     {txStatusMessage}
                     {txHash && ( // Show link to explorer if hash is available
                         <a
                             href={`${linea_scan}/tx/${txHash}`}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-blue-400 hover:text-blue-300 underline ml-2"
                             title="View on Lineascan"
                         >
                             (View Tx)
                         </a>
                     )}
                 </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                className="bg-gray-600 hover:bg-gray-500 text-gray-100 font-bold py-2 px-5 rounded focus:outline-none focus:shadow-outline transition-colors text-base disabled:opacity-50"
                onClick={handleClose} // Use internal handler
                disabled={isLoading} // Disable cancel during transaction? Optional
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-5 rounded focus:outline-none focus:shadow-outline transition-colors flex items-center justify-center space-x-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSend}
                disabled={
                    !isValidRecipient ||
                    !recipientAddress ||
                    !sendAmount ||
                    Number(sendAmount) <= 0 ||
                    isLoading || // Main disabling condition
                    !businessAddress // Disable if wallet not connected
                 }
              >
                {isLoading ? (
                  <>
                    <span>Processing...</span>
                    <Loader2 size={18} className="animate-spin ml-2" />
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WalletSendModal;