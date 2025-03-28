"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ExternalProvider } from "@ethersproject/providers";
import { MockUSDC, abi, payWorkers } from "@/sc_stylus/scabi";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, Send } from "lucide-react";
import { db } from "@/app/config/FirebaseConfig";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";
import { useAccount } from "wagmi";

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { y: "100vh", opacity: 0 },
  visible: {
    y: "-50%",
    opacity: 1,
    transition: { delay: 0.1, duration: 0.4, type: "spring", stiffness: 100 },
  },
  exit: { y: "100vh", opacity: 0 },
};

declare global {
  interface Window {
    ethereum?: ExternalProvider & { request: (...args: any[]) => Promise<any> };
  }
}

//@ts-ignore
const WalletSendModal = ({ isOpen, onClose }) => {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("USDC"); // Default to USDC
  const [isAddressValid, setIsAddressValid] = useState(true);
  const [withdrawalCategory, setWithdrawalCategory] = useState("payroll");
  const Account = useAccount();
  const businessAddress = Account?.address;

  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<any>(null);
  const [employerContract, setEmployerContract] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const providerInstance = new ethers.BrowserProvider(
        window.ethereum as any
      );
      setProvider(providerInstance);
      providerInstance
        .getSigner()
        .then((s) => setSigner(s))
        .catch((err) => console.error(err));
    }
  }, []);

  useEffect(() => {
    if (signer) {
      const contract = new ethers.Contract(payWorkers, abi, signer);
      setEmployerContract(contract);
    }
  }, [signer]);

  const validateAddress = (address: String) => {
    // Basic validation - implement your specific validation logic
    return address.startsWith("0x") && address.length === 42;
  };

  //@ts-ignore
  const handleAddressChange = (e) => {
    const address = e.target.value;
    setRecipientAddress(address);

    // Only validate if the user has entered something
    if (address.length > 0) {
      setIsAddressValid(validateAddress(address));
    } else {
      setIsAddressValid(true); // Reset validation if field is empty
    }
  };

  // Add categories for withdrawal transactions
  const withdrawalCategories = [
    { value: "vendor", label: "Vendor Payment" },
    { value: "refund", label: "Refund" },
    { value: "investment", label: "Investment" },
    { value: "operational", label: "Operational Expense" },
    { value: "other", label: "Other" },
  ];

  const getDeviceInfo = () => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    };
  };

  const getLocationInfo = async () => {
    try {
      const response = await fetch(
        `https://api.ipapi.com/api/check?access_key=${process.env.NEXT_PUBLIC_IPAPI_API_KEY}`
      );
      const data = await response.json();
      console.log("location info", data);
      return {
        country: data.country_name,
        region: data.region_name,
        city: data.city,
        ipAddress: data.ip,
      };
    } catch (error) {
      console.error("Error fetching location info:", error);
      return {
        country: "Unknown",
        region: "Unknown",
        city: "Unknown",
        ipAddress: "Unknown",
      };
    }
  };

  const storeWithdrawalTransaction = async (
    amount: string,
    recipientAddress: string,
    txHash: string,
    status: "Success" | "Pending" | "Failed",
    error?: string,
    gasFees?: string
  ) => {
    if (!businessAddress) {
      console.error("No business address found");
      return;
    }

    try {
      const timestamp = serverTimestamp();
      const withdrawalId = Date.now().toString();
      const locationInfo = await getLocationInfo();

      // Store in withdrawals collection (keeping detailed information)
      const withdrawalsRef = collection(
        db,
        `businesses/${businessAddress}/withdrawals`
      );
      await addDoc(withdrawalsRef, {
        withdrawalId,
        withdrawalDate: timestamp,
        withdrawalAmount: Number(amount),
        category: withdrawalCategory,
        withdrawalToken: selectedToken,
        businessId: businessAddress,
        recipientWalletAddress: recipientAddress,
        transactionHash: txHash,
        withdrawalStatus: status,
        gasFees: gasFees || null,
        errorDetails: error || null,
        ipAddress: locationInfo.ipAddress,
        geoLocation: {
          country: locationInfo.country,
          region: locationInfo.region,
          city: locationInfo.city,
        },
        deviceInfo: getDeviceInfo(),
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // Store in payments collection
      const paymentsRef = doc(
        db,
        `businesses/${businessAddress}/payments/${withdrawalId}`
      );
      await setDoc(paymentsRef, {
        amount: Number(amount),
        withdrawalId,
        transactionId: withdrawalId,
        category: "withdrawal",
        status: status,
        transactionHash: txHash,
        timestamp: timestamp,
      });

      // Store in walletTransactions collection for wallet page UI
      const walletTransactionsRef = collection(
        db,
        `businesses/${businessAddress}/walletTransactions`
      );
      await addDoc(walletTransactionsRef, {
        id: withdrawalId,
        type: "withdrawal",
        withdrawalAmount: Number(amount),
        withdrawalToken: selectedToken,
        withdrawalStatus: status,
        category: withdrawalCategory,
        transactionHash: txHash,
        createdAt: timestamp,
        withdrawalDate: timestamp,
        recipientWalletAddress: recipientAddress,
        errorDetails: error || null,
        gasFees: gasFees || null,
        // Additional fields needed for the wallet page UI
        description: `Sent ${amount} ${selectedToken} to ${recipientAddress.substring(
          0,
          6
        )}...${recipientAddress.substring(38)}`,
        fromWalletAddress: businessAddress,
        toWalletAddress: recipientAddress,
        status: status,
        amount: Number(amount),
        token: selectedToken,
        transactionType: "withdrawal",
        timestamp: timestamp,
      });

      console.log(
        "Withdrawal transaction stored successfully in all collections"
      );
    } catch (error) {
      console.error("Error storing withdrawal transaction:", error);
      throw new Error("Failed to store withdrawal transaction");
    }
  };

  const handleSend = async () => {
    if (!signer || !recipientAddress) {
      console.error("Missing signer or recipient address");
      return;
    }

    if (!validateAddress(recipientAddress)) {
      console.error("Invalid recipient address");
      return;
    }

    if (!sendAmount || Number(sendAmount) <= 0) {
      console.error("Invalid withdrawal amount");
      return;
    }

    try {
      // Set initial pending status
      await storeWithdrawalTransaction(
        sendAmount,
        recipientAddress,
        "",
        "Pending"
      );

      const conv_amount = ethers.parseUnits(sendAmount, 6);

      try {
        const tx = await employerContract.transferByEmployer(
          recipientAddress,
          conv_amount
        );
        const receipt = await tx.wait();

        // Update with success status
        await storeWithdrawalTransaction(
          sendAmount,
          recipientAddress,
          receipt.hash,
          "Success",
          "null" + null,
          receipt.gasUsed?.toString()
        );

        console.log(`Successfully sent ${sendAmount} ${selectedToken}`);
        onClose();
      } catch (error) {
        console.error("Transaction failed:", error);

        // Update with failure status
        await storeWithdrawalTransaction(
          sendAmount,
          recipientAddress,
          "",
          "Failed",
          "failed to process" + error
        );
      }
    } catch (error) {
      console.error("Process failed:", error);
      await storeWithdrawalTransaction(
        sendAmount,
        recipientAddress,
        "",
        "Failed",
        "Process failed: " + error
      );
    }
  };

  //beautiful girls by sean kingstons
  //nice song
  // listen to it when working on this code

  // FUCK YOU AND YOUR FUCKING SEAN KINGSTONS.

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-50 flex items-center justify-center"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />

          {/* Modal Content - Positioned to the left */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-lg p-10 max-w-4xl z-50 overflow-hidden"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: "50%",
              left: "30%", // Moved left from center (was 50%)
              transform: "translate(-50%, -50%)",
              width: "80%",
              maxWidth: "800px",
            }}
          >
            {/* Close Button */}
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none"
              onClick={onClose}
              aria-label="Close"
            >
              <XCircle size={24} />
            </button>

            <h2 className="text-3xl font-semibold text-blue-800 mb-8">
              Send Crypto
            </h2>

            {/* Add Category Selection Dropdown */}
            <div className="mb-6">
              <label
                htmlFor="withdrawalCategory"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                Payment Category:
              </label>
              <select
                id="withdrawalCategory"
                className="shadow border rounded w-full py-3 px-4 text-gray-700 bg-white focus:outline-none focus:shadow-outline"
                value={withdrawalCategory}
                onChange={(e) => setWithdrawalCategory(e.target.value)}
              >
                {withdrawalCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Wallet Address Input */}
            <div className="mb-6">
              <label
                htmlFor="recipientAddress"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                Recipient Wallet Address:
              </label>
              <input
                type="text"
                id="recipientAddress"
                className={`shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                  !isAddressValid ? "border-red-500" : ""
                }`}
                placeholder="Enter wallet address (0x...)"
                value={recipientAddress}
                onChange={handleAddressChange}
              />
              {!isAddressValid && (
                <p className="text-red-500 text-sm mt-1">
                  Please enter a valid wallet address
                </p>
              )}
            </div>

            {/* Token Selection */}
            <div className="mb-6">
              <label
                htmlFor="tokenSelect"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                Select Token:
              </label>
              <div className="flex space-x-6">
                {["USDC", "ETH", "USDT"].map((token) => (
                  <label
                    key={token}
                    className="inline-flex items-center text-lg"
                  >
                    <input
                      type="radio"
                      className="form-radio h-6 w-6 text-blue-600 focus:ring-blue-500 focus:border-blue-500"
                      value={token}
                      checked={selectedToken === token}
                      onChange={() => setSelectedToken(token)}
                    />
                    <span className="ml-3 text-gray-700">{token}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-8">
              <label
                htmlFor="sendAmount"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                Amount:
              </label>
              <input
                type="number"
                id="sendAmount"
                className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="Enter amount to send"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-6">
              <button
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-6 rounded focus:outline-none focus:shadow-outline transition-colors text-lg"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded focus:outline-none focus:shadow-outline transition-colors flex items-center space-x-3 text-lg"
                onClick={handleSend}
                disabled={!isAddressValid || !sendAmount || !recipientAddress}
              >
                <Send size={20} />
                <span>Send</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WalletSendModal;
