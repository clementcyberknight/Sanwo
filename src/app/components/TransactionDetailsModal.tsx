"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink } from "lucide-react";

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
}

const TransactionDetailsModal = ({
  isOpen,
  onClose,
  transaction,
}: TransactionDetailsModalProps) => {
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const formatDate = (dateValue: any) => {
    try {
      if (typeof dateValue === "object" && "seconds" in dateValue) {
        // Handle Firebase Timestamp
        return new Date(dateValue.seconds * 1000).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      } else if (dateValue instanceof Date) {
        return dateValue.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      } else if (typeof dateValue === "string") {
        return new Date(dateValue).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
      return "Invalid date";
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Transaction Details
                  </h3>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem
                    label="Transaction Type"
                    value={
                      transaction.type === "deposit" ? "Deposit" : "Withdrawal"
                    }
                  />
                  <DetailItem
                    label="Amount"
                    value={`${
                      transaction.depositAmount || transaction.amount
                    } ${transaction.depositToken || transaction.token}`}
                  />
                  <DetailItem
                    label="Status"
                    value={transaction.depositStatus || transaction.status}
                  />
                  <DetailItem
                    label="Date"
                    value={formatDate(transaction.createdAt)}
                  />
                  <DetailItem label="Category" value={transaction.category} />
                  <DetailItem
                    label="Transaction Hash"
                    value={
                      <a
                        href={`https://explorer.sepolia.linea.build/tx/${transaction.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center"
                      >
                        {`${transaction.transactionHash.slice(
                          0,
                          6
                        )}...${transaction.transactionHash.slice(-4)}`}
                        <ExternalLink size={14} className="ml-1" />
                      </a>
                    }
                  />
                </div>

                {transaction.errorDetails && (
                  <div className="mt-4 p-4 bg-red-50 rounded-lg">
                    <h4 className="text-sm font-medium text-red-800 mb-2">
                      Error Details
                    </h4>
                    <p className="text-sm text-red-600">
                      {transaction.errorDetails}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const DetailItem = ({ label, value }: { label: string; value: any }) => (
  <div className="p-4 bg-gray-50 rounded-lg">
    <div className="text-sm text-gray-500 mb-1">{label}</div>
    <div className="font-medium text-gray-800">{value}</div>
  </div>
);

export default TransactionDetailsModal;
