"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  MoreVertical,
  FileText,
  Edit,
  X,
  Trash,
} from "lucide-react";
import {
  auth,
  app,
  getFirestore,
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "@/app/config/FirebaseConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

// =================== Utility Functions ===================
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

const formatWalletAddress = (address) => {
  if (!address || address.length < 6) {
    return address; // Return original if too short
  }
  const start = address.substring(0, 5);
  const end = address.substring(address.length - 4);
  return `${start}...${end}`;
};

// =================== Main Component ===================
const WorkersPage = () => {
  //Skeleton component - To prevent this type of error is recommendable to define the component here
  const Skeleton = () => (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="animate-pulse bg-gray-200 h-4 w-48 rounded-md"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="animate-pulse bg-gray-200 h-4 w-32 rounded-md"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="animate-pulse bg-gray-200 h-4 w-40 rounded-md"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="animate-pulse bg-gray-200 h-4 w-24 rounded-md"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="animate-pulse bg-gray-200 h-4 w-32 rounded-md"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="animate-pulse bg-gray-200 h-4 w-24 rounded-md"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="animate-pulse bg-gray-200 h-4 w-24 rounded-md"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="animate-pulse bg-gray-200 h-4 w-16 rounded-md"></div>
      </td>
    </tr>
  );
  // ---------- State Variables ----------
  const router = useRouter(); // Initialize router
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredWorkers, setFilteredWorkers] = useState([]);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("All");
  const [workers, setWorkers] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Loading state
  const [isExporting, setIsExporting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [menuPosition, setMenuPosition] = useState("bottom"); // Default position

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editWorker, setEditWorker] = useState(null);

  // Modal specific state
  const [workerName, setWorkerName] = useState("");
  const [workerSalary, setWorkerSalary] = useState("");
  const [workerRole, setWorkerRole] = useState("");
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const account = useAccount();
  const [firebaseUser, setFirebaseUser] = useState(null);

  // ---------- References ----------
  const menuRefs = useRef({}); // Ref for the menu buttons - changed to an object to store multiple refs

  // ---------- Constants ----------
  const WORKER_ROLES = [
    "Developer",
    "Manager",
    "Admin",
    "Designer",
    "Marketing",
    "Support",
  ];

  // ---------- Effect Hooks ----------

  // Firebase Auth State Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          // Authentication success, no additional actions needed here, focus on data fetching
        } catch (error) {
          console.error("Firebase Auth Error:", error);
          showErrorToast("Authentication error. Please try again.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setWorkers([]);
        setIsLoading(false);
        router.push("/auth/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Firestore Data Fetching and Wallet Verification
  useEffect(() => {
    let unsubscribe;

    if (firebaseUser && account && account.address) {
      const db = getFirestore(app);

      const fetchBusinessDataAndWorkers = async () => {
        try {
          const businessDocRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(businessDocRef);

          if (docSnap.exists()) {
            const businessData = docSnap.data();
            const registeredAddress = businessData.wallet_address.toLowerCase();
            const currentAddress = account.address.toLowerCase();

            if (registeredAddress !== currentAddress) {
              showErrorToast(
                "Connected wallet does not match the registered business account."
              );
              router.push("/auth/login");
              return; // Early return
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
                console.log("Fetched workers:", workersData);
              },
              (error) => {
                console.error("Error fetching workers:", error);
                showErrorToast(`Error fetching workers: ${error.message}`);
              }
            );
          } else {
            showErrorToast("Business data not found.");
            router.push("/auth/login");
          }
        } catch (error) {
          console.error("Error fetching business data:", error);
          showErrorToast(`Error fetching business data: ${error.message}`);
          router.push("/auth/login");
        } finally {
          setIsLoading(false);
        }
      };

      fetchBusinessDataAndWorkers();
    } else {
      setWorkers([]);
      setIsLoading(false);
      if (unsubscribe) unsubscribe();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [firebaseUser, account, router]);

  // Worker Filtering
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

  // ---------- UI Handlers ----------
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

  // ---------- Menu & Modal Management ----------
  // FIXED: Updated toggleMenu function
  const toggleMenu = (workerId, event) => {
    console.log("Toggle menu clicked for worker ID:", workerId);

    if (event) {
      event.stopPropagation(); // Prevent event bubbling
    }

    // Close menu if clicking on the same worker and menu is already open
    if (selectedWorkerId === workerId && isMenuOpen) {
      console.log("Closing menu as it's already open for this worker");
      setIsMenuOpen(false);
      setSelectedWorkerId(null);
      return;
    }

    setSelectedWorkerId(workerId);
    setIsMenuOpen(true);

    // Check menu position
    const menuButton = menuRefs.current[workerId];
    if (menuButton) {
      const rect = menuButton.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      if (windowHeight - rect.bottom < 200) {
        console.log("Setting menu position to top");
        setMenuPosition("top");
      } else {
        console.log("Setting menu position to bottom");
        setMenuPosition("bottom");
      }
    }

    console.log(
      "Menu state updated - isMenuOpen:",
      true,
      "selectedWorkerId:",
      workerId
    );
  };

  const closeMenu = () => {
    console.log("Closing menu");
    setIsMenuOpen(false);
    setSelectedWorkerId(null);
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside any menu
      let clickedInsideMenu = false;

      // Check if clicked element is inside any menu
      document.querySelectorAll('[role="menu"]').forEach((menu) => {
        if (menu.contains(event.target)) {
          clickedInsideMenu = true;
        }
      });

      // Check if clicked on any menu toggle button
      Object.values(menuRefs.current).forEach((ref) => {
        if (ref && ref.contains(event.target)) {
          clickedInsideMenu = true;
        }
      });

      if (!clickedInsideMenu && isMenuOpen) {
        console.log("Click outside detected, closing menu");
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  // FIXED: Updated handleEditWorker function
  const handleEditWorker = (worker, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log("Edit worker clicked for:", worker);

    // Set worker details in the state
    setEditWorker(worker);
    setWorkerName(worker.worker_name || "");
    setWorkerSalary(worker.worker_salary?.toString() || "");
    setWorkerRole(worker.role || "");

    // Open the modal
    setIsModalOpen(true);

    // Close the menu
    closeMenu();

    console.log("Modal opened with worker data:", {
      name: worker.worker_name,
      salary: worker.worker_salary,
      role: worker.role,
    });
  };

  const handleCloseModal = () => {
    console.log("Closing modal");
    setIsModalOpen(false);
    setEditWorker(null);
    setWorkerName("");
    setWorkerSalary("");
    setWorkerRole("");
    setError(null);
  };

  const handleRoleFilter = (role) => {
    setSelectedRoleFilter(role);
  };

  // ---------- Toasts ----------
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

  // ---------- Modal Handlers (Inline) ----------
  const handleSave = async () => {
    // Basic validation
    if (!workerName.trim()) {
      setError("Worker name is required.");
      return;
    }
    if (isNaN(Number(workerSalary))) {
      setError("Salary must be a number.");
      return;
    }
    setError(null);
    setIsSaving(true);

    const db = getFirestore(app);
    const workerDocRef = doc(
      db,
      "businesses",
      account.address,
      "workers",
      editWorker.worker_id
    );

    try {
      await updateDoc(workerDocRef, {
        worker_name: workerName,
        worker_salary: parseFloat(workerSalary),
        role: workerRole,
      });
      toast.success("Worker details updated successfully!", {
        position: "top-right",
        autoClose: 3000,
      });

      // Optimistically update the worker list in the state.
      setWorkers((prevWorkers) =>
        prevWorkers.map((worker) =>
          worker.worker_id === editWorker.worker_id
            ? {
                ...worker,
                worker_name: workerName,
                worker_salary: parseFloat(workerSalary),
                role: workerRole,
              }
            : worker
        )
      );
      setFilteredWorkers((prevWorkers) =>
        prevWorkers.map((worker) =>
          worker.worker_id === editWorker.worker_id
            ? {
                ...worker,
                worker_name: workerName,
                worker_salary: parseFloat(workerSalary),
                role: workerRole,
              }
            : worker
        )
      );

      handleCloseModal(); // Close modal after saving
    } catch (error) {
      console.error("Error updating worker:", error);
      toast.error(`Error updating worker: ${error.message}`, {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorker = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this worker? This action cannot be undone."
      )
    ) {
      return; // User cancelled deletion
    }
    setIsDeleting(true);

    const db = getFirestore(app);
    const workerDocRef = doc(
      db,
      "businesses",
      account.address,
      "workers",
      editWorker.worker_id
    );

    try {
      await deleteDoc(workerDocRef);
      toast.success("Worker deleted successfully!", {
        position: "top-right",
        autoClose: 3000,
      });

      // Optimistically update the worker list by removing the deleted worker
      setWorkers((prevWorkers) =>
        prevWorkers.filter(
          (worker) => worker.worker_id !== editWorker.worker_id
        )
      );
      setFilteredWorkers((prevWorkers) =>
        prevWorkers.filter(
          (worker) => worker.worker_id !== editWorker.worker_id
        )
      );

      handleCloseModal(); // Close modal after successful deletion
    } catch (error) {
      console.error("Error deleting worker:", error);
      toast.error(`Error deleting worker: ${error.message}`, {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------- UI Components ----------
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
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group flex items-center justify-between px-4 py-2 text-sm font-medium leading-5 text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-gray-500 focus:border-gray-500 transition ease-in-out duration-150"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <Filter size={16} className="text-gray-500" />
          <span className="ml-2">{selected}</span>
          <ChevronDown size={16} className="text-gray-500" />
        </button>

        {isOpen && (
          <div
            className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="menu-button"
            tabIndex="-1"
          >
            <div className="py-1" role="none">
              {options.map((option) => (
                <div
                  key={option}
                  onClick={() => {
                    onSelect(option);
                    setIsOpen(false);
                  }}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                  role="menuitem"
                >
                  {option}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  // ---------- Component Return ----------
  return (
    <div className="min-h-screen bg-white py-6 px-4 sm:px-6 lg:px-8">
      <ToastContainer />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Manage Workers
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              View and manage your workforce.
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              type="button"
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              onClick={handleExportList}
              disabled={isLoading || isExporting}
            >
              <FileText size={16} className="mr-2" />
              {isExporting ? "Exporting..." : "Export List"}
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-6 bg-white shadow rounded-lg p-4">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0 md:space-x-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="search"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
                placeholder="Search workers"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Role Filter Dropdown */}
            <div className="w-full md:w-auto">
              <div className="relative inline-block text-left">
                <FilterDropdown
                  options={WORKER_ROLES}
                  selected={selectedRoleFilter}
                  onSelect={handleRoleFilter}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Worker List Table */}
        <div className="mt-8">
          <div className="shadow overflow-x-auto border-b border-gray-200 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Wallet Address
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Role
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Salary
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} /> //Loading Skeleton
                    ))
                  : filteredWorkers.length > 0
                  ? filteredWorkers.map((worker) => (
                      <tr key={worker.worker_id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {worker.worker_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 truncate max-w-[150px]">
                            {formatWalletAddress(worker.worker_wallet)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {worker.worker_email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {worker.role}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(worker.worker_salary)}
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="relative">
                            <button
                              type="button"
                              className="p-1 rounded-full hover:bg-gray-100"
                              id={`menu-button-${worker.worker_id}`}
                              aria-expanded={
                                isMenuOpen &&
                                selectedWorkerId === worker.worker_id
                              }
                              aria-haspopup="true"
                              onClick={(e) => toggleMenu(worker.worker_id, e)}
                              ref={(el) =>
                                (menuRefs.current[worker.worker_id] = el)
                              }
                            >
                              <MoreVertical
                                size={16}
                                className="text-gray-500"
                              />
                            </button>

                            {selectedWorkerId === worker.worker_id &&
                              isMenuOpen && (
                                <div
                                  className={`origin-top-right absolute right-0 z-10 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none ${
                                    menuPosition === "top"
                                      ? "bottom-full mb-2"
                                      : "mt-2"
                                  }`}
                                  role="menu"
                                  aria-orientation="vertical"
                                  aria-labelledby={`menu-button-${worker.worker_id}`}
                                  tabIndex="-1"
                                  style={{
                                    top:
                                      menuPosition === "top"
                                        ? "auto"
                                        : undefined,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="py-1" role="none">
                                    <button
                                      className="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                      role="menuitem"
                                      tabIndex="-1"
                                      id={`menu-item-edit-${worker.worker_id}`}
                                      onClick={(e) =>
                                        handleEditWorker(worker, e)
                                      }
                                    >
                                      <div className="flex items-center">
                                        <Edit size={16} className="mr-2" />
                                        Edit
                                      </div>
                                    </button>
                                  </div>
                                </div>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))
                  : !isLoading && (
                      <tr>
                        <td
                          colSpan="7"
                          className="text-center p-8 text-gray-500"
                        >
                          No workers found matching your criteria.
                        </td>
                      </tr>
                    )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Inline Edit Worker Modal */}
      {isModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Modal overlay */}
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
              onClick={handleCloseModal}
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            {/* This element is to trick the browser into centering the modal content. */}
            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              ​
            </span>

            {/* Modal panel */}
            <div
              className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-headline"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <div className="sm:flex sm:items-center sm:justify-between">
                      <h3
                        className="text-lg leading-6 font-medium text-gray-900"
                        id="modal-headline"
                      >
                        Edit Worker Details
                      </h3>
                      <button
                        onClick={handleCloseModal}
                        type="button"
                        className="rounded-md bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 sm:-mr-2 flex justify-center items-center p-2"
                      >
                        <X
                          className="h-5 w-5 text-gray-500"
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <div className="mt-4">
                      {error && (
                        <div className="text-red-500 mb-2">{error}</div>
                      )}
                      <div className="mb-4">
                        <label
                          htmlFor="workerName"
                          className="block text-gray-700 text-sm font-bold mb-2"
                        >
                          Name
                        </label>
                        <input
                          type="text"
                          id="workerName"
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          placeholder="Worker's Name"
                          value={workerName}
                          onChange={(e) => setWorkerName(e.target.value)}
                          disabled={isSaving || isDeleting}
                        />
                      </div>
                      <div className="mb-4">
                        <label
                          htmlFor="workerSalary"
                          className="block text-gray-700 text-sm font-bold mb-2"
                        >
                          Salary
                        </label>
                        <input
                          type="text"
                          id="workerSalary"
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          placeholder="Salary"
                          value={workerSalary}
                          onChange={(e) => setWorkerSalary(e.target.value)}
                          disabled={isSaving || isDeleting}
                        />
                      </div>
                      <div className="mb-4">
                        <label
                          htmlFor="workerRole"
                          className="block text-gray-700 text-sm font-bold mb-2"
                        >
                          Role
                        </label>
                        <select
                          id="workerRole"
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          value={workerRole}
                          onChange={(e) => setWorkerRole(e.target.value)}
                          disabled={isSaving || isDeleting}
                        >
                          <option value="">Select Role</option>
                          {WORKER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:justify-between">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
                  onClick={handleDeleteWorker}
                  disabled={isDeleting || isSaving}
                >
                  {isDeleting ? (
                    "Deleting..."
                  ) : (
                    <>
                      <Trash size={16} className="mr-2" /> Delete Worker
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-black text-base font-medium text-white hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black sm:w-auto sm:text-sm"
                  onClick={handleSave}
                  disabled={isSaving || isDeleting}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkersPage;
