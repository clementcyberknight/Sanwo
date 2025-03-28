"use client";

import { useState, useEffect, useRef } from "react";
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
import { useRouter } from "next/navigation"; // Import useRouter
import { motion, AnimatePresence } from "framer-motion";
import { ethers, parseUnits } from "ethers";
import { abi, payWorkers } from "@/sc_stylus/scabi";
import { useAccount } from "wagmi";

// Add this function near your other utility functions
const getModalPosition = (buttonRef) => {
  if (!buttonRef.current)
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  const rect = buttonRef.current.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Check if modal would be too close to bottom of viewport
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
    top: `${rect.top + window.scrollY + 30}px`,
    left: "50%",
    transform: "translateX(-50%)",
  };
};

// --- Main Component ---

export default function ContractorPage() {
  const router = useRouter();

  // Move toast functions to top of component
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

  // --- Utility Functions ---

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

  // Add this function near your other utility functions
  const storeContractorPayment = async (
    account,
    transactionHash,
    contractorToPay,
    status = "Success"
  ) => {
    try {
      const db = getFirestore(app);
      const batch = writeBatch(db);

      const payrollId = Date.now().toString();
      const timestamp = serverTimestamp();

      // Create contractor payroll document
      const payrollRef = doc(
        db,
        `businesses/${account.address}/Contractor_payroll/${payrollId}`
      );

      const payrollData = {
        payrollId,
        payrollDate: timestamp,
        transactionHash,
        totalAmount: Number(contractorToPay.payment),
        payrollToken: "USDC",
        gasFees: 0, // Optional: Calculate from transaction if needed
        payrollStatus: status,
        businessId: account.address,
        payrollPeriod: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        recipient: {
          contractorId: contractorToPay.contractor_id,
          recipientName: contractorToPay.contractor_name,
          recipientEmail: contractorToPay.contractor_email,
          recipientWalletAddress: contractorToPay.contractor_wallet,
          amount: Number(contractorToPay.payment),
        },
        category: "Contractor Payment",
        errorDetails: null,
      };

      batch.set(payrollRef, payrollData);

      // Create payment history entry
      const historyRef = doc(
        db,
        `businesses/${account.address}/payments/${payrollId}`
      );

      batch.set(historyRef, {
        amount: Number(contractorToPay.payment),
        payrollId,
        transactionid: `${payrollId}`,
        timestamp: timestamp,
        category: "Contractor Payment",
        status: status,
        transactionHash,
      });

      await batch.commit();

      // Only update contractor status if payment was successful
      if (status === "Success") {
        const contractorRef = doc(
          db,
          "businesses",
          account.address,
          "contractors",
          contractorToPay.contractor_id
        );
        await updateDoc(contractorRef, { status: "Paid" });
      }

      showSuccessToast("Bingo! Payment sent successfully");
    } catch (error) {
      console.error("Error storing payment records:", error);
      showErrorToast("Failed to store payment records");
    }
  };

  const [activeTab, setActiveTab] = useState("CONTRACTOR LIST");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredContractors, setFilteredContractors] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // --- Invite Contractor State ---
  const [contractorName, setContractorName] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [contractorRole, setContractorRole] = useState("");
  const [contractorPayment, setContractorPayment] = useState("");
  const [contractorNote, setContractorNote] = useState("");
  const [companyData, setCompanyData] = useState("");

  // --- Pay Contractor State ---
  const [paymentContractor, setPaymentContractor] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [contractorToPay, setContractorToPay] = useState(null);

  const [contractors, setContractors] = useState([]);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [editingContractorId, setEditingContractorId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [signer, setSigner] = useState(null);
  const account = useAccount();
  const [firebaseUser, setFirebaseUser] = useState(null);

  const [showActionMenu, setShowActionMenu] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contractorToDelete, setContractorToDelete] = useState(null);
  const [editFormData, setEditFormData] = useState({
    contractor_name: "",
    contractor_email: "",
    role: "",
    payment: "",
    invitation_note: "",
  });

  const actionMenuRef = useRef(null);
  const actionButtonRef = useRef(null);

  // Add this state for modal positioning
  const [modalPosition, setModalPosition] = useState({});

  // Add this state near your other state declarations
  const [selectedContractor, setSelectedContractor] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setFirebaseUser(user);
      if (user) {
        //User is signed in to Firebase.
        try {
          // No JWT for now because our thirdweb sub finish, rely on Firebase and thirdweb
        } catch (error) {
          console.error("Error with Firebase Auth:", error);
          showErrorToast("Error with Firebase Authentication.");
        } finally {
          setIsLoadingAccount(false);
        }
      } else {
        //User is signed out.
        setContractors([]);
        setIsLoadingAccount(false);
        router.push("/auth/login"); // Redirect to login page
      }
    });
    return () => unsubscribe(); // Cleanup subscription on unmount.
  }, [router]);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (account && account.address) {
        console.log(account.address);
        const db = getFirestore(app);
        const companyDocRef = doc(db, "businesses", account.address); // we are using the wallet address as the document ID
        try {
          const docSnap = await getDoc(companyDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data(); // Get data *first*
            setCompanyData(data);
          } else {
            console.log("No such document!");
            setCompanyData(null);
          }
        } catch (error) {
          console.error("Error fetching company data:", error);
          setCompanyData(null); //reset to null in case of an error
        }
      } else {
        setCompanyData(null); // Reset if no account or address
      }
    };
    fetchCompanyData();
  }, [account]);

  useEffect(() => {
    const db = getFirestore(app);
    let unsubscribe;

    if (firebaseUser && account && account.address) {
      // Fetch user data from Firestore using the user's UID and perform a small check to ensure the wallet address matches the registered business account.
      const businessDocRef = doc(db, "users", firebaseUser.uid);
      getDoc(businessDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const businessData = docSnap.data();
            // Wallet address check
            const registeredAddress = businessData.wallet_address.toLowerCase();
            const currentAddress = account?.address.toLowerCase();
            // Verify the wallet address.
            if (registeredAddress !== currentAddress) {
              showErrorToast(
                "Connected wallet does not match the registered business account."
              );
              router.push("/auth/login"); // Redirect to login
              return; // Stop further execution.
            }

            // If wallet matches, proceed to fetch workers.
            const contractorsRef = collection(
              db,
              "businesses",
              account.address,
              "contractors"
            );
            unsubscribe = onSnapshot(
              contractorsRef,
              (snapshot) => {
                const contractorsData = [];
                snapshot.forEach((doc) => {
                  contractorsData.push({
                    contractor_id: doc.id,
                    ...doc.data(),
                  });
                });
                setContractors(contractorsData);
                setIsLoadingData(false); // Set loading to false after data fetch
              },
              (error) => {
                console.error("Error fetching contractors:", error);
                showErrorToast(`Error fetching contractors: ${error.message}`);
                setIsLoadingData(false); // Set loading to false on error too
              }
            );
          } else {
            showErrorToast("Business data not found.");
            router.push("/auth/login");
            return; // Stop execution.
          }
        })
        .catch((error) => {
          // Handle potential errors in fetching business data
          console.error("Error fetching business data:", error);
          showErrorToast(`Error fetching business data: ${error.message}`);
          router.push("/auth/login");
        });
    } else {
      setContractors([]);
      setIsLoadingData(false); // Ensure loading is false
      if (unsubscribe) unsubscribe();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [firebaseUser, account, router]);

  useEffect(() => {
    const lowerSearch = searchQuery.toLowerCase();
    const results = contractors.filter(
      (contractor) =>
        contractor.contractor_name?.toLowerCase().includes(lowerSearch) ||
        contractor.contractor_email?.toLowerCase().includes(lowerSearch) ||
        contractor.role?.toLowerCase().includes(lowerSearch) ||
        contractor.contractor_wallet?.toLowerCase().includes(lowerSearch) ||
        formatCurrency(contractor.payment).includes(lowerSearch)
    );
    setFilteredContractors(results);
  }, [searchQuery, contractors]);

  // Add this useEffect to handle clicks outside the action menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target)
      ) {
        setShowActionMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- Handlers ---

  const handleAddContractor = async () => {
    console.log("companyData.name after update:", companyData.name);
    // Validation
    if (
      !contractorName.trim() ||
      !contractorEmail.trim() ||
      !contractorRole ||
      !contractorPayment
    ) {
      showErrorToast(
        "Please fill in all required fields (Name, Email, Role, Payment)."
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contractorEmail)) {
      //simple email check
      showErrorToast("Please enter a valid email address.");
      return;
    }

    const paymentNum = parseFloat(contractorPayment.replace(/[^0-9.-]+/g, ""));
    if (isNaN(paymentNum)) {
      showErrorToast("Please enter a valid payment amount.");
      return;
    }

    if (!account || !account.address) {
      showErrorToast("Please connect your wallet."); // Use showErrorToast
      return;
    }

    if (!firebaseUser) {
      showErrorToast("User not authenticated, Please login"); // Use showErrorToast
      return;
    }
    // Check for duplicate email
    if (
      contractors.some(
        (contractor) => contractor.contractor_email === contractorEmail
      )
    ) {
      showErrorToast("A contractor with this email already exists.");
      return;
    }

    const db = getFirestore(app);
    const user = auth.currentUser; // Use auth.currentUser

    if (!user) {
      showErrorToast("User not authenticated. Please sign in.");
      router.push("/auth/login"); //Important
      return;
    }

    const contractor_id = Date.now().toString();
    const inviteLink = `${window.location.origin}/contractor_connect/${firebaseUser.uid}/${contractor_id}`;

    const contractorData = {
      contractor_name: contractorName,
      inviteLink: inviteLink,
      businessId: firebaseUser.uid,
      contractor_id: contractor_id,
      businessname: companyData?.name,
      contractor_email: contractorEmail,
      role: contractorRole,
      payment: paymentNum,
      status: "Invited",
      contractor_wallet: "", // Initialize empty
      invitation_note: contractorNote,
      createdAt: serverTimestamp(),
    };

    try {
      const contractorRef = doc(
        db,
        "businesses",
        account.address,
        "contractors",
        contractor_id
      );
      await setDoc(contractorRef, contractorData);
      showSuccessToast("Contractor invited successfully!");
    } catch (error) {
      console.error("Error adding contractor:", error);
      showErrorToast(`Error adding contractor: ${error.message}`);
      return;
    }

    // Clear form
    setContractorName("");
    setContractorEmail("");
    setContractorRole("");
    setContractorPayment("");
    setContractorNote("");
    setActiveTab("CONTRACTOR LIST"); // Switch back to the list after adding
  };

  //uhm test
  useEffect(() => {
    async function initSigner() {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          setSigner(signer);
        } catch (error) {
          console.error("Error initializing signer:", error.message);
          showErrorToast("Failed to initialize wallet signer.");
        }
      } else {
        showErrorToast("Ethereum wallet not found. Please install MetaMask.");
      }
    }
    initSigner();
  }, []);

  const handleConfirmPayment = () => {
    console.log(contractors);

    if (paymentContractor) {
      const contractor = contractors.find(
        (contractor) => contractor.contractor_email === paymentContractor
      );
      setContractorToPay(contractor);
      setShowConfirmation(true);
    }
  };

  const handlePayContractor = async () => {
    if (contractorToPay.contractor_wallet && contractorToPay.status != "Paid") {
      const employerContract = new ethers.Contract(payWorkers, abi, signer);
      try {
        let recipientAddress = contractorToPay.contractor_wallet;
        contractorToPay.payment = contractorToPay.payment.toString();
        recipientAddress = recipientAddress.toString();
        let conv_deposit = ethers.parseUnits(contractorToPay.payment, 6);

        const tx = await employerContract.transferByEmployer(
          recipientAddress,
          conv_deposit
        );
        const receipt = await tx.wait();

        // Store successful payment data
        await storeContractorPayment(
          account,
          receipt.hash,
          contractorToPay,
          "Success"
        );
        showSuccessToast("Payment sent successfully!");
      } catch (error) {
        console.error("Error processing payment:", error.message);
        // Store failed payment data
        await storeContractorPayment(account, null, contractorToPay, "Failed");
        showErrorToast("Failed to pay contractor.");
      }
      if (!account || !account.address) {
        showErrorToast("Please connect your wallet.");
        return;
      }

      // Check contractor status before proceeding
      if (contractorToPay.status === "Paid") {
        showErrorToast(
          `Contractor ${contractorToPay.contractor_name} has already been paid.`
        );
        setPaymentContractor("");
        setShowConfirmation(false);
        setContractorToPay(null);
        return;
      }

      if (contractorToPay.status === "Invited") {
        showErrorToast(
          `Contractor ${contractorToPay.contractor_name} is not eligible for payment.\nStatus: Invited`
        );
        setPaymentContractor("");
        setShowConfirmation(false);
        setContractorToPay(null);
        return;
      }
    } else {
      showErrorToast("No contractor selected or Contractor already paid.");
    }

    setPaymentContractor("");
    setShowConfirmation(false);
    setContractorToPay(null);
  };

  const handleCancelPayment = () => {
    setShowConfirmation(false);
    setContractorToPay(null);
  };

  const handleExportList = async () => {
    setIsExporting(true);
    try {
      // Prepare data for CSV export
      const csvData = contractors.map((contractor) => ({
        Name: contractor.contractor_name,
        Email: contractor.contractor_email,
        Role: contractor.role,
        Payment: contractor.payment,
        Status: contractor.status,
        Wallet: contractor.contractor_wallet || "", // Handle potential undefined value
      }));

      // Convert data to CSV format
      const csv = Papa.unparse(csvData, {
        header: true, // Include header row
      });

      // Create a Blob from the CSV data
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

      // Create a download link
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "contractor_list.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link); // Clean up

      showSuccessToast("Contractor list exported successfully!");
    } catch (error) {
      console.error("Error exporting contractor list:", error);
      showErrorToast(`Error exporting contractor list: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Update the handleEditClick function
  const handleEditClick = (contractor) => {
    setSelectedContractor(contractor);
    setEditingContractorId(contractor.contractor_id);
    setEditFormData({
      contractor_name: contractor.contractor_name || "",
      contractor_email: contractor.contractor_email || "",
      role: contractor.role || "",
      payment: contractor.payment || "",
      invitation_note: contractor.invitation_note || "",
    });
    setShowEditModal(true);
  };

  const handleDeleteClick = (contractor) => {
    setContractorToDelete(contractor);
    setShowDeleteModal(true);
    // Calculate and set modal position
    setModalPosition(getModalPosition(actionButtonRef));
  };

  const handleEditSubmit = async () => {
    try {
      if (!editingContractorId) {
        showErrorToast("No contractor selected for editing");
        return;
      }

      // Validate form data
      if (
        !editFormData.contractor_name ||
        !editFormData.contractor_email ||
        !editFormData.role
      ) {
        showErrorToast("Please fill in all required fields");
        return;
      }

      // Update the contractor in Firestore
      const db = getFirestore(app);
      const contractorRef = doc(
        db,
        "businesses",
        account.address,
        "contractors",
        editingContractorId
      );

      await updateDoc(contractorRef, {
        contractor_name: editFormData.contractor_name,
        contractor_email: editFormData.contractor_email,
        role: editFormData.role,
        payment: parseFloat(editFormData.payment) || 0,
        invitation_note: editFormData.invitation_note,
        updatedAt: serverTimestamp(),
      });

      showSuccessToast("Contractor updated successfully");
      setShowEditModal(false);

      // Update the local state to reflect changes immediately
      setContractors(
        contractors.map((c) =>
          c.contractor_id === editingContractorId
            ? {
                ...c,
                contractor_name: editFormData.contractor_name,
                contractor_email: editFormData.contractor_email,
                role: editFormData.role,
                payment: parseFloat(editFormData.payment) || 0,
                invitation_note: editFormData.invitation_note,
              }
            : c
        )
      );
    } catch (error) {
      console.error("Error updating contractor:", error);
      showErrorToast("Failed to update contractor");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!contractorToDelete) return;

    if (!account || !account.address) {
      showErrorToast("Please connect your wallet.");
      return;
    }

    const db = getFirestore(app);

    try {
      const contractorRef = doc(
        db,
        "businesses",
        account.address,
        "contractors",
        contractorToDelete.contractor_id
      );

      // Delete the contractor document
      showSuccessToast("Deleting Contractor...");
      await deleteDoc(contractorRef);

      // Close both modals
      setShowDeleteModal(false);
      setShowEditModal(false);

      // Reset states
      setContractorToDelete(null);
      setSelectedContractor(null);
      setEditingContractorId(null);
    } catch (error) {
      console.error("Error deleting contractor:", error);
      showErrorToast(`Error deleting contractor: ${error.message}`);
    }
  };

  // --- Helper Components ---

  // Update the FilterDropdown component
  const FilterDropdown = ({ options, selected, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    useEffect(() => {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    return (
      <div className="relative inline-block text-left z-10" ref={dropdownRef}>
        <button
          type="button"
          className="inline-flex justify-between items-center w-48 rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selected || "All Roles"}</span>
          <ChevronDown size={16} className="ml-2" />
        </button>

        {isOpen && (
          <div className="origin-top-right absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
            <div className="py-1" role="menu">
              {options.map((option) => (
                <button
                  key={option}
                  className={`block w-full text-left px-4 py-2 text-sm ${
                    selected === option
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  role="menuitem"
                  onClick={() => {
                    onSelect(option);
                    setIsOpen(false);
                  }}
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

  const ContractorSelect = ({ contractors, value, onChange }) => (
    <select
      className="mt-1 block w-full pl-3 pr-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select contractor</option>
      {contractors.map((contractor) => (
        <option
          key={contractor.contractor_email}
          value={contractor.contractor_email}
        >
          {contractor.contractor_name}
        </option>
      ))}
    </select>
  );

  const Skeleton = () => (
    <tr>
      {[...Array(7)].map(
        (
          _,
          index // Simplifies to 7 columns
        ) => (
          <td key={index} className="px-6 py-4 whitespace-nowrap">
            <div className="animate-pulse bg-gray-200 h-4  rounded-md w-full"></div>{" "}
            {/* Full width */}
          </td>
        )
      )}
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
    "Other", // Or a custom role input
  ];

  // Add this function to filter contractors based on selected filters
  const getFilteredContractors = () => {
    let filtered = [...filteredContractors];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (contractor) =>
          contractor.contractor_name?.toLowerCase().includes(query) ||
          contractor.contractor_email?.toLowerCase().includes(query) ||
          contractor.role?.toLowerCase().includes(query) ||
          contractor.contractor_wallet?.toLowerCase().includes(query) ||
          formatCurrency(contractor.payment).includes(query)
      );
    }

    // Apply role filter
    if (contractorRole) {
      filtered = filtered.filter(
        (contractor) => contractor.role === contractorRole
      );
    }

    // Apply status filter
    if (activeTab === "CONTRACTOR LIST") {
      if (searchQuery) {
        filtered = filtered.filter(
          (contractor) => contractor.status !== "Inactive"
        );
      } else {
        filtered = filtered.filter(
          (contractor) => contractor.status !== "Inactive"
        );
      }
    }

    return filtered;
  };

  // Main return
  return (
    <div className="max-w-[1400px] mx-auto p-4">
      <ToastContainer />
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Contractor Management</h1>
          <p className="text-sm text-gray-500">
            Manage contractor list and payments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleExportList}
            disabled={isLoadingData || isExporting}
          >
            <FileText size={16} />
            {isExporting ? "Exporting..." : "Export Report"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-8">
          {["CONTRACTOR LIST", "INVITE CONTRACTOR", "PAY CONTRACTOR"].map(
            (tab) => (
              <button
                key={tab}
                className={`pb-2 transition-colors duration-200 ${
                  activeTab === tab
                    ? "text-blue-600 border-b-2 border-blue-600 font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab(tab)}
                disabled={isLoadingData}
              >
                {tab}
              </button>
            )
          )}
        </div>
      </div>
      {isLoadingAccount ? (
        <div className="text-center p-8 text-gray-500">
          Loading account information...
        </div>
      ) : (
        <>
          {/* --- CONTRACTOR LIST TAB CONTENT --- */}
          {activeTab === "CONTRACTOR LIST" && (
            <>
              {/* Controls */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                  <FilterDropdown
                    options={["All CONTRACTORS", ...CONTRACTOR_ROLES]}
                    selected={
                      contractorRole === "" ? "All CONTRACTORS" : contractorRole
                    }
                    onSelect={(selectedRole) => {
                      setContractorRole(
                        selectedRole === "All CONTRACTORS" ? "" : selectedRole
                      );
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-4">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
                    onClick={() => setActiveTab("INVITE CONTRACTOR")}
                  >
                    <UserPlus size={16} />
                    Invite Contractor
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-md mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search contractors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Table */}
              <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Wallet Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment (USDC)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {isLoadingData ? (
                      // Show skeleton rows while loading
                      Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} />
                      ))
                    ) : getFilteredContractors().length > 0 ? (
                      getFilteredContractors().map((contractor) => (
                        <tr
                          key={contractor.contractor_id}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {contractor.contractor_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {contractor.contractor_wallet
                                ? `${contractor.contractor_wallet.slice(
                                    0,
                                    4
                                  )}...${contractor.contractor_wallet.slice(
                                    -4
                                  )}`
                                : "N/A"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {contractor.contractor_email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-blue-600">
                              {contractor.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(contractor.payment)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                contractor.status === "Paid"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {contractor.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div
                              className="flex justify-end space-x-2"
                              ref={actionButtonRef}
                            >
                              <button
                                onClick={() => handleEditClick(contractor)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="7"
                          className="text-center p-8 text-gray-500"
                        >
                          {isLoadingData
                            ? "Loading contractors..."
                            : "No contractors found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* --- INVITE CONTRACTOR TAB CONTENT --- */}
          {activeTab === "INVITE CONTRACTOR" && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4">Invite Contractor</h2>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
                <div className="flex">
                  <Clock size={20} className="text-blue-500 mr-3" />
                  <div>
                    <p className="text-sm text-blue-700">
                      Use this page to invite contractors by sending them a
                      secure email containing wallet connection details.
                    </p>
                    <p className="text-sm text-blue-700">
                      This is crucial for facilitating secure and streamlined
                      (Web3) payment transactions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Name and Email Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                      value={contractorName}
                      onChange={(e) => setContractorName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                      value={contractorEmail}
                      onChange={(e) => setContractorEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Role and Payment Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                      value={contractorRole}
                      onChange={(e) => setContractorRole(e.target.value)}
                    >
                      <option value="">Select role</option>
                      {CONTRACTOR_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Payment (USDC)
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="text"
                        className="mt-1 block w-full pl-7 pr-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                        value={contractorPayment}
                        onChange={(e) => setContractorPayment(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                {/* Note Field */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Note
                  </label>
                  <textarea
                    className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Add any additional information about this contractor"
                    value={contractorNote}
                    onChange={(e) => setContractorNote(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Add Contractor Button */}
                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setActiveTab("CONTRACTOR LIST")}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700"
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
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4">Pay Contractor</h2>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
                <div className="flex items-center">
                  <DollarSign size={20} className="text-blue-500 mr-3" />
                  <p className="text-sm text-blue-700">
                    Select a contractor to initiate a payment.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Contractor and Amount Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Contractor
                    </label>
                    <ContractorSelect
                      contractors={contractors}
                      value={paymentContractor}
                      onChange={setPaymentContractor}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Amount (USDC)
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="text"
                        className="mt-1 block w-full pl-7 pr-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                        value={
                          contractors.find(
                            (contractor) =>
                              contractor.contractor_email === paymentContractor
                          )?.payment || ""
                        }
                        readOnly
                      />
                    </div>
                  </div>
                </div>
                {/* Pay Contractor Button */}
                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setActiveTab("CONTRACTOR LIST")}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700"
                    onClick={handleConfirmPayment}
                    disabled={!paymentContractor} // Disable if no contractor is selected
                  >
                    Pay Contractor
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Confirmation Modal */}
          {showConfirmation && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
              <div className="bg-white p-8 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Confirm Payment</h2>
                <p className="mb-4">
                  Are you sure you want to pay{" "}
                  {contractorToPay?.contractor_name} the amount of{" "}
                  {formatCurrency(contractorToPay?.payment)}?
                </p>
                <div className="flex justify-end gap-4">
                  <button
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={handleCancelPayment}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-green-600 rounded-md text-sm font-medium text-white hover:bg-green-700"
                    onClick={handlePayContractor}
                  >
                    Confirm Payment
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Edit Contractor Modal */}
          <AnimatePresence>
            {showEditModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <motion.div
                  className="bg-white rounded-lg p-6 w-full max-w-md"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Edit Contractor</h2>
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        name="contractor_name"
                        value={editFormData.contractor_name}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            contractor_name: e.target.value,
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="contractor_email"
                        value={editFormData.contractor_email}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            contractor_email: e.target.value,
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <input
                        type="text"
                        name="role"
                        value={editFormData.role}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            role: e.target.value,
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment (USDC)
                      </label>
                      <input
                        type="text"
                        name="payment"
                        value={editFormData.payment}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            payment: e.target.value,
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Note
                      </label>
                      <textarea
                        className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                        placeholder="Add any additional information about this contractor"
                        value={editFormData.invitation_note}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            invitation_note: e.target.value,
                          })
                        }
                        rows={4}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between mt-6">
                    <button
                      onClick={() => handleDeleteClick(selectedContractor)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
                    >
                      <Trash2 size={16} className="mr-2" />
                      Delete
                    </button>

                    <div className="space-x-2">
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleEditSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Delete Confirmation Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
              <div className="relative w-96 shadow-lg rounded-md bg-white p-5">
                <div className="flex items-center justify-center mb-6 text-red-500">
                  <div className="bg-red-100 p-3 rounded-full">
                    <X size={24} />
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-center mb-4">
                  Delete Contractor
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  Are you sure you want to delete{" "}
                  {contractorToDelete?.contractor_name}? This action cannot be
                  undone.
                </p>

                <div className="flex justify-center space-x-4">
                  <button
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-red-600 rounded-md text-sm font-medium text-white hover:bg-red-700"
                    onClick={handleDeleteConfirm}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
