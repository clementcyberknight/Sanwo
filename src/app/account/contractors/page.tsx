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
  Timestamp,
  FieldValue,
} from "@/app/config/FirebaseConfig";
import { User } from "firebase/auth";
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

interface Contractor {
  contractor_id: string;
  contractor_name: string;
  contractor_email: string;
  role: string;
  payment: number;
  status: "Invited" | "Active" | "Paid" | "Inactive" | string;
  contractor_wallet: Address | null;
  invitation_note?: string;
  inviteLink?: string;
  businessId?: string;
  businessname?: string;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  [key: string]: any;
}

interface CompanyData {
  name: string;
  [key: string]: any;
}

interface EditFormData {
  contractor_name: string;
  contractor_email: string;
  role: string;
  payment: string;
  invitation_note: string;
}

interface ModalPositionStyle {
  top?: string | number;
  left?: string | number;
  bottom?: string | number;
  transform?: string;
}

// --- Define Default Gas Limit ---
const DEFAULT_GAS_LIMIT = BigInt(200000); // For viem/wagmi transaction
const DEFAULT_GAS_LIMIT_NUMBER = 200000; // For Firestore storage (as Number)
// --- End Define Default Gas Limit ---


const showSuccessToast = (message: string) => {
  toast.success(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "light",
  });
};

const showErrorToast = (message: string) => {
  toast.error(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "light",
  });
};

const formatCurrency = (amount: string | number | null | undefined): string => {
  if (amount === null || amount === undefined) {
    return "N/A";
  }
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

const getModalPosition = (
  buttonRef: React.RefObject<HTMLElement | null>
): ModalPositionStyle => {
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

const createPendingContractorPayment = async (
  businessAddress: Address,
  contractorToPay: Contractor,
  gasLimitEstimate: number // Kept receiving number type as before
): Promise<string> => {
  if (!businessAddress || !contractorToPay || !contractorToPay.contractor_id) {
    throw new Error("Missing business address or contractor details.");
  }

  const db = getFirestore(app);
  const paymentId = `cp_${Date.now()}_${contractorToPay.contractor_id.slice(
    -4
  )}`;
  const timestamp = serverTimestamp();

  const payrollData: { [key: string]: any } = {
    payrollId: paymentId,
    payrollDate: timestamp,
    transactionHash: null,
    totalAmount: Number(contractorToPay.payment) || 0,
    payrollToken: "USDC",
    gasLimitEstimate: Number(gasLimitEstimate) || 0, // Store the provided number
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
): Promise<boolean> => {
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

  const paymentUpdateData: { [key: string]: any } = {
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
        amount: paymentData?.totalAmount || 0,
        paymentId: paymentDocId,
        transactionId: paymentDocId,
        timestamp: timestamp,
        category: "Contractor Payment",
        status: "Success",
        transactionHash: txHash,
        recipientWalletAddress: paymentData?.recipient?.recipientWalletAddress,
        recipientName: paymentData?.recipient?.recipientName,
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

export default function ContractorPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<string>("CONTRACTOR LIST");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isLoadingAccount, setIsLoadingAccount] = useState<boolean>(true);

  const [contractorName, setContractorName] = useState<string>("");
  const [contractorEmail, setContractorEmail] = useState<string>("");
  const [contractorRole, setContractorRole] = useState<string>("");
  const [inviteContractorRole, setInviteContractorRole] = useState<string>("");
  const [contractorPayment, setContractorPayment] = useState<string>("");
  const [contractorNote, setContractorNote] = useState<string>("");
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);

  const [paymentContractorEmail, setPaymentContractorEmail] =
    useState<string>("");
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [contractorToPay, setContractorToPay] = useState<Contractor | null>(
    null
  );
  const [isProcessingPayment, setIsProcessingPayment] =
    useState<boolean>(false);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string>("");
  const [pendingPaymentDocId, setPendingPaymentDocId] = useState<string | null>(
    null
  );
  // REMOVED: const [gasLimitInput, setGasLimitInput] = useState<string>("200000");

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const account = useAccount();
  const businessAddress = account?.address;
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [contractorToDelete, setContractorToDelete] =
    useState<Contractor | null>(null);
  const [editingContractorId, setEditingContractorId] = useState<string | null>(
    null
  );
  const [editFormData, setEditFormData] = useState<EditFormData>({
    contractor_name: "",
    contractor_email: "",
    role: "",
    payment: "",
    invitation_note: "",
  });
  const [modalPosition, setModalPosition] = useState<ModalPositionStyle>({});
  const [selectedContractor, setSelectedContractor] =
    useState<Contractor | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLTableCellElement>(null);

  const {
    writeContract: executeTransferByEmployer,
    isSuccess: transferSuccess,
    isPending: transferLoading,
    isError: transferError,
    error: transferWriteError,
    reset: resetTransfer,
    data: transferTxHash,
  } = useWriteContract();

  useEffect(() => {
    setIsLoadingAccount(true);
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setContractors([]);
        setCompanyData(null);
        setIsLoadingAccount(false);
        setIsLoadingData(false);
        router.push("/auth/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (businessAddress) {
        const db = getFirestore(app);
        //@ts-ignore
        const companyDocRef = doc<CompanyData>(
          db,
          "businesses",
          businessAddress
        );
        try {
          const docSnap = await getDoc(companyDocRef);
          if (docSnap.exists()) {
            //@ts-ignore
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
            if (router) router.push("/auth/login");
            return;
          }

          const userData = docSnap.data();
          const registeredAddress = userData?.wallet_address?.toLowerCase();
          const currentAddress = businessAddress.toLowerCase();

          if (!registeredAddress || registeredAddress !== currentAddress) {
            showErrorToast(
              registeredAddress
                ? "Connected wallet doesn't match registered account."
                : "User wallet address not found in profile."
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
                contractor_name: doc.data().contractor_name ?? "",
                contractor_email: doc.data().contractor_email ?? "",
                role: doc.data().role ?? "",
                payment: Number(doc.data().payment ?? 0),
                status: doc.data().status ?? "Inactive",
                contractor_wallet: doc.data().contractor_wallet ?? null,
              })) as Contractor[];
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
          if (router) router.push("/auth/login");
        });
    } else {
      setContractors([]);
      setIsLoadingData(false);
      if (!businessAddress && firebaseUser) {
        setIsLoadingAccount(false);
      }
    }

    return () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [firebaseUser, businessAddress, router]);

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
      showErrorToast(
        "Authentication or wallet connection issue. Please reconnect wallet and refresh."
      );
      return;
    }
    if (
      contractors.some(
        (c) =>
          c.contractor_email?.toLowerCase() ===
          contractorEmail.trim().toLowerCase()
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
    const inviteLink =
      typeof window !== "undefined"
        ? `${window.location.origin}/contractor_connect/${businessAddress}/${contractor_id}`
        : "";

    const contractorData: Partial<Contractor> & {
      createdAt: FieldValue;
      updatedAt: FieldValue;
    } = {
      contractor_name: contractorName.trim(),
      inviteLink: inviteLink,
      businessId: businessAddress,
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
      const { contractor_id: idToRemove, ...dataToSet } = contractorData;
      await setDoc(contractorRef, dataToSet);

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

  const initiatePaymentProcess = async () => {
    if (!contractorToPay || !businessAddress) {
      showErrorToast(
        "Contractor details or business address missing. Please select a contractor."
      );
      setIsProcessingPayment(false);
      return;
    }

    // Basic checks (moved earlier)
    if (contractorToPay.status === "Paid") {
      showErrorToast(`Already paid ${contractorToPay.contractor_name}.`);
      setShowConfirmation(false); // Close modal if accidentally opened
      return;
    }
    if (
      contractorToPay.status === "Invited" ||
      !contractorToPay.contractor_wallet
    ) {
      showErrorToast(
        `${contractorToPay.contractor_name} hasn't connected their wallet or is not 'Active'.`
      );
       setShowConfirmation(false); 
       return;
    }
    const paymentAmount = Number(contractorToPay.payment);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      showErrorToast(
        `Invalid payment amount (${contractorToPay.payment}) for ${contractorToPay.contractor_name}.`
      );
       setShowConfirmation(false);
       return;
    }

    setIsProcessingPayment(true);
    setPaymentStatusMessage("Preparing payment...");
    setPendingPaymentDocId(null);
    resetTransfer();

    try {
      const parsedAmount = parseUnits(paymentAmount.toString(), 6); 
      const recipientAddress = contractorToPay.contractor_wallet;

      setPaymentStatusMessage("Creating pending payment record...");
      const newPaymentDocId = await createPendingContractorPayment(
        businessAddress,
        contractorToPay,
        DEFAULT_GAS_LIMIT_NUMBER
      );
      setPendingPaymentDocId(newPaymentDocId);

      setPaymentStatusMessage("Please approve transaction in wallet...");
      console.log(
        `Executing transferByEmployer: To=${recipientAddress}, Amount=${parsedAmount} units, Gas=${DEFAULT_GAS_LIMIT}`
      );

      executeTransferByEmployer({
        address: EmployerPoolContractAddress as Address,
        abi: EmployerPool,
        functionName: "transferByEmployer",
        args: [recipientAddress, parsedAmount],
        chainId: lineaSepolia.id,
        gas: DEFAULT_GAS_LIMIT,
      });
    } catch (error: any) {
      console.error("Error during payment initiation:", error);
      const errorMsg = error.message || "Failed to initiate payment.";
      setPaymentStatusMessage(`Error: ${errorMsg}`);
      showErrorToast(`Initiation Failed: ${errorMsg}`);

      if (pendingPaymentDocId && businessAddress) {
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
            "Failed to mark pending record as failed after initiation error:",
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

  useEffect(() => {
    if (
      transferSuccess &&
      transferTxHash &&
      pendingPaymentDocId &&
      contractorToPay &&
      businessAddress
    ) {
      console.log(
        "Contractor Payment Transaction Successful! Hash:",
        transferTxHash
      );
      setPaymentStatusMessage("Payment Successful! Updating records...");
      showSuccessToast("Blockchain transaction confirmed!");

      updateFinalContractorPayment(
        businessAddress,
        pendingPaymentDocId,
        contractorToPay.contractor_id,
        "Success",
        transferTxHash
      )
        .then((dbSuccess) => {
          if (dbSuccess) {
            setPaymentStatusMessage("Payment records updated successfully!");
            setTimeout(() => {
              setShowConfirmation(false);
              setIsProcessingPayment(false);
              setPaymentContractorEmail(""); 
              setContractorToPay(null);
              setPendingPaymentDocId(null);
              setPaymentStatusMessage("");
            }, 2000);
          } else {
  
            console.error(
              "DB Update reported failure after successful TX, but didn't throw."
            );
            setPaymentStatusMessage(
              `Transaction successful (${transferTxHash.substring(0, 10)}...), but DB update failed.`
            );
            showErrorToast(`Transaction successful, but DB update failed.`);
            setIsProcessingPayment(false); 
          }
        })
        .catch((dbError: any) => {
          console.error("DB Update failed after successful TX:", dbError);
          setPaymentStatusMessage(
            `Transaction successful (${transferTxHash.substring(0, 10)}...), but DB update failed: ${dbError.message}`
          );
          showErrorToast(
            `Transaction successful, but DB update failed: ${dbError.message}`
          );
          setIsProcessingPayment(false); 
        });
    }
  }, [
    transferSuccess,
    transferTxHash,
    pendingPaymentDocId,
    contractorToPay,
    businessAddress,
  ]);

  useEffect(() => {
    if (
      transferError &&
      pendingPaymentDocId &&
      contractorToPay &&
      businessAddress
    ) {
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

      updateFinalContractorPayment(
        businessAddress,
        pendingPaymentDocId,
        contractorToPay.contractor_id,
        "Failed",
        transferTxHash ?? null, 
        errorMsg 
      ).catch((dbError: any) => {
        console.error("DB Update also failed after TX error:", dbError);
        setPaymentStatusMessage(
          `Transaction failed (${errorMsg}). DB update also failed: ${dbError.message}`
        );
        showErrorToast(
          `Transaction failed and DB update also failed: ${dbError.message}`
        );
      });

      setIsProcessingPayment(false);
  }
  }, [
    transferError,
    transferWriteError,
    pendingPaymentDocId,
    contractorToPay,
    businessAddress,
    transferTxHash,
  ]);

  useEffect(() => {
    if (paymentContractorEmail) {
      const selected = contractors.find(
        (c) => c.contractor_email === paymentContractorEmail
      );
     if (selected && selected.status === "Active" && selected.contractor_wallet) {
        //@ts-ignore
        if (selected.status !== "Paid") {
            setContractorToPay(selected);
            setPaymentStatusMessage(""); 
          } else {
             setContractorToPay(null);
             setPaymentStatusMessage("Selected contractor has already been paid.");
        }
      } else {
        setContractorToPay(null);
        if (selected) {
          if (selected.status === "Paid")
            setPaymentStatusMessage(
              "Selected contractor has already been paid."
            );
          else if (selected.status === "Invited")
            setPaymentStatusMessage(
              "Selected contractor has not accepted the invite yet."
            );
          else if (!selected.contractor_wallet)
            setPaymentStatusMessage(
              "Selected contractor has not connected their wallet."
            );
          else if (selected.status === "Inactive")
            setPaymentStatusMessage(
              "Selected contractor is currently Inactive."
            );
          else
              setPaymentStatusMessage("Selected contractor is not eligible for payment.");

        } else {
           setPaymentStatusMessage("");
        }
      }
    } else {
     
      setContractorToPay(null);
      setPaymentStatusMessage("");
    }
  }, [paymentContractorEmail, contractors]);

  const handleConfirmPayment = () => {
   if (contractorToPay) {
     if (contractorToPay.status === "Paid") {
            showErrorToast(`${contractorToPay.contractor_name} has already been paid.`);
            return;
       }
       if (contractorToPay.status !== "Active" || !contractorToPay.contractor_wallet) {
           showErrorToast(`${contractorToPay.contractor_name} is not eligible (Status: ${contractorToPay.status}, Wallet: ${contractorToPay.contractor_wallet ? 'Connected' : 'Missing'}).`);
           return;
       }
        const paymentAmount = Number(contractorToPay.payment);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            showErrorToast(
            `Invalid payment amount for ${contractorToPay.contractor_name}. Please edit the contractor first.`
            );
            return;
        }

      setShowConfirmation(true);
      setPaymentStatusMessage(""); 
      resetTransfer(); 
      setIsProcessingPayment(false); 
      setPendingPaymentDocId(null); 
    } else if (paymentContractorEmail) {
      showErrorToast(paymentStatusMessage || "Selected contractor is not eligible for payment.");
    } else {
      showErrorToast("Please select a contractor to pay.");
    }
  };

  const handleCancelPayment = () => {
    setShowConfirmation(false);
    setIsProcessingPayment(false);
    setPaymentStatusMessage("");
    resetTransfer();
    setPendingPaymentDocId(null);
  };

  const handleExportList = async () => {
    if (isExporting || contractors.length === 0) return;
    setIsExporting(true);
    try {
      const filteredContractors = getFilteredContractorsForDisplay();
       if (filteredContractors.length === 0) {
           showErrorToast("No contractors match the current filters to export.");
           setIsExporting(false);
           return;
       }
      const csvData = filteredContractors.map((contractor) => ({
        Name: contractor.contractor_name,
        Email: contractor.contractor_email,
        "Wallet Address": contractor.contractor_wallet ?? "N/A",
        Role: contractor.role,
        "Payment Amount (USD)": contractor.payment,
        Status: contractor.status,
        "Invitation Note": contractor.invitation_note ?? "",
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
      URL.revokeObjectURL(url);
      showSuccessToast("Filtered contractor list exported!");
    } catch (error: any) {
      console.error("Error exporting:", error);
      showErrorToast(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleEditClick = (contractor: Contractor) => {
    setSelectedContractor(contractor);
    setEditingContractorId(contractor.contractor_id);
    setEditFormData({
      contractor_name: contractor.contractor_name || "",
      contractor_email: contractor.contractor_email || "",
      role: contractor.role || "",
      payment: String(contractor.payment ?? ""),
      invitation_note: contractor.invitation_note || "",
    });
    setShowEditModal(true);
    setShowActionMenu(null);
  };

  const handleDeleteClick = (contractor: Contractor) => {
    setContractorToDelete(contractor);
    setShowDeleteModal(true);
    setShowEditModal(false);
    setShowActionMenu(null);
  };

  const handleEditSubmit = async () => {
    if (!editingContractorId || !businessAddress) {
      showErrorToast("Missing contractor ID or business context.");
      return;
    }

    const name = editFormData.contractor_name.trim();
    const email = editFormData.contractor_email.trim().toLowerCase();
    const role = editFormData.role; 
    const paymentString = editFormData.payment;
    const note = editFormData.invitation_note.trim();

    if (!name || !email || !role) {
      showErrorToast("Name, Email, and Role are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showErrorToast("Invalid email format.");
      return;
    }
    const paymentNum = parseFloat(paymentString.replace(/[^0-9.-]+/g, ""));
    if (isNaN(paymentNum) || paymentNum < 0) { // Allow 0 payment? Yes, maybe for specific roles. Changed from > 0.
      showErrorToast("Invalid payment amount. Must be a non-negative number.");
      return;
    }

    if (
      contractors.some(
        (c) =>
          c.contractor_id !== editingContractorId &&
          c.contractor_email?.toLowerCase() === email
      )
    ) {
      showErrorToast("Another contractor already uses this email.");
      return;
    }

    try {
      const db = getFirestore(app);
      const contractorRef = doc(
        db,
        "businesses",
        businessAddress,
        "contractors",
        editingContractorId
      );

      const updateData: Partial<Contractor> & { updatedAt: FieldValue } = {
        contractor_name: name,
        contractor_email: email,
        role: role,
        payment: paymentNum, // Store as number
        invitation_note: note,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(contractorRef, updateData);

      showSuccessToast("Contractor updated successfully");
      setShowEditModal(false);
      setEditingContractorId(null);
      setSelectedContractor(null); 
    } catch (error: any) {
      console.error("Error updating contractor:", error);
      showErrorToast(`Update failed: ${error.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!contractorToDelete || !businessAddress) {
      showErrorToast(
        "Cannot delete: Contractor data or business context missing."
      );
      setShowDeleteModal(false);
      return;
    }

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
      setContractorToDelete(null); // Clear contractor to delete
       // If the deleted contractor was selected for payment, clear that too
      if (paymentContractorEmail === contractorToDelete.contractor_email) {
          setPaymentContractorEmail("");
          setContractorToPay(null);
      }

    } catch (error: any) {
      console.error("Error deleting contractor:", error);
      showErrorToast(`Delete failed: ${error.message}`);
      // Keep modal open on failure? Or close? Let's close.
      setShowDeleteModal(false);
    }
  };

  // --- Sub Components ---

  interface FilterDropdownProps {
    options: string[];
    selected: string;
    onSelect: (value: string) => void;
    disabled?: boolean;
  }
  const FilterDropdown: React.FC<FilterDropdownProps> = ({
    options,
    selected,
    onSelect,
    disabled,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleClickOutside = useCallback((event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }, []);

    useEffect(() => {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [handleClickOutside]);

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

        {isOpen && (
          <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
            <div
              className="py-1 max-h-60 overflow-y-auto" // Added max height and scroll
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="options-menu"
            >
              {options.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    onSelect(option);
                    setIsOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  role="menuitem"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  interface ContractorSelectProps {
    id?: string;
    contractors: Contractor[];
    value: string; // Expects contractor email
    onChange: (value: string) => void; // Sends back contractor email
    disabled?: boolean;
  }
  const ContractorSelect: React.FC<ContractorSelectProps> = ({
    id,
    contractors,
    value,
    onChange,
    disabled,
  }) => {
      // Filter contractors eligible for payment (Active status, has wallet)
      const eligibleContractors = contractors.filter(
          (c) => c.status === "Active" && c.contractor_wallet
      );
      // Also include the currently selected contractor if they are no longer eligible,
      // so the select doesn't suddenly become blank. Mark them as disabled.
      const currentlySelectedButIneligible = contractors.find(
          c => c.contractor_email === value && (c.status !== "Active" || !c.contractor_wallet)
      );


      return (
            <select
              id={id}
              className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md ${
                disabled ? "bg-gray-100 opacity-70 cursor-not-allowed" : "bg-white"
              }`}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onChange(e.target.value)
              }
              disabled={disabled}
            >
              <option value="">Select contractor...</option>
              {eligibleContractors
                .sort((a, b) => a.contractor_name.localeCompare(b.contractor_name)) // Sort alphabetically
                .map((contractor) => (
                  <option
                    key={contractor.contractor_id}
                    value={contractor.contractor_email}
                    // Note: No need to disable 'Paid' here as they are filtered out by 'Active' status check
                  >
                    {contractor.contractor_name} ({formatCurrency(contractor.payment)})
                  </option>
                ))
              }
              {currentlySelectedButIneligible && (
                   <option
                    key={currentlySelectedButIneligible.contractor_id}
                    value={currentlySelectedButIneligible.contractor_email}
                    disabled={true} // Mark as disabled visually and functionally
                  >
                    {currentlySelectedButIneligible.contractor_name} (
                        {currentlySelectedButIneligible.status === 'Paid' ? 'Paid' :
                         !currentlySelectedButIneligible.contractor_wallet ? 'No Wallet' :
                         currentlySelectedButIneligible.status}
                     )
                  </option>
              )}
            </select>
        );
    };


  const Skeleton: React.FC = () => (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3"> {/* Reduced padding slightly */}
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        </td>
      ))}
    </tr>
  );

  const CONTRACTOR_ROLES: string[] = [ // Can be fetched or configured elsewhere
    "Freelancer",
    "Plumbing Repair",
    "Real Estate Agent",
    "Content Creator",
    "Graphic Designer",
    "Web Developer",
    "Consultant",
    "Marketing Specialist",
    "Virtual Assistant",
    "Bookkeeper",
    "Other", // Keep 'Other' usually last
  ];

  const getFilteredContractorsForDisplay = useCallback((): Contractor[] => {
    let filtered: Contractor[] = contractors;

    // Filter by selected role
    if (contractorRole && contractorRole !== "All Roles") {
      filtered = filtered.filter((c) => c.role === contractorRole);
    }

    // Filter by search query (case-insensitive)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c: Contractor) =>
          c.contractor_name?.toLowerCase().includes(query) ||
          c.contractor_email?.toLowerCase().includes(query) ||
          c.role?.toLowerCase().includes(query) ||
          (c.contractor_wallet &&
            c.contractor_wallet.toLowerCase().includes(query)) ||
          formatCurrency(c.payment).toLowerCase().includes(query) ||
          c.status?.toLowerCase().includes(query)
      );
    }

    // Optional: Add sorting here if needed, e.g., by name
    filtered.sort((a, b) => a.contractor_name.localeCompare(b.contractor_name));


    return filtered;
  }, [contractors, contractorRole, searchQuery]); // Memoize based on dependencies


  // --- JSX Return ---
  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 bg-white min-h-screen">
      <ToastContainer limit={3} /> {/* Limit concurrent toasts */}
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
                onClick={() => setActiveTab(tab)}
                 disabled={isLoadingAccount} // Disable all tabs during account loading
                // Disable List/Pay tabs during data loading, Invite always enabled if account is loaded
                // disabled={isLoadingAccount || (isLoadingData && (tab === 'CONTRACTOR LIST' || tab === 'PAY CONTRACTOR'))}
              >
                {tab}
              </button>
            )
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {isLoadingAccount ? (
          <div className="text-center py-10 text-gray-500 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            Loading Account Information...
          </div>
        ) : !businessAddress && firebaseUser ? (
          // Wallet not connected state
           <div className="text-center py-10 text-red-600 bg-red-50 p-6 rounded-lg border border-red-200 flex flex-col items-center">
            <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
            <p className="font-semibold mb-2">Wallet Not Connected</p>
            <p className="text-sm text-red-700">Please connect your registered wallet to manage contractors.</p>
            {/* Optional: Add a connect wallet button here */}
          </div>
        ) : (
          // Wallet connected, proceed with tabs
          <>
            {activeTab === "CONTRACTOR LIST" && (
              <div className="space-y-5">
                {/* Filters and Search */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  {/* Role Filter Dropdown */}
                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <Filter size={18} className="text-gray-500" />
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
                  </div>

                   {/* Search Input */}
                  <div className="relative flex-grow w-full sm:max-w-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:bg-gray-100"
                      placeholder="Search contractors..."
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSearchQuery(e.target.value)
                      }
                      disabled={isLoadingData}
                    />
                  </div>

                  {/* Invite Button */}
                   <div className="w-full sm:w-auto flex justify-end">
                     <button
                        className="w-full sm:w-auto px-4 py-2 bg-black text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => setActiveTab("INVITE CONTRACTOR")}
                        disabled={isLoadingAccount} // Disable if account/wallet still loading
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
                          {/* Table Headers */}
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Wallet Address</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
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
                                {/* Table Cells */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm font-medium text-gray-900">{contractor.contractor_name}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-xs text-gray-500 font-mono break-all">
                                    {contractor.contractor_wallet
                                      ? `${contractor.contractor_wallet.substring(0, 6)}...${contractor.contractor_wallet.substring(contractor.contractor_wallet.length - 4)}`
                                      : <span className="text-gray-400 italic">Not Connected</span>
                                      }
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm text-gray-600">{contractor.contractor_email}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm text-gray-700">{contractor.role}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm font-medium text-gray-800">{formatCurrency(contractor.payment)}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                      contractor.status === "Paid" ? "bg-green-100 text-green-800"
                                      : contractor.status === "Active" ? "bg-blue-100 text-blue-800"
                                      : contractor.status === "Invited" ? "bg-yellow-100 text-yellow-800"
                                      : contractor.status === "Inactive" ? "bg-red-100 text-red-800" // Added style for Inactive
                                      : "bg-gray-100 text-gray-800" // Default/Fallback
                                    }`}
                                  >
                                    {contractor.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium" ref={actionButtonRef} >
                                  {/* Edit Button */}
                                  <button
                                    onClick={() => handleEditClick(contractor)}
                                    className="text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1 rounded hover:bg-indigo-50" // Added padding/hover bg
                                    aria-label={`Edit ${contractor.contractor_name}`}
                                    title="Edit Contractor" // Tooltip
                                  >
                                    Edit
                                  </button>
                                  {/* Delete button moved inside Edit Modal for clarity */}
                                </td>
                              </tr>
                            )
                          )
                        ) : (
                          <tr>
                             {/* No Results Message */}
                            <td colSpan={7} className="text-center p-6 text-sm text-gray-500 italic" >
                              {contractors.length === 0
                                ? "No contractors added yet. Click 'Invite Contractor' to begin."
                                : "No contractors match your current filters."
                              }
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "INVITE CONTRACTOR" && (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Invite Contractor
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Fill in the details below to invite a new contractor. They will receive an email with an invitation link.
                </p>

                <div className="space-y-4">
                  {/* Invite Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="inviteName" className="block text-sm font-medium text-gray-700 mb-1" >Full Name *</label>
                      <input id="inviteName" type="text" placeholder="e.g., Jane Doe" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-1" >Email *</label>
                      <input id="inviteEmail" type="email" placeholder="e.g., jane.doe@example.com" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" value={contractorEmail} onChange={(e) => setContractorEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                      <label htmlFor="inviteRole" className="block text-sm font-medium text-gray-700 mb-1" >Role *</label>
                       <select id="inviteRole" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white" value={inviteContractorRole} onChange={(e) => setInviteContractorRole(e.target.value)} >
                        <option value="">Select role...</option>
                        {CONTRACTOR_ROLES.map((role) => (<option key={role} value={role}>{role}</option>))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="invitePayment" className="block text-sm font-medium text-gray-700 mb-1" >Payment (USDC) *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-500 sm:text-sm">$</span></div>
                        <input id="invitePayment" type="number" min="0" step="0.01" className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., 500.00" value={contractorPayment} onChange={(e) => setContractorPayment(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="inviteNote" className="block text-sm font-medium text-gray-700 mb-1" >Invitation Note (Optional)</label>
                    <textarea id="inviteNote" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Add a short message for the contractor (included in email)" value={contractorNote} onChange={(e) => setContractorNote(e.target.value)} rows={3} />
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 pt-4">
                     <button type="button" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" onClick={() => setActiveTab("CONTRACTOR LIST")} >Cancel</button>
                    <button type="button" className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-2" onClick={handleAddContractor}>
                        <UserPlus size={16} /> Invite Contractor
                     </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "PAY CONTRACTOR" && (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Pay Contractor
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Select an 'Active' contractor with a connected wallet to initiate their USDC payment.
                </p>

                <div className="space-y-4">
                  {/* Contractor Selection */}
                  <div>
                    <label htmlFor="payContractorSelect" className="block text-sm font-medium text-gray-700 mb-1">Contractor *</label>
                    <ContractorSelect
                      id="payContractorSelect"
                      contractors={contractors}
                      value={paymentContractorEmail}
                      onChange={setPaymentContractorEmail}
                      disabled={isProcessingPayment || transferLoading}
                    />
                     {/* Display eligibility status message below dropdown */}
                    {paymentContractorEmail && !contractorToPay && paymentStatusMessage && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                         <Info size={12} /> {paymentStatusMessage}
                      </p>
                    )}
                  </div>

                  {/* Display Amount (Readonly) */}
                   {contractorToPay && (
                     <div>
                       <label htmlFor="payAmount" className="block text-sm font-medium text-gray-700 mb-1">Amount (USDC)</label>
                        <div className="relative">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-500 sm:text-sm">$</span></div>
                          <input id="payAmount" type="text" className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed text-gray-700 font-medium" value={formatCurrency(contractorToPay.payment)} readOnly disabled />
                       </div>
                    </div>
                  )}

                   {/* REMOVED: Gas Limit Input Field */}
                   {/*
                  <div>
                    <label htmlFor="payGasLimit" className="block text-sm font-medium text-gray-700 mb-1" >Gas Limit *</label>
                    <input id="payGasLimit" type="number" value={gasLimitInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGasLimitInput(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${isProcessingPayment || transferLoading ? "bg-gray-100 cursor-not-allowed" : "border-gray-300"}`}
                      placeholder="e.g., 200000" min="21000" step="1000" disabled={isProcessingPayment || transferLoading} />
                    <p className="mt-1 text-xs text-gray-500"> Recommended: 150,000 - 300,000. Adjust if needed.</p>
                  </div>
                   */}


                  {/* Payment Actions */}
                  <div className="flex justify-end gap-3 pt-4">
                     <button type="button" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" onClick={() => setActiveTab("CONTRACTOR LIST")} disabled={isProcessingPayment || transferLoading} >Cancel</button>
                     <button type="button"
                      className={`px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${
                         !contractorToPay || isProcessingPayment || transferLoading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700" }`}
                      onClick={handleConfirmPayment}
                      disabled={!contractorToPay || isProcessingPayment || transferLoading}
                    >
                       {isProcessingPayment || transferLoading ? ( <Loader2 size={16} className="animate-spin" /> ) : ( <Send size={16} /> )}
                      {isProcessingPayment || transferLoading ? "Processing..." : "Initiate Payment"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals using AnimatePresence */}

      {/* Payment Confirmation Modal */}
       <AnimatePresence>
        {showConfirmation && contractorToPay && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // Close on backdrop click only if not processing
             onClick={!(isProcessingPayment || transferLoading) ? handleCancelPayment : undefined}
          >
             <motion.div
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
              {/* Close Button (Top Right) - disabled during processing */}
               <button onClick={handleCancelPayment} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Close" disabled={isProcessingPayment || transferLoading}>
                 <X size={20} />
               </button>

               <div className="flex flex-col items-center text-center">
                 {/* Icon based on state */}
                 {!isProcessingPayment && !transferLoading && !transferError && !transferSuccess && (
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                     <DollarSign className="text-indigo-600" size={24} />
                   </div>
                 )}
                 {(isProcessingPayment || transferLoading) && (
                   <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                 )}
                 {transferError && !isProcessingPayment && ( // Show error icon only after processing stops
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                      <AlertTriangle className="text-red-600" size={24} />
                    </div>
                  )}
                 {transferSuccess && !isProcessingPayment && ( // Show success icon only after processing stops
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                        <svg className="text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                  )}

                 <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    {/* Dynamic Title */}
                    {isProcessingPayment || transferLoading ? "Processing Payment" :
                     transferError ? "Payment Failed" :
                     transferSuccess ? "Payment Successful" :
                     "Confirm Payment"
                     }
                 </h2>

                 {/* Initial Confirmation Message */}
                 {!paymentStatusMessage && !transferError && !transferSuccess && !isProcessingPayment && (
                    <p className="text-sm text-gray-600 mb-4">
                     Pay <span className="font-medium">{contractorToPay.contractor_name}</span> the amount of <span className="font-semibold">{formatCurrency(contractorToPay.payment)}</span> USDC?
                      <br />
                      <span className="text-xs text-gray-500 mt-1 block">Gas will be automatically handled (Estimate: ~{DEFAULT_GAS_LIMIT_NUMBER}).</span>
                   </p>
                  )}

                 {/* Status/Error Message Area */}
                  {paymentStatusMessage && (
                   <div
                     className={`text-sm mb-4 px-3 py-2 rounded-md w-full break-words ${
                        transferError ? "bg-red-50 border border-red-200 text-red-700" :
                        transferSuccess ? "bg-green-50 border border-green-200 text-green-700" :
                        "bg-blue-50 border border-blue-200 text-blue-700" // Default/Processing color
                     }`}
                   >
                     <p>{paymentStatusMessage}</p>
                      {/* Link to block explorer */}
                     {transferTxHash && (
                        <a href={`${linea_scan}/tx/${transferTxHash}`} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs font-medium underline hover:text-blue-900" >
                          View on Block Explorer
                       </a>
                     )}
                   </div>
                  )}

                {/* REMOVED: Confirm Gas Limit Input */}
                 {/*
                 <div className="w-full mb-5 text-left">
                   <label htmlFor="confirmGasLimit" className="block text-xs font-medium text-gray-500 mb-1">Gas Limit</label>
                   <input id="confirmGasLimit" type="number" value={gasLimitInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGasLimitInput(e.target.value)}
                     className={`w-full px-3 py-1.5 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${ isProcessingPayment || transferLoading || transferError ? "bg-gray-100 border-gray-300 cursor-not-allowed" : "border-gray-300"}`}
                     placeholder="e.g., 200000" min="21000" step="1000" disabled={isProcessingPayment || transferLoading || transferError} />
                 </div>
                 */}


                {/* Modal Action Buttons */}
                <div className="flex justify-center gap-3 w-full mt-2">
                    {/* Show Cancel button only before/after processing */}
                    {!isProcessingPayment && !transferLoading && (
                       <button type="button" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        onClick={handleCancelPayment} >
                         {transferSuccess || transferError ? "Close" : "Cancel"} {/* Change label after completion */}
                        </button>
                     )}

                   {/* Show Confirm/Pay button only before processing starts */}
                    {!isProcessingPayment && !transferLoading && !transferError && !transferSuccess && (
                      <button type="button" className={`px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-green-600 hover:bg-green-700`}
                        onClick={initiatePaymentProcess}
                        disabled={isProcessingPayment || transferLoading || transferError} // Double check disabled state
                      >
                          <Send size={16} /> Confirm & Pay
                      </button>
                    )}
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" // Ensure Edit is above backdrop
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
              onClick={(e) => e.stopPropagation()} // Prevent close on modal click
            >
               {/* Modal Header */}
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-semibold text-gray-800">Edit Contractor</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"> <X size={20} /> </button>
              </div>

              {/* Scrollable Form Area */}
               <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {/* Form Fields */}
                 <div><label htmlFor="editName" className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input id="editName" type="text" value={editFormData.contractor_name} onChange={(e) => setEditFormData({...editFormData, contractor_name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                 <div><label htmlFor="editEmail" className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input id="editEmail" type="email" value={editFormData.contractor_email} onChange={(e) => setEditFormData({...editFormData, contractor_email: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                <div>
                     <label htmlFor="editRole" className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <select id="editRole" className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" value={editFormData.role} onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}>
                         <option value="">Select role...</option>
                         {CONTRACTOR_ROLES.map((role) => (<option key={role} value={role}>{role}</option>))}
                    </select>
                 </div>
                 <div><label htmlFor="editPayment" className="block text-sm font-medium text-gray-700 mb-1">Payment (USDC) *</label><input id="editPayment" type="number" min="0" step="0.01" value={editFormData.payment} onChange={(e) => setEditFormData({...editFormData, payment: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                 <div><label htmlFor="editNote" className="block text-sm font-medium text-gray-700 mb-1">Note</label><textarea id="editNote" value={editFormData.invitation_note} onChange={(e) => setEditFormData({...editFormData, invitation_note: e.target.value})} rows={3} className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"></textarea></div>

                 {/* Read-only Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Wallet Address</p>
                      <p className="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded break-all"> {selectedContractor.contractor_wallet ?? <span className="italic text-gray-400">Not Connected</span>} </p>
                   </div>
                   <div>
                     <p className="text-sm font-medium text-gray-700 mb-1">Status</p>
                      <p className={`text-sm font-medium px-2 py-1 rounded inline-block ${
                          selectedContractor.status === "Paid" ? "bg-green-100 text-green-800" :
                          selectedContractor.status === "Active" ? "bg-blue-100 text-blue-800" :
                          selectedContractor.status === "Invited" ? "bg-yellow-100 text-yellow-800" :
                          selectedContractor.status === "Inactive" ? "bg-red-100 text-red-800" : // Added Inactive style
                          "bg-gray-100 text-gray-800" }`}
                       > {selectedContractor.status}
                       </p>
                    </div>
                 </div>
              </div>

              {/* Modal Footer/Actions */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                {/* Delete Button */}
                 <button onClick={() => handleDeleteClick(selectedContractor)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm font-medium hover:bg-red-100 hover:border-red-300 transition-colors flex items-center gap-1.5">
                    <Trash2 size={14} /> Delete
                 </button>
                 {/* Cancel / Save Buttons */}
                <div className="flex gap-3">
                   <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                   <button onClick={handleEditSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">Save Changes</button>
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
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4" // Higher z-index than Edit Modal
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteModal(false)} // Close on backdrop
          >
             <motion.div
              className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()} // Prevent close on modal click
            >
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="text-red-600" size={24} />
                </div>
               <h2 className="text-lg font-semibold text-gray-800 mb-2">Delete Contractor?</h2>
               <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete <span className="font-medium">{contractorToDelete.contractor_name}</span>? This action cannot be undone.</p>
               <div className="flex justify-center gap-3">
                 <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                 <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">Yes, Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}