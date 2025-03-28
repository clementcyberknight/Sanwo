"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Filter,
  ChevronDown,
  Plus,
  Search,
  UploadCloud,
} from "lucide-react";
import Papa from "papaparse";
import {
  auth,
  db,
  app,
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  onSnapshot,
  updateDoc,
} from "@/app/config/FirebaseConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

const formatCurrency = (amount) => {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : parseFloat(amount?.replace(/[^0-9.-]+/g, ""));
  if (isNaN(numericAmount)) return "Invalid Amount";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numericAmount);
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid Date";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const WORKER_ROLES = [
  "Developer",
  "Manager",
  "Admin",
  "Designer",
  "Marketing",
  "Support",
];

const Skeleton = ({ width, height }) => (
  <div
    className="animate-pulse bg-gray-200 rounded"
    style={{ width: width, height: height }}
  ></div>
);

export default function PayrollPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("WORKER LIST");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredWorkers, setFilteredWorkers] = useState([]);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("All");
  const [workerName, setWorkerName] = useState("");
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerRole, setWorkerRole] = useState("");
  const [workerSalary, setWorkerSalary] = useState("");
  const [workerNote, setWorkerNote] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  const [workers, setWorkers] = useState([]);
  const [isAddingWorker, setIsAddingWorker] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [companyData, setCompanyData] = useState(null);

  const account = useAccount();

  const [firebaseUser, setFirebaseUser] = useState(null);

  // Helper function to update business metrics
  const updateBusinessMetrics = async (
    db,
    businessAddress,
    newWorkerSalary = 0
  ) => {
    try {
      const businessRef = doc(db, "businesses", businessAddress);
      const businessSnap = await getDoc(businessRef);

      if (businessSnap.exists()) {
        const currentData = businessSnap.data();
        const currentTotalPayroll = currentData.totalPayroll || 0; // Default to 0
        const currentEmployeeCount = currentData.employeeCount || 0;

        const newTotalPayroll = currentTotalPayroll + newWorkerSalary;
        const newEmployeeCount =
          currentEmployeeCount + (newWorkerSalary > 0 ? 1 : 0); //only increment if adding

        await updateDoc(businessRef, {
          totalPayroll: newTotalPayroll,
          employeeCount: newEmployeeCount,
        });
        console.log("Business metrics updated successfully");
      } else {
        // If the document doesn't exist, create it with initial values
        await setDoc(businessRef, {
          totalPayroll: newWorkerSalary,
          employeeCount: newWorkerSalary > 0 ? 1 : 0, //new worker? count = 1
        });
        console.log("Business metrics created and updated");
      }
    } catch (error) {
      console.error("Error updating business metrics:", error);
      showErrorToast(`Error updating business metrics: ${error.message}`);
    }
  };

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (account) {
        const db = getFirestore(app);
        const companyDocRef = doc(db, "businesses", account.address); // Assuming company ID is the document ID
        try {
          const docSnap = await getDoc(companyDocRef);
          if (docSnap.exists()) {
            setCompanyData(docSnap.data());
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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
        } catch (error) {
          console.error("Firebase Auth Error:", error);
          showErrorToast("Firebase Authentication Error");
        } finally {
          setIsLoadingAccount(false);
        }
      } else {
        setWorkers([]);
        setIsLoadingAccount(false);
        router.push("/auth/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const db = getFirestore(app);
    let unsubscribe;

    if (firebaseUser && account) {
      const businessDocRef = doc(db, "users", firebaseUser.uid);
      getDoc(businessDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const businessData = docSnap.data();
            const registeredAddress = businessData.wallet_address.toLowerCase();
            const currentAddress = account?.address.toLowerCase();

            if (registeredAddress !== currentAddress) {
              showErrorToast(
                "Connected wallet does not match the registered business account."
              );
              router.push("/auth/login");
              return;
            }

            const workersRef = collection(
              db,
              "businesses",
              account.address,
              "workers"
            );
            unsubscribe = onSnapshot(
              workersRef,
              (snapshot) => {
                const workersData = snapshot.docs.map((doc) => ({
                  worker_id: doc.id,
                  ...doc.data(),
                }));
                setWorkers(workersData);

                // Recalculate totals whenever worker list changes
                const newTotalPayroll = workersData.reduce(
                  (acc, worker) => acc + (worker.worker_salary || 0),
                  0
                );
                const newEmployeeCount = workersData.length;

                // Update business metrics (using onSnapshot, no separate call needed)
                updateDoc(doc(db, "businesses", account.address), {
                  totalPayroll: newTotalPayroll,
                  employeeCount: newEmployeeCount,
                }).catch((error) => {
                  console.error(
                    "Error updating business metrics in onSnapshot:",
                    error
                  );
                  showErrorToast("Error updating business data");
                });
              },
              (error) => {
                console.error("Error fetching workers:", error);
                showErrorToast(`Error fetching workers: ${error.message}`);
              }
            );
          } else {
            showErrorToast("Business data not found.");
            return;
          }
        })
        .catch((error) => {
          console.error("Error fetching business data:", error);
          showErrorToast(`Error fetching business data: ${error.message}`);
          router.push("/auth/login");
        });
    } else {
      setWorkers([]);
      if (unsubscribe) unsubscribe();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [firebaseUser, account, router]);

  useEffect(() => {
    const lowerSearch = searchQuery.toLowerCase();
    const results = workers.filter(
      (worker) =>
        (worker.worker_name?.toLowerCase().includes(lowerSearch) ||
          worker.worker_email?.toLowerCase().includes(lowerSearch) ||
          worker.role?.toLowerCase().includes(lowerSearch) ||
          worker.worker_wallet?.toLowerCase().includes(lowerSearch) ||
          formatCurrency(worker.worker_salary).includes(lowerSearch)) &&
        (selectedRoleFilter === "All" || worker.role === selectedRoleFilter)
    );
    setFilteredWorkers(results);
  }, [searchQuery, workers, selectedRoleFilter]);

  const handleAddWorker = async () => {
    if (
      !workerName.trim() ||
      !workerEmail.trim() ||
      !workerRole ||
      !workerSalary
    ) {
      showErrorToast(
        "Please fill in all required fields (Name, Email, Role, Salary)."
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workerEmail)) {
      showErrorToast("Please enter a valid email address.");
      return;
    }

    const salaryNum = parseFloat(workerSalary.replace(/[^0-9.-]+/g, ""));
    if (isNaN(salaryNum)) {
      showErrorToast("Please enter a valid salary amount.");
      return;
    }

    if (!account || !account.address) {
      showErrorToast("Please connect your wallet.");
      return;
    }

    const db = getFirestore(app);
    const user = auth.currentUser;

    if (!user) {
      showErrorToast("User not authenticated. Please sign in.");
      router.push("/auth/login");
      return;
    }

    const worker_id = Date.now().toString();
    const inviteLink = `${window.location.origin}/staff_connect/${firebaseUser.uid}/${worker_id}`;

    if (workers.some((worker) => worker.worker_email === workerEmail)) {
      showErrorToast("A worker with this email already exists.");
      return;
    }

    try {
      setIsAddingWorker(true);
      const workerData = {
        worker_name: workerName,
        inviteLink: inviteLink,
        businessId: firebaseUser.uid,
        worker_id: worker_id,
        businessname: companyData?.name,
        worker_email: workerEmail,
        role: workerRole,
        worker_salary: salaryNum,
        invitation_note: workerNote,
        status: "invited",
        createdAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, "businesses", account.address, "workers", worker_id),
        workerData
      );

      // Update business metrics
      await updateBusinessMetrics(db, account.address, salaryNum);

      setWorkerName("");
      setWorkerEmail("");
      setWorkerRole("");
      setWorkerSalary("");
      setWorkerNote("");
      setActiveTab("WORKER LIST");
      showSuccessToast("Worker added successfully!");
    } catch (error) {
      console.error("Error adding worker:", error);
      showErrorToast(`Error adding worker: ${error.message}`);
    } finally {
      setIsAddingWorker(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setUploadError("Please select a file.");
      return;
    }
    if (file.type !== "text/csv") {
      setUploadError("Please upload a valid CSV file.");
      return;
    }
    setUploadedFileName(file.name);
    setUploadError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        console.log("Parsed CSV data:", results.data);
        await processBulkUpload(results.data);
      },
      error: (error) => {
        console.error("CSV parsing error:", error.message);
        setUploadError(`Error parsing CSV file: ${error.message}`);
      },
    });
  };

  const processBulkUpload = async (data) => {
    if (!account) {
      showErrorToast("Please connect your wallet.");
      return;
    }
    const db = getFirestore(app);
    if (!auth.currentUser) {
      showErrorToast("User not authenticated.");
      router.push("/auth/login");
      return;
    }

    setIsBulkUploading(true);
    let totalAddedSalary = 0; // Track total salary for bulk update

    try {
      for (const row of data) {
        if (!row.name || !row.email || !row.role || !row.salary) {
          console.warn("Skipping row:", row);
          continue;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          console.warn("Invalid email:", row);
          continue;
        }
        const salaryNum = parseFloat(row.salary.replace(/[^0-9.-]+/g, ""));
        if (isNaN(salaryNum)) {
          console.warn("Invalid salary:", row);
          continue;
        }

        const worker_id = Date.now().toString();
        const inviteLink = `${window.location.origin}/staff_connect/${firebaseUser.uid}/${worker_id}`;
        const workerData = {
          worker_name: row.name,
          inviteLink: inviteLink,
          businessId: firebaseUser.uid,
          worker_id: worker_id,
          businessname: companyData?.name,
          worker_email: row.email,
          role: row.role,
          worker_salary: salaryNum,
          invitation_note: row.note || "",
          status: "invited",
          createdAt: serverTimestamp(),
        };

        try {
          const workerRef = doc(
            db,
            "businesses",
            account.address,
            "workers",
            worker_id
          );
          await setDoc(workerRef, workerData);
          totalAddedSalary += salaryNum; // Add to total
          setActiveTab("WORKER LIST");
        } catch (workerError) {
          console.error("Error uploading worker:", row, workerError);
          showErrorToast(
            `Error uploading worker ${row.name}: ${workerError.message}`
          );
          setIsBulkUploading(false); // Stop on error
          return;
        }
      }

      // Update business metrics *once* after all workers added.
      await updateBusinessMetrics(db, account.address, totalAddedSalary);
      showSuccessToast("Bulk worker upload successful!");
    } catch (error) {
      console.error("Error during bulk upload:", error);
      showErrorToast(`Error during bulk upload: ${error.message}`);
    } finally {
      setIsBulkUploading(false);
    }
  };

  const handleClearFile = () => {
    setUploadedFileName("");
    setUploadError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExportList = async () => {
    setIsExporting(true);
    try {
      const csvData = workers.map((worker) => ({
        Name: worker.worker_name,
        Email: worker.worker_email,
        Role: worker.role,
        Salary: worker.worker_salary,
        Status: worker.status,
        Wallet: worker.worker_wallet || "",
      }));
      const csv = Papa.unparse(csvData, { header: true });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "worker_list.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccessToast("Worker list exported successfully!");
    } catch (error) {
      console.error("Error exporting worker list:", error);
      showErrorToast(`Error exporting worker list: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const FilterDropdown = ({ options, selected, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    return (
      <div className="relative" ref={dropdownRef}>
        <div
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Filter size={16} className="text-gray-500" />
          <span>{selected}</span>
          <ChevronDown size={16} className="text-gray-500" />
        </div>
        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
            {options.map((option) => (
              <div
                key={option}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  onSelect(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4">
      <ToastContainer />
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Payroll Management</h1>
          <p className="text-sm text-gray-500">
            Manage worker list and invitations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleExportList}
            disabled={isLoadingAccount || isExporting}
          >
            <FileText size={16} />
            {isExporting ? "Exporting..." : "Export List"}
          </button>
        </div>
      </div>

      <div className="border-b mb-6">
        <div className="flex gap-8">
          {["WORKER LIST", "INVITE WORKER", "BULK WORKER INVITE"].map((tab) => (
            <button
              key={tab}
              className={`pb-2 transition-colors duration-200 ${
                activeTab === tab
                  ? "text-black border-b-2 border-black font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab(tab)}
              disabled={isLoadingAccount}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {isLoadingAccount ? (
        <div className="text-center p-8 text-gray-500">
          Loading account information...
        </div>
      ) : (
        <>
          {activeTab === "WORKER LIST" && (
            <>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <FilterDropdown
                    options={["All", ...WORKER_ROLES]}
                    selected={selectedRoleFilter}
                    onSelect={setSelectedRoleFilter}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <button
                    className="px-4 py-2 bg-black text-white rounded-lg flex items-center gap-2 hover:bg-gray-900"
                    onClick={() => setActiveTab("INVITE WORKER")}
                    disabled={isLoadingAccount}
                  >
                    <Plus size={16} /> Invite Worker
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center mb-6">
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="Search workers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100">
                {filteredWorkers.length > 0 ? (
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
                          Salary (USDC)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredWorkers.map((worker) => (
                        <tr key={worker.worker_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {worker.worker_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {worker.worker_wallet}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {worker.worker_email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`text-sm ${
                                worker.role === "Developer"
                                  ? "text-red-600"
                                  : worker.role === "Manager"
                                  ? "text-green-600"
                                  : "text-black"
                              }`}
                            >
                              {worker.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(worker.worker_salary)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                worker.status === "invited"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {worker.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    No workers found matching your criteria.
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "INVITE WORKER" && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4">Invite Worker</h2>
              <div className="bg-gray-50 border-l-4 border-gray-500 p-4 mb-6 rounded-r-lg">
                <div className="flex">
                  <div className="flex-shrink-0"></div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-700">
                      Use this page to invite workers by sending them a secure
                      email containing wallet connection details.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
                      value={workerName}
                      onChange={(e) => setWorkerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
                      value={workerEmail}
                      onChange={(e) => setWorkerEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
                      value={workerRole}
                      onChange={(e) => setWorkerRole(e.target.value)}
                    >
                      <option value="">Select role</option>
                      {WORKER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700">
                      Salary (Recurring salary in USDC)
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="text"
                        className="mt-1 block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
                        value={workerSalary}
                        onChange={(e) => setWorkerSalary(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Note
                  </label>
                  <textarea
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
                    value={workerNote}
                    onChange={(e) => setWorkerNote(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setActiveTab("WORKER LIST")}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-black rounded-md text-sm font-medium text-white hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    onClick={handleAddWorker}
                    disabled={isAddingWorker}
                  >
                    {isAddingWorker ? "Adding..." : "Add Worker"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "BULK WORKER INVITE" && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4">
                Bulk Invite Workers
              </h2>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bulk Upload (CSV)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".csv"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                  />
                  <div
                    className={`w-full p-6 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors ${
                      uploadedFileName ? "border-green-500" : ""
                    }`}
                  >
                    <UploadCloud size={48} className="text-gray-400" />
                    {uploadedFileName ? (
                      <>
                        <p className="text-sm text-gray-700">
                          Uploaded: {uploadedFileName}
                        </p>
                        <button
                          onClick={handleClearFile}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Clear
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Click to upload or drag and drop a CSV file
                      </p>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-sm text-red-500 mt-2">{uploadError}</p>
                  )}
                </div>
                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setActiveTab("WORKER LIST")}
                  >
                    Cancel
                  </button>
                </div>
              </div>
              {isBulkUploading && (
                <div className="text-center p-4 text-gray-500">
                  Uploading workers... Please wait.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
