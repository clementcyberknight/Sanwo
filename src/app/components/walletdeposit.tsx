"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ExternalProvider } from "@ethersproject/providers";
import { MockUSDC, abi, payWorkers } from "@/sc_stylus/scabi";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, Download } from "lucide-react";
import {
  db,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
} from "@/app/config/FirebaseConfig";
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
const WalletDepositModal = ({ isOpen, onClose }) => {
  const [depositAmount, setDepositAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("USDC"); // Default to USDC
  const [depositCategory, setDepositCategory] = useState("revenue"); // Add this state
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<any>(null);
  const [employerContract, setEmployerContract] = useState<any>(null);
  const Account = useAccount();
  const Companyaddress = Account?.address;

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
  const TOKEN_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ];

  const storeDepositTransaction = async (
    amount: string,
    category: string,
    token: string,
    txHash: string,
    status: "Success" | "Failed",
    error?: string
  ) => {
    if (!Companyaddress) {
      console.error("No business address found");
      return;
    }

    try {
      const timestamp = serverTimestamp();
      const depositId = Date.now().toString();
      const fromAddress = await signer.getAddress();

      // Add to payments collection with consistent structure
      const paymentsRef = doc(
        db,
        `businesses/${Companyaddress}/payments/${depositId}`
      );
      await setDoc(paymentsRef, {
        amount: Number(amount),
        depositId,
        transactionId: depositId,
        category: "deposit",
        status: status,
        transactionHash: txHash,
        timestamp: timestamp,
      });

      // Add to deposits collection (keeping existing structure)
      const depositsRef = collection(
        db,
        `businesses/${Companyaddress}/deposits`
      );
      await addDoc(depositsRef, {
        depositId,
        depositDate: timestamp,
        depositAmount: Number(amount),
        category,
        depositToken: token,
        businessId: Companyaddress,
        fromWalletAddress: fromAddress,
        transactionHash: txHash,
        depositStatus: status,
        gasFees: null,
        errorDetails: error || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // Add to walletTransactions collection for wallet page UI
      const walletTransactionsRef = collection(
        db,
        `businesses/${Companyaddress}/walletTransactions`
      );
      await addDoc(walletTransactionsRef, {
        id: depositId,
        type: "deposit",
        depositAmount: Number(amount),
        depositToken: token,
        depositStatus: status,
        category: category,
        transactionHash: txHash,
        createdAt: timestamp,
        depositDate: timestamp,
        fromWalletAddress: fromAddress,
        errorDetails: error || null,
        // Additional fields needed for wallet page UI
        description: `Deposited ${amount} ${token} from ${fromAddress.substring(
          0,
          6
        )}...${fromAddress.substring(38)}`,
        toWalletAddress: Companyaddress,
        status: status,
        amount: Number(amount),
        token: token,
        transactionType: "deposit",
        timestamp: timestamp,
        // Fields for transaction details modal
        gasFees: null,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        },
        // Match the structure expected by the wallet page
        businessId: Companyaddress,
        updatedAt: timestamp,
      });

      console.log("Deposit transaction stored successfully in all collections");
    } catch (error) {
      console.error("Error storing deposit transaction:", error);
      throw new Error("Failed to store deposit transaction");
    }
  };

  const handleDeposit = async () => {
    if (!signer) {
      console.error("No signer found");
      return;
    }

    if (!depositAmount || Number(depositAmount) <= 0) {
      console.error("Invalid deposit amount");
      return;
    }

    try {
      const conv_deposit = ethers.parseUnits(depositAmount, 6);

      // First approve the deposit
      try {
        const tokenContract = new ethers.Contract(MockUSDC, TOKEN_ABI, signer);
        const approveTx = await tokenContract.approve(payWorkers, conv_deposit);
        await approveTx.wait();
        console.log("Deposit approved successfully");
      } catch (error) {
        //@ts-ignore
        console.error("Approval failed:", error.message);
        await storeDepositTransaction(
          depositAmount,
          depositCategory,
          selectedToken,
          "",
          "Failed",
          //@ts-ignore
          "Approval failed: " + error.message
        );
        return;
      }

      // Then make the deposit
      try {
        const tx = await employerContract.deposit(conv_deposit);
        const receipt = await tx.wait();

        // Store successful transaction
        await storeDepositTransaction(
          depositAmount,
          depositCategory,
          selectedToken,
          receipt.hash,
          "Success"
        );

        console.log(`Successfully deposited ${depositAmount} ${selectedToken}`);
        onClose();
      } catch (error) {
        //@ts-ignore
        console.error("Deposit failed:", error.message);
        await storeDepositTransaction(
          depositAmount,
          depositCategory,
          selectedToken,
          "",
          "Failed",
          //@ts-ignore
          "Deposit failed: " + error.message
        );
      }
    } catch (error) {
      //@ts-ignore
      console.error("Transaction failed:", error.message);
      await storeDepositTransaction(
        depositAmount,
        depositCategory,
        selectedToken,
        "",
        "Failed",
        //@ts-ignore
        "Transaction failed: " + error.message
      );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 z-50 flex items-center justify-center" //Darker opacity for backdrop
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose} // Close when clicking outside the modal
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />

          {/* Modal Content - Black background and white text */}
          <motion.div
            className="relative bg-gray-900 text-white rounded-2xl shadow-lg p-10 max-w-4xl z-50 overflow-hidden" // Dark background and white text
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()} // Prevent backdrop click from closing
            style={{
              position: "fixed",
              top: "50%",
              left: "30%", // Moved left from center (was 50%)
              transform: "translate(-50%, -50%)",
              width: "80%",
              maxWidth: "800px",
            }}
          >
            {/* Close Button - White color for visibility */}
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 focus:outline-none" //White close button
              onClick={onClose}
              aria-label="Close"
            >
              <XCircle size={24} />
            </button>

            <h2 className="text-3xl font-semibold text-white mb-8">
              Deposit Crypto
            </h2>

            {/* Category Selection Dropdown - Adjusted styles for dark background */}
            <div className="mb-6">
              <label
                htmlFor="depositCategory"
                className="block text-gray-300 text-sm font-bold mb-2" // Light gray label text
              >
                Deposit Category:
              </label>
              <select
                id="depositCategory"
                className="shadow border rounded w-full py-3 px-4 text-gray-300 bg-gray-800 focus:outline-none focus:shadow-outline" // Adjusted input styles for dark theme
                value={depositCategory}
                onChange={(e) => setDepositCategory(e.target.value)}
              >
                <option value="revenue">Revenue</option>
                <option value="payroll">Payroll Deposit</option>
                <option value="loan">Loan</option>
                <option value="investment">Investment</option>
                <option value="refund">Refund</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Amount Input - Adjusted styles for dark background */}
            <div className="mb-6">
              <label
                htmlFor="depositAmount"
                className="block text-gray-300 text-sm font-bold mb-2" // Light gray label text
              >
                Amount:
              </label>
              <input
                type="number"
                id="depositAmount"
                className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-300 leading-tight focus:outline-none focus:shadow-outline bg-gray-800" // Adjusted input styles for dark theme
                placeholder="Enter amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </div>

            {/* Token Selection - White text for labels */}
            <div className="mb-8">
              <label
                htmlFor="tokenSelect"
                className="block text-gray-300 text-sm font-bold mb-2" // Light gray label text
              >
                Select Token:
              </label>
              <div className="flex space-x-6">
                {["USDC", "ETH", "USDT"].map((token) => (
                  <label
                    key={token}
                    className="inline-flex items-center text-lg text-white" // White text for token labels
                  >
                    <input
                      type="radio"
                      className="form-radio h-6 w-6 text-blue-600 focus:ring-blue-500 focus:border-blue-500"
                      value={token}
                      checked={selectedToken === token}
                      onChange={() => setSelectedToken(token)}
                    />
                    <span className="ml-3 text-gray-300">{token}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Action Buttons - Adjusted button styles for dark theme */}
            <div className="flex justify-end space-x-6">
              <button
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded focus:outline-none focus:shadow-outline transition-colors text-lg" // Darker button background
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 px-6 rounded focus:outline-none focus:shadow-outline transition-colors flex items-center space-x-3 text-lg" // Adjusted blue button style
                onClick={handleDeposit}
                disabled={!depositAmount}
              >
                <Download size={20} />
                <span>Deposit</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WalletDepositModal;
