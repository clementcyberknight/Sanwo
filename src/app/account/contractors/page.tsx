"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock,
  DollarSign,
  FileText,
  Filter,
  ChevronDown,
  Search,
  X,
  UserPlus,
  Trash2,
  Send,
  Loader2,
  Info,
  AlertTriangle,
} from "lucide-react";
import {
  auth,
  app,
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
  deleteDoc,
  writeBatch,
} from "@/app/config/FirebaseConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import EmployerPool from "../../../sc_/EmployeePoolAbi.json";
import { EmployerPoolContractAddress, linea_scan } from "../../../sc_/utils";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import {
  parseUnits,
  formatUnits,
  TransactionExecutionError,
  Address,
} from "viem";
import { lineaSepolia } from "viem/chains";

// --- Utility Functions ---
const showSuccessToast = (message: string) => {
  toast.success(message, {
    position: "top-right",
    autoClose: 4000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "colored",
  });
};

const showErrorToast = (message: string) => {
  toast.error(message, {
    position: "top-right",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "colored",
  });
};

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

const getModalPosition = (buttonRef) => {
  if (!buttonRef.current)
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  const rect = buttonRef.current.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  const isNearBottom = rect.bottom > viewportHeight - 300;

  if (isNearBottom) {
    return {
      top: "auto",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
    };
  }
  return {
    top: `${rect.bottom + window.scrollY + 10}px`,
    left: `${rect.left + rect.width / 2 + window.scrollX}px`,
    transform: "translateX(-50%)",
  };
};

// --- Firestore Data Handling for Payment ---

const createPendingContractorPayment = async (
  businessAddress: Address,
  contractorToPay: any,
  gasLimitEstimate: string | number
) => {
  if (!businessAddress || !contractorToPay || !contractorToPay.contractor_id) {
    throw new Error("Missing business address or contractor details.");
  }

  const db = getFirestore(app);
  const paymentId = `cp_${Date.now()}_${contractorToPay.contractor_id.slice(
    -4
  )}`;
  const timestamp = serverTimestamp();

  const payrollData = {
    payrollId: paymentId,
    payrollDate: timestamp,
    transactionHash: null,
    totalAmount: Number(contractorToPay.payment) || 0,
    payrollToken: "USDC",
    gasLimitEstimate: Number(gasLimitEstimate) || 0,
    payrollStatus: "Pending",
    businessId: businessAddress,
    payrollPeriod: new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    recipient: {
      contractorId: contractorToPay.contractor_id,
      recipientName: contractorToPay.contractor_name,
      recipientEmail: contractorToPay.contractor_email,
      recipientWalletAddress: contractorToPay.contractor_wallet,
      amount: Number(contractorToPay.payment) || 0,
    },
    category: "Contractor Payment",
    errorDetails: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    console.log(
      `Creating pending contractor payment record ${paymentId}...`,
      payrollData
    );
    const payrollRef = doc(
      db,
      `businesses/${businessAddress}/Contractor_payroll/${paymentId}`
    );
    await setDoc(payrollRef, payrollData);
    console.log(`Pending contractor payment record ${paymentId} created.`);
    return paymentId;
  } catch (firestoreError: any) {
    console.error(
      "Error storing PENDING contractor payment record:",
      firestoreError
    );
    throw new Error(
      `Failed to store pending payment record: ${firestoreError.message}`
    );
  }
};

const updateFinalContractorPayment = async (
  businessAddress: Address,
  paymentDocId: string,
  contractorId: string,
  status: "Success" | "Failed",
  txHash: string | null,
  error?: string
) => {
  if (!businessAddress || !paymentDocId || !contractorId) {
    console.error("Missing address, payment ID, or contractor ID for update.");
    return false;
  }

  const db = getFirestore(app);
  const paymentRef = doc(
    db,
    `businesses/${businessAddress}/Contractor_payroll/${paymentDocId}`
  );
  const contractorRef = doc(
    db,
    `businesses/${businessAddress}/contractors/${contractorId}`
  );
  const timestamp = serverTimestamp();
  const batch = writeBatch(db);

  const paymentUpdateData: any = {
    payrollStatus: status,
    transactionHash: txHash ?? null,
    errorDetails: error || null,
    updatedAt: timestamp,
  };

  batch.update(paymentRef, paymentUpdateData);

  if (status === "Success") {
    const historyRef = doc(
      db,
      `businesses/${businessAddress}/payments/${paymentDocId}`
    );
    const paymentDocSnap = await getDoc(paymentRef);
    if (paymentDocSnap.exists()) {
      const paymentData = paymentDocSnap.data();
      batch.set(historyRef, {
        amount: paymentData.totalAmount || 0,
        paymentId: paymentDocId,
        transactionId: paymentDocId,
        timestamp: timestamp,
        category: "Contractor Payment",
        status: "Success",
        transactionHash: txHash,
        recipientWalletAddress: paymentData.recipient?.recipientWalletAddress,
        recipientName: paymentData.recipient?.recipientName,
        businessId: businessAddress,
      });
      batch.update(contractorRef, { status: "Paid", updatedAt: timestamp });
    } else {
      console.warn(
        `Could not find payment record ${paymentDocId} to create history entry.`
      );
    }
  }

  try {
    console.log(
      `Updating contractor payment ${paymentDocId} to status: ${status}`,
      paymentUpdateData
    );
    await batch.commit();
    console.log(
      `Payment ${paymentDocId} and related records updated successfully.`
    );
    return true;
  } catch (firestoreError: any) {
    console.error(
      `Error updating payment record ${paymentDocId} to ${status}:`,
      firestoreError
    );
    throw new Error(
      `DB Update Failed: ${firestoreError.message}. Please check records manually.`
    );
  }
};

// --- Main Component ---
export default function ContractorPage() {
  const router = useRouter();

  // --- State ---
  const [activeTab, setActiveTab] = useState("CONTRACTOR LIST");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

  // Invite Contractor State
  const [contractorName, setContractorName] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [contractorRole, setContractorRole] = useState("");
  const [inviteContractorRole, setInviteContractorRole] = useState("");
  const [contractorPayment, setContractorPayment] = useState("");
  const [contractorNote, setContractorNote] = useState("");
  const [companyData, setCompanyData] = useState<any>(null);

  // Pay Contractor State
  const [paymentContractorEmail, setPaymentContractorEmail] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [contractorToPay, setContractorToPay] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string>("");
  const [pendingPaymentDocId, setPendingPaymentDocId] = useState<string | null>(
    null
  );
  const [gasLimitInput, setGasLimitInput] = useState<string>("200000");

  // General List State
  const [contractors, setContractors] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const account = useAccount();
  const businessAddress = account?.address;
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  // UI/Modal State
  const [showActionMenu, setShowActionMenu] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contractorToDelete, setContractorToDelete] = useState(null);
  const [editingContractorId, setEditingContractorId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    /* initial */
  });
  const [modalPosition, setModalPosition] = useState({});
  const [selectedContractor, setSelectedContractor] = useState(null);

  // Refs
  const actionMenuRef = useRef(null);
  const actionButtonRef = useRef(null);

  // --- Wagmi Hook for Contractor Payment ---
  const {
    writeContract: executeTransferByEmployer,
    isSuccess: transferSuccess,
    isPending: transferLoading,
    isError: transferError,
    error: transferWriteError,
    reset: resetTransfer,
    data: transferTxHash,
  } = useWriteContract();

  // --- Effects ---

  useEffect(() => {
    setIsLoadingAccount(true);
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setContractors([]);
        setCompanyData(null);
        setIsLoadingAccount(false);
        setIsLoadingData(false);
        if (!window.location.pathname.includes("/auth/login")) {
          router.push("/auth/login");
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (businessAddress) {
        const db = getFirestore(app);
        const companyDocRef = doc(db, "businesses", businessAddress);
        try {
          const docSnap = await getDoc(companyDocRef);
          if (docSnap.exists()) {
            setCompanyData(docSnap.data());
          } else {
            console.log("No company document found for:", businessAddress);
            setCompanyData(null);
            showErrorToast(
              "Business profile not found. Please complete setup."
            );
          }
        } catch (error) {
          console.error("Error fetching company data:", error);
          setCompanyData(null);
          showErrorToast("Error fetching business profile.");
        }
      } else {
        setCompanyData(null);
      }
    };
    if (firebaseUser) {
      fetchCompanyData();
    }
  }, [businessAddress, firebaseUser]);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    setIsLoadingData(true);

    if (firebaseUser && businessAddress) {
      const db = getFirestore(app);
      const userDocRef = doc(db, "users", firebaseUser.uid);

      getDoc(userDocRef)
        .then((docSnap) => {
          if (!docSnap.exists()) {
            showErrorToast("User record not found.");
            setIsLoadingData(false);
            setIsLoadingAccount(false);
            auth.signOut();
            router.push("/auth/login");
            return;
          }

          const userData = docSnap.data();
          const registeredAddress = userData?.wallet_address?.toLowerCase();
          const currentAddress = businessAddress.toLowerCase();

          if (registeredAddress !== currentAddress) {
            showErrorToast(
              "Connected wallet doesn't match registered account."
            );
            setIsLoadingData(false);
            setIsLoadingAccount(false);
            auth.signOut();
            router.push("/auth/login");
            return;
          }

          setIsLoadingAccount(false);

          const contractorsRef = collection(
            db,
            "businesses",
            businessAddress,
            "contractors"
          );
          unsubscribeSnapshot = onSnapshot(
            contractorsRef,
            (snapshot) => {
              const contractorsData = snapshot.docs.map((doc) => ({
                contractor_id: doc.id,
                ...doc.data(),
              }));
              setContractors(contractorsData);
              setIsLoadingData(false);
            },
            (error) => {
              console.error("Error fetching contractors:", error);
              showErrorToast(`Error fetching contractors: ${error.message}`);
              setIsLoadingData(false);
            }
          );
        })
        .catch((error) => {
          console.error("Error fetching user document:", error);
          showErrorToast("Error verifying user account.");
          setIsLoadingData(false);
          setIsLoadingAccount(false);
          auth.signOut();
          router.push("/auth/login");
        });
    } else {
      setContractors([]);
      setIsLoadingData(false);
      if (firebaseUser) setIsLoadingAccount(false);
    }

    return () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [firebaseUser, businessAddress, router]);

  // --- Handlers ---

  const handleAddContractor = async () => {
    if (
      !contractorName.trim() ||
      !contractorEmail.trim() ||
      !inviteContractorRole ||
      !contractorPayment
    ) {
      showErrorToast(
        "Please fill all required fields (Name, Email, Role, Payment)."
      );
      return;
    }
    const paymentNum = parseFloat(contractorPayment.replace(/[^0-9.-]+/g, ""));
    if (isNaN(paymentNum) || paymentNum <= 0) {
      showErrorToast("Please enter a valid positive payment amount.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contractorEmail)) {
      showErrorToast("Please enter a valid email address.");
      return;
    }
    if (!businessAddress || !firebaseUser) {
      showErrorToast("Authentication or wallet connection issue.");
      return;
    }
    if (
      contractors.some(
        (c) =>
          c.contractor_email?.toLowerCase() === contractorEmail.toLowerCase()
      )
    ) {
      showErrorToast("A contractor with this email already exists.");
      return;
    }
    if (!companyData || !companyData.name) {
      showErrorToast(
        "Business name not found. Please complete your business profile."
      );
      return;
    }

    const db = getFirestore(app);
    const contractor_id = `cont_${Date.now()}`;
    const inviteLink = `${window.location.origin}/contractor_connect/${firebaseUser.uid}/${contractor_id}`;

    const contractorData = {
      contractor_name: contractorName.trim(),
      inviteLink: inviteLink,
      businessId: firebaseUser.uid,
      contractor_id: contractor_id,
      businessname: companyData.name,
      contractor_email: contractorEmail.trim().toLowerCase(),
      role: inviteContractorRole,
      payment: paymentNum,
      status: "Invited",
      contractor_wallet: null,
      invitation_note: contractorNote.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const contractorRef = doc(
        db,
        "businesses",
        businessAddress,
        "contractors",
        contractor_id
      );
      await setDoc(contractorRef, contractorData);
      showSuccessToast("Contractor invited successfully!");

      setContractorName("");
      setContractorEmail("");
      setInviteContractorRole("");
      setContractorPayment("");
      setContractorNote("");
      setActiveTab("CONTRACTOR LIST");
    } catch (error: any) {
      console.error("Error adding contractor:", error);
      showErrorToast(`Error adding contractor: ${error.message}`);
    }
  };

  // --- Initiate Payment Process --- (Replaces most of old handlePayContractor)
  const initiatePaymentProcess = async () => {
    if (!contractorToPay || !businessAddress) {
      showErrorToast("Contractor details or business address missing.");
      return;
    }

    // --- Validation Checks ---
    if (contractorToPay.status === "Paid") {
      showErrorToast(`Already paid ${contractorToPay.contractor_name}.`);
      setShowConfirmation(false); // Close modal
      return;
    }
    if (
      contractorToPay.status === "Invited" ||
      !contractorToPay.contractor_wallet
    ) {
      showErrorToast(
        `${contractorToPay.contractor_name} hasn't connected their wallet or is not 'Active'.`
      );
      setShowConfirmation(false); // Close modal
      return;
    }
    const paymentAmount = Number(contractorToPay.payment);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      showErrorToast(
        `Invalid payment amount for ${contractorToPay.contractor_name}.`
      );
      setShowConfirmation(false);
      return;
    }
    const recipientAddress = contractorToPay.contractor_wallet as Address;
    if (
      !recipientAddress ||
      !recipientAddress.startsWith("0x") ||
      recipientAddress.length !== 42
    ) {
      showErrorToast(
        `Invalid wallet address for ${contractorToPay.contractor_name}.`
      );
      setShowConfirmation(false);
      return;
    }
    const gasLimitNum = Number(gasLimitInput);
    if (isNaN(gasLimitNum) || gasLimitNum <= 21000) {
      showErrorToast(
        "Invalid Gas Limit. Please enter a reasonable value (e.g., 200000)."
      );
      // Don't close confirmation yet, let them adjust gas
      return;
    }

    // --- Start Processing ---
    setIsProcessingPayment(true);
    setPaymentStatusMessage("Preparing payment...");
    setPendingPaymentDocId(null); // Clear previous pending ID
    resetTransfer(); // Reset wagmi hook state

    try {
      // --- 1. Prepare Data ---
      const parsedAmount = parseUnits(paymentAmount.toString(), 6); // Assuming 6 decimals for USDC

      // --- 2. Create Pending Firestore Record ---
      setPaymentStatusMessage("Creating pending payment record...");
      const newPaymentDocId = await createPendingContractorPayment(
        businessAddress,
        contractorToPay,
        gasLimitNum
      );
      setPendingPaymentDocId(newPaymentDocId); // Store for outcome handling

      // --- 3. Execute Blockchain Transaction ---
      setPaymentStatusMessage("Please approve transaction in wallet...");
      console.log(
        `Executing transferByEmployer: To=${recipientAddress}, Amount=${parsedAmount} units, Gas=${gasLimitNum}`
      );

      executeTransferByEmployer({
        address: EmployerPoolContractAddress as Address,
        abi: EmployerPool,
        functionName: "transferByEmployer",
        args: [recipientAddress, parsedAmount],
        chainId: lineaSepolia.id,
        gas: BigInt(gasLimitNum), // Use user-provided gas limit
        // Add gas price strategy if needed (maxFeePerGas, etc.)
      });
      // Now we wait for useEffect hooks to handle the outcome...
    } catch (error: any) {
      // Handle errors during preparation or initial DB write
      console.error("Error during payment initiation:", error);
      const errorMsg = error.message || "Failed to initiate payment.";
      setPaymentStatusMessage(`Error: ${errorMsg}`);
      showErrorToast(`Initiation Failed: ${errorMsg}`);

      // If a pending record was created, try to mark it as failed
      if (pendingPaymentDocId) {
        try {
          await updateFinalContractorPayment(
            businessAddress,
            pendingPaymentDocId,
            contractorToPay.contractor_id,
            "Failed",
            null,
            `Initiation Failed: ${errorMsg}`
          );
        } catch (updateError: any) {
          console.error(
            "Failed to mark pending record as failed:",
            updateError
          );
          setPaymentStatusMessage(
            `Initiation Failed (${errorMsg}). DB Update also failed. Check records.`
          );
        }
      }

      setIsProcessingPayment(false);
      setPendingPaymentDocId(null);
      resetTransfer();
    }
  };

  // --- useEffect for Transaction Success ---
  useEffect(() => {
    if (
      transferSuccess &&
      transferTxHash &&
      pendingPaymentDocId &&
      contractorToPay
    ) {
      console.log(
        "Contractor Payment Transaction Successful! Hash:",
        transferTxHash
      );
      setPaymentStatusMessage("Payment Successful! Updating records...");
      showSuccessToast("Blockchain transaction confirmed!");

      updateFinalContractorPayment(
        businessAddress!,
        pendingPaymentDocId,
        contractorToPay.contractor_id,
        "Success",
        transferTxHash
      )
        .then((dbSuccess) => {
          if (dbSuccess) {
            setPaymentStatusMessage("Payment records updated successfully!");
            // Success: Reset state, close modal after delay
            setTimeout(() => {
              setShowConfirmation(false);
              setIsProcessingPayment(false);
              setPaymentContractorEmail(""); // Reset dropdown
              setContractorToPay(null);
              setPendingPaymentDocId(null);
              setPaymentStatusMessage(""); // Clear message
            }, 2000); // 2 second delay
          }
        })
        .catch((dbError) => {
          console.error("DB Update failed after successful TX:", dbError);
          setPaymentStatusMessage(
            `Transaction successful, but DB update failed: ${dbError.message}`
          );
          showErrorToast(`Transaction successful, but DB update failed.`);
          // Don't close modal automatically, allow user to see the DB error status
          setIsProcessingPayment(false); // Allow interaction
        });
      // Don't reset state immediately, wait for DB update attempt
    }
  }, [
    transferSuccess,
    transferTxHash,
    pendingPaymentDocId,
    contractorToPay,
    businessAddress /* Removed redundant states like setContractorToPay etc */,
  ]);

  // --- useEffect for Transaction Error ---
  useEffect(() => {
    if (transferError && pendingPaymentDocId && contractorToPay) {
      const rawError = transferWriteError as any;
      let errorMsg = "Contractor payment transaction failed.";

      if (rawError instanceof TransactionExecutionError) {
        errorMsg = rawError.shortMessage || rawError.details || errorMsg;
      } else if (rawError instanceof Error) {
        errorMsg = rawError.message;
      }
      errorMsg =
        errorMsg.length > 150 ? errorMsg.substring(0, 147) + "..." : errorMsg;

      console.error(
        "Contractor Payment Transaction Failed:",
        transferWriteError
      );
      setPaymentStatusMessage(`Transaction Failed: ${errorMsg}`);
      showErrorToast(`Transaction Failed: ${errorMsg}`);

      // Update Firestore record to Failed
      updateFinalContractorPayment(
        businessAddress!,
        pendingPaymentDocId,
        contractorToPay.contractor_id,
        "Failed",
        transferTxHash ?? null, // Include hash if tx was broadcast before failing
        errorMsg
      ).catch((dbError) => {
        console.error("DB Update also failed after TX error:", dbError);
        setPaymentStatusMessage(
          `Transaction failed (${errorMsg}). DB update also failed.`
        );
      }); // We want to show the main TX error regardless of DB update status here.

      setIsProcessingPayment(false); // Stop processing
      setPendingPaymentDocId(null); // Clear pending ID
    }
  }, [
    transferError,
    transferWriteError,
    pendingPaymentDocId,
    contractorToPay,
    businessAddress,
    transferTxHash /* Include tx hash */,
  ]);

  // --- Other Handlers (Edit, Delete, Export, Filter, etc.) ---

  useEffect(() => {
    if (paymentContractorEmail) {
      const selected = contractors.find(
        (c) => c.contractor_email === paymentContractorEmail
      );
      // Reset contractorToPay if selected is invalid or not payable
      if (
        !selected ||
        selected.status === "Paid" ||
        selected.status === "Invited" ||
        !selected.contractor_wallet
      ) {
        // Optionally show a brief message if selecting an invalid one?
        // setPaymentStatusMessage("Selected contractor cannot be paid.");
        setContractorToPay(null);
      } else {
        setContractorToPay(selected);
        setPaymentStatusMessage(""); // Clear message on valid selection
      }
    } else {
      setContractorToPay(null); // Clear if dropdown is empty
    }
  }, [paymentContractorEmail, contractors]);

  // Confirmation Modal Trigger
  const handleConfirmPayment = () => {
    // contractorToPay is already set by the useEffect above
    if (contractorToPay) {
      // Double-check validity just before showing modal
      if (contractorToPay.status === "Paid") {
        showErrorToast(
          `${contractorToPay.contractor_name} has already been paid.`
        );
        return;
      }
      if (
        contractorToPay.status === "Invited" ||
        !contractorToPay.contractor_wallet
      ) {
        showErrorToast(
          `${contractorToPay.contractor_name} has not connected their wallet.`
        );
        return;
      }
      const paymentAmount = Number(contractorToPay.payment);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        showErrorToast(
          `Invalid payment amount configured for ${contractorToPay.contractor_name}. Please edit the contractor.`
        );
        return;
      }
      // All checks pass, show confirmation
      setShowConfirmation(true);
      setPaymentStatusMessage(""); // Clear any previous status
      resetTransfer(); // Reset wagmi state when opening modal
      setIsProcessingPayment(false); // Ensure not processing when opening modal
    } else if (paymentContractorEmail) {
      // Email selected, but contractor obj is invalid (e.g., paid, invited)
      showErrorToast("Selected contractor is not eligible for payment.");
    } else {
      showErrorToast("Please select a contractor to pay.");
    }
  };

  const handleCancelPayment = () => {
    setShowConfirmation(false);
    setContractorToPay(null); // Clear the selected contractor
    setPaymentContractorEmail(""); // Optionally reset the dropdown?
    setIsProcessingPayment(false); // Ensure processing stops
    setPaymentStatusMessage("");
    resetTransfer();
    setPendingPaymentDocId(null);
  };

  // Export List Handler (no major changes needed)
  const handleExportList = async () => {
    /* ... keep existing logic ... */
    setIsExporting(true);
    try {
      const csvData = contractors.map((contractor) => ({
        /* ... */
      }));
      const csv = Papa.unparse(csvData, { header: true });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "contractor_list.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccessToast("Contractor list exported!");
    } catch (error: any) {
      console.error("Error exporting:", error);
      showErrorToast(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // --- Edit/Delete Handlers --- (No major changes needed, ensure validity checks if editing payment amount)

  const handleEditClick = (contractor) => {
    setSelectedContractor(contractor);
    setEditingContractorId(contractor.contractor_id);
    setEditFormData({
      contractor_name: contractor.contractor_name || "",
      contractor_email: contractor.contractor_email || "",
      role: contractor.role || "",
      // Use String() for payment to handle potential numbers/nulls safely in input
      payment: String(contractor.payment ?? ""), // Handle potential null/undefined
      invitation_note: contractor.invitation_note || "",
      // DO NOT include wallet address or status in edit form
    });
    setShowEditModal(true);
    setShowActionMenu(null); // Close action menu if it was open
  };

  const handleDeleteClick = (contractor) => {
    setContractorToDelete(contractor);
    setShowDeleteModal(true);
    // Calculate and set modal position
    setModalPosition(getModalPosition(actionButtonRef)); // Ensure actionButtonRef is set on the parent element triggering delete
    setShowEditModal(false); // Close edit modal if open
    setShowActionMenu(null);
  };

  const handleEditSubmit = async () => {
    if (!editingContractorId || !businessAddress) {
      showErrorToast("Missing contractor ID or business context.");
      return;
    }
    // --- Validation ---
    if (
      !editFormData.contractor_name.trim() ||
      !editFormData.contractor_email.trim() ||
      !editFormData.role
    ) {
      showErrorToast("Name, Email, and Role are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.contractor_email)) {
      showErrorToast("Invalid email format.");
      return;
    }
    const paymentNum = parseFloat(
      String(editFormData.payment)?.replace(/[^0-9.-]+/g, "") ?? ""
    );
    if (isNaN(paymentNum) || paymentNum < 0) {
      // Allow 0 payment? Maybe should be > 0? Depends on use case.
      showErrorToast("Invalid payment amount. Must be a non-negative number.");
      return;
    }
    // Check for email uniqueness *excluding* the current contractor being edited
    const lowerCaseEmail = editFormData.contractor_email.trim().toLowerCase();
    if (
      contractors.some(
        (c) =>
          c.contractor_id !== editingContractorId &&
          c.contractor_email?.toLowerCase() === lowerCaseEmail
      )
    ) {
      showErrorToast("Another contractor already uses this email.");
      return;
    }

    // --- Update Firestore ---
    try {
      const db = getFirestore(app);
      const contractorRef = doc(
        db,
        "businesses",
        businessAddress,
        "contractors",
        editingContractorId
      );

      // Prepare update data - only fields allowed to be edited
      const updateData = {
        contractor_name: editFormData.contractor_name.trim(),
        contractor_email: lowerCaseEmail, // Store trimmed lowercase email
        role: editFormData.role,
        payment: paymentNum,
        invitation_note: editFormData.invitation_note.trim(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(contractorRef, updateData);

      showSuccessToast("Contractor updated successfully");
      setShowEditModal(false);
      setEditingContractorId(null);
      setSelectedContractor(null);

      // Local state update is handled automatically by the onSnapshot listener
    } catch (error: any) {
      console.error("Error updating contractor:", error);
      showErrorToast(`Update failed: ${error.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    /* ... keep existing logic ... */
    if (!contractorToDelete || !businessAddress) return;

    const db = getFirestore(app);
    const contractorRef = doc(
      db,
      "businesses",
      businessAddress,
      "contractors",
      contractorToDelete.contractor_id
    );

    try {
      await deleteDoc(contractorRef);
      showSuccessToast(`${contractorToDelete.contractor_name} deleted.`);
      setShowDeleteModal(false);
      setContractorToDelete(null);
      // Local state is updated by onSnapshot
    } catch (error: any) {
      console.error("Error deleting contractor:", error);
      showErrorToast(`Delete failed: ${error.message}`);
      setShowDeleteModal(false); // Close even on error
    }
  };

  // --- Helper Components & Data ---

  const FilterDropdown = ({ options, selected, onSelect, disabled }) => {
    // ... (keep existing FilterDropdown logic)
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const handleClickOutside = (event) => {
      /* ... */
    };
    useEffect(() => {
      /* ... */
    }, []);

    return (
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          type="button"
          className={`inline-flex justify-between items-center w-48 rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span>{selected || "All Roles"}</span>
          <ChevronDown size={16} className="-mr-1 ml-2" />
        </button>

        {/* Dropdown Panel */}
      </div>
    );
  };

  // Dropdown for selecting contractor to pay
  const ContractorSelect = ({ contractors, value, onChange, disabled }) => (
    <select
      className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md ${
        disabled ? "bg-gray-100 opacity-70 cursor-not-allowed" : "bg-white"
      }`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">Select contractor...</option>
      {/* Only list contractors who are 'Active' and have a wallet */}
      {contractors
        .filter(
          (c) =>
            c.status !== "Invited" &&
            c.status !== "Inactive" &&
            c.contractor_wallet
        ) // Filter for active/connected
        .map((contractor) => (
          <option
            key={contractor.contractor_id} // Use unique ID
            value={contractor.contractor_email} // Value remains email for selection logic
            disabled={contractor.status === "Paid"} // Disable if already paid
          >
            {contractor.contractor_name}
            {contractor.status === "Paid" ? " (Paid)" : ""}
          </option>
        ))}
    </select>
  );

  const Skeleton = () => (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        </td>
      ))}
    </tr>
  );

  const CONTRACTOR_ROLES = [
    "Freelancer",
    "Plumbing Repair",
    "Real Estate Agent",
    "Content Creator",
    "Graphic Designer",
    "Web Developer",
    "Consultant",
    "Other",
  ];

  // Calculate filtered list directly for rendering
  const getFilteredContractorsForDisplay = () => {
    let filtered = contractors;

    // Filter by selected Role (using contractorRole state for filtering)
    if (contractorRole) {
      filtered = filtered.filter((c) => c.role === contractorRole);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.contractor_name?.toLowerCase().includes(query) ||
          c.contractor_email?.toLowerCase().includes(query) ||
          c.role?.toLowerCase().includes(query) ||
          (c.contractor_wallet &&
            c.contractor_wallet.toLowerCase().includes(query)) || // Check if wallet exists
          formatCurrency(c.payment).toLowerCase().includes(query) ||
          c.status?.toLowerCase().includes(query)
      );
    }
    // Ensure inactive are generally hidden unless specifically searched for (maybe)
    // Default view might hide 'Inactive', adjust if needed
    // filtered = filtered.filter(c => c.status !== 'Inactive');

    return filtered;
  };

  // --- Render ---
  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-1">
            Contractor Management
          </h1>
          <p className="text-sm text-gray-500">
            Manage contractor invitations, details, and payments.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={handleExportList}
            disabled={isLoadingData || contractors.length === 0 || isExporting}
          >
            {isExporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            {isExporting ? "Exporting..." : "Export Report"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav
          className="-mb-px flex gap-6 sm:gap-8 overflow-x-auto"
          aria-label="Tabs"
        >
          {["CONTRACTOR LIST", "INVITE CONTRACTOR", "PAY CONTRACTOR"].map(
            (tab) => (
              <button
                key={tab}
                className={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors duration-150 ${
                  activeTab === tab
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => {
                  setActiveTab(tab);
                }}
                disabled={
                  isLoadingAccount ||
                  (isLoadingData && tab !== "INVITE CONTRACTOR")
                } // Allow invite even if list is loading
              >
                {tab}
              </button>
            )
          )}
        </nav>
      </div>

      {/* Content Area */}
      <div>
        {isLoadingAccount ? (
          <div className="text-center py-10 text-gray-500 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            Loading Account Information...
          </div>
        ) : (
          <>
            {/* --- CONTRACTOR LIST TAB CONTENT --- */}
            {activeTab === "CONTRACTOR LIST" && (
              <div className="space-y-5">
                {/* Controls Row */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  {/* Filters */}
                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    {/* Role Filter */}
                    <FilterDropdown
                      options={["All Roles", ...CONTRACTOR_ROLES]}
                      selected={contractorRole || "All Roles"}
                      onSelect={(selectedRole) =>
                        setContractorRole(
                          selectedRole === "All Roles" ? "" : selectedRole
                        )
                      }
                      disabled={isLoadingData}
                    />
                    {/* Status Filter (Optional) */}
                    {/* <FilterDropdown options={['All Statuses', 'Active', 'Invited', 'Paid', 'Inactive']} ... /> */}
                  </div>

                  {/* Search */}
                  <div className="relative flex-grow w-full sm:max-w-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:bg-gray-100"
                      placeholder="Search contractors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      disabled={isLoadingData}
                    />
                  </div>

                  {/* Invite Button */}
                  <div className="w-full sm:w-auto flex justify-end">
                    <button
                      className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={() => setActiveTab("INVITE CONTRACTOR")}
                    >
                      <UserPlus size={16} />
                      Invite Contractor
                    </button>
                  </div>
                </div>

                {/* Contractor Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {/* Headers */}
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Wallet Address
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Payment
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {isLoadingData ? (
                          [...Array(5)].map((_, i) => <Skeleton key={i} />)
                        ) : getFilteredContractorsForDisplay().length > 0 ? (
                          getFilteredContractorsForDisplay().map(
                            (contractor) => (
                              <tr
                                key={contractor.contractor_id}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                {/* Table Data Cells */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm font-medium text-gray-900">
                                    {contractor.contractor_name}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-xs text-gray-500 font-mono">
                                    {contractor.contractor_wallet
                                      ? `${contractor.contractor_wallet.substring(
                                          0,
                                          6
                                        )}...${contractor.contractor_wallet.substring(
                                          contractor.contractor_wallet.length -
                                            4
                                        )}`
                                      : "Not Connected"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm text-gray-600">
                                    {contractor.contractor_email}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm text-gray-700">
                                    {contractor.role}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm font-medium text-gray-800">
                                    {formatCurrency(contractor.payment)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                      contractor.status === "Paid"
                                        ? "bg-green-100 text-green-800"
                                        : contractor.status === "Active"
                                        ? "bg-blue-100 text-blue-800"
                                        : contractor.status === "Invited"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-gray-100 text-gray-800" // Default/Inactive
                                    }`}
                                  >
                                    {contractor.status}
                                  </span>
                                </td>
                                <td
                                  className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium"
                                  ref={actionButtonRef}
                                >
                                  {" "}
                                  {/* Ref needed for modal positioning */}
                                  <button
                                    onClick={() => handleEditClick(contractor)}
                                    className="text-indigo-600 hover:text-indigo-800 transition-colors"
                                    aria-label={`Edit ${contractor.contractor_name}`}
                                  >
                                    Edit
                                  </button>
                                  {/* Delete moved to Edit Modal */}
                                </td>
                              </tr>
                            )
                          )
                        ) : (
                          <tr>
                            <td
                              colSpan="7"
                              className="text-center p-6 text-sm text-gray-500"
                            >
                              {contractors.length === 0
                                ? "No contractors added yet."
                                : "No contractors match your filters."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- INVITE CONTRACTOR TAB CONTENT --- */}
            {activeTab === "INVITE CONTRACTOR" && (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Invite Contractor
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Fill in the details below to invite a new contractor via
                  email.
                </p>

                <div className="space-y-4">
                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="inviteName"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Full Name *
                      </label>
                      <input
                        id="inviteName"
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        value={contractorName}
                        onChange={(e) => setContractorName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="inviteEmail"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Email *
                      </label>
                      <input
                        id="inviteEmail"
                        type="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        value={contractorEmail}
                        onChange={(e) => setContractorEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="inviteRole"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Role *
                      </label>
                      <select
                        id="inviteRole"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        value={inviteContractorRole}
                        onChange={(e) =>
                          setInviteContractorRole(e.target.value)
                        }
                      >
                        <option value="">Select role...</option>
                        {CONTRACTOR_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="invitePayment"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Payment (USDC) *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          id="invitePayment"
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="e.g., 500.00"
                          value={contractorPayment}
                          onChange={(e) => setContractorPayment(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="inviteNote"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Invitation Note (Optional)
                    </label>
                    <textarea
                      id="inviteNote"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Add a short message for the contractor (included in email)"
                      value={contractorNote}
                      onChange={(e) => setContractorNote(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={() => setActiveTab("CONTRACTOR LIST")}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={handleAddContractor}
                    >
                      Invite Contractor
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- PAY CONTRACTOR TAB CONTENT --- */}
            {activeTab === "PAY CONTRACTOR" && (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Pay Contractor
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Select an active contractor with a connected wallet to
                  initiate payment.
                </p>

                <div className="space-y-4">
                  {/* Selection Fields */}
                  <div>
                    <label
                      htmlFor="payContractorSelect"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Contractor *
                    </label>
                    <ContractorSelect
                      id="payContractorSelect"
                      contractors={contractors}
                      value={paymentContractorEmail}
                      onChange={setPaymentContractorEmail}
                      disabled={isProcessingPayment || transferLoading} // Disable while processing
                    />
                  </div>
                  {contractorToPay && ( // Only show amount if a valid contractor is selected
                    <div>
                      <label
                        htmlFor="payAmount"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Amount (USDC)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          id="payAmount"
                          type="text"
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
                          value={formatCurrency(contractorToPay.payment)}
                          readOnly
                          disabled
                        />
                      </div>
                    </div>
                  )}
                  {/* Gas Limit Input */}
                  <div>
                    <label
                      htmlFor="payGasLimit"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Gas Limit *
                    </label>
                    <input
                      id="payGasLimit"
                      type="number"
                      value={gasLimitInput}
                      onChange={(e) => setGasLimitInput(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${
                        isProcessingPayment || transferLoading
                          ? "bg-gray-100 cursor-not-allowed"
                          : "border-gray-300"
                      }`}
                      placeholder="e.g., 200000"
                      min="21000"
                      step="1000"
                      disabled={isProcessingPayment || transferLoading}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Recommended: 150,000 - 300,000. Adjust if needed.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={() => setActiveTab("CONTRACTOR LIST")}
                      disabled={isProcessingPayment || transferLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors
                                       ${
                                         !contractorToPay ||
                                         isProcessingPayment ||
                                         transferLoading
                                           ? "bg-gray-400 cursor-not-allowed"
                                           : "bg-indigo-600 hover:bg-indigo-700"
                                       }`}
                      onClick={handleConfirmPayment}
                      disabled={
                        !contractorToPay ||
                        isProcessingPayment ||
                        transferLoading
                      }
                    >
                      {isProcessingPayment || transferLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      {isProcessingPayment || transferLoading
                        ? "Processing..."
                        : "Initiate Payment"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}

      {/* Payment Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && contractorToPay && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancelPayment} // Close on backdrop click
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
              <button
                onClick={handleCancelPayment}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
                disabled={isProcessingPayment || transferLoading}
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center">
                {/* Icon based on status */}
                {!isProcessingPayment && !transferLoading && !transferError && (
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                    <DollarSign className="text-indigo-600" size={24} />
                  </div>
                )}
                {(isProcessingPayment || transferLoading) && (
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                )}
                {transferError && !isProcessingPayment && (
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertTriangle className="text-red-600" size={24} />
                  </div>
                )}

                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  Confirm Payment
                </h2>

                {/* Static Confirmation Text */}
                {!paymentStatusMessage && !transferError && (
                  <p className="text-sm text-gray-600 mb-4">
                    Pay{" "}
                    <span className="font-medium">
                      {contractorToPay.contractor_name}
                    </span>{" "}
                    the amount of{" "}
                    <span className="font-semibold">
                      {formatCurrency(contractorToPay.payment)}
                    </span>{" "}
                    USDC?
                  </p>
                )}

                {/* Status/Error Message Area */}
                {paymentStatusMessage && (
                  <div
                    className={`text-sm mb-4 px-3 py-2 rounded-md w-full break-words ${
                      transferError
                        ? "bg-red-50 border border-red-200 text-red-700"
                        : "bg-blue-50 border border-blue-200 text-blue-700"
                    }`}
                  >
                    <p>{paymentStatusMessage}</p>
                    {transferTxHash && (
                      <a
                        href={`${linea_scan}/tx/${transferTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs font-medium underline hover:text-blue-900"
                      >
                        View on Block Explorer
                      </a>
                    )}
                  </div>
                )}

                {/* Gas Limit Display (ReadOnly during processing) */}
                <div className="w-full mb-5 text-left">
                  <label
                    htmlFor="confirmGasLimit"
                    className="block text-xs font-medium text-gray-500 mb-1"
                  >
                    Gas Limit
                  </label>
                  <input
                    id="confirmGasLimit"
                    type="number"
                    value={gasLimitInput}
                    onChange={(e) => setGasLimitInput(e.target.value)}
                    className={`w-full px-3 py-1.5 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isProcessingPayment || transferLoading || transferError
                        ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                        : "border-gray-300"
                    }`}
                    placeholder="e.g., 200000"
                    min="21000"
                    step="1000"
                    disabled={
                      isProcessingPayment || transferLoading || transferError
                    } // Disable on error too until explicitly cancelled/retried
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-3 w-full">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    onClick={handleCancelPayment}
                    disabled={isProcessingPayment || transferLoading} // Allow cancel unless processing HARD
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors
                                         ${
                                           isProcessingPayment ||
                                           transferLoading ||
                                           transferError
                                             ? "bg-gray-400 cursor-not-allowed"
                                             : "bg-green-600 hover:bg-green-700"
                                         }`}
                    onClick={initiatePaymentProcess} // Always calls the initiation
                    disabled={
                      isProcessingPayment || transferLoading || transferError
                    } // Disable if processing or error occurred
                  >
                    {isProcessingPayment || transferLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {isProcessingPayment || transferLoading
                      ? paymentStatusMessage.includes("wallet")
                        ? "Waiting..."
                        : "Processing..."
                      : "Confirm & Pay"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Contractor Modal */}
      <AnimatePresence>
        {showEditModal && selectedContractor && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEditModal(false)} // Close on backdrop click
          >
            <motion.div
              className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-semibold text-gray-800">
                  Edit Contractor
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Edit Form Fields */}
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label
                    htmlFor="editName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name *
                  </label>
                  <input
                    id="editName"
                    type="text"
                    value={editFormData.contractor_name}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        contractor_name: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editEmail"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email *
                  </label>
                  <input
                    id="editEmail"
                    type="email"
                    value={editFormData.contractor_email}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        contractor_email: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editRole"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Role *
                  </label>
                  <select
                    id="editRole"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    value={editFormData.role}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, role: e.target.value })
                    }
                  >
                    <option value="">Select role...</option>
                    {CONTRACTOR_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="editPayment"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Payment (USDC) *
                  </label>
                  <input
                    id="editPayment"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editFormData.payment}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        payment: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editNote"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Note
                  </label>
                  <textarea
                    id="editNote"
                    value={editFormData.invitation_note}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        invitation_note: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  ></textarea>
                </div>
                {/* Display Wallet and Status Readonly */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Wallet Address
                    </p>
                    <p className="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded break-all">
                      {selectedContractor.contractor_wallet || "Not Connected"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Status
                    </p>
                    <p
                      className={`text-sm font-medium px-2 py-1 rounded inline-block ${
                        selectedContractor.status === "Paid"
                          ? "bg-green-100 text-green-800"
                          : selectedContractor.status === "Active"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {selectedContractor.status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Edit Modal */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteClick(selectedContractor)} // Opens delete confirmation
                  className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm font-medium hover:bg-red-100 hover:border-red-300 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  Delete
                </button>

                {/* Cancel and Save Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSubmit}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && contractorToDelete && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4" // Higher z-index than edit modal
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteModal(false)} // Close on backdrop click
          >
            <motion.div
              className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()} // Prevent close on inner click
            >
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                Delete Contractor?
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-medium">
                  {contractorToDelete.contractor_name}
                </span>
                ? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div> // End main container
  );
}
