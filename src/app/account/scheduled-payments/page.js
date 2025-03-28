"use client";

import { useState, useEffect, useRef } from "react";
import {
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Edit,
  Users,
  Filter,
  ChevronDown,
  Plus,
  Search,
  MoreVertical,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import {
  auth,
  app,
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  getDoc,
} from "@/app/config/FirebaseConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDate = (dateValue) => {
  try {
    if (!dateValue) return "N/A";

    if (typeof dateValue === "object" && "seconds" in dateValue) {
      return new Date(dateValue.seconds * 1000).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "N/A";
  }
};

const PAYMENT_INTERVALS = ["Weekly", "Monthly"];
const WEEKLY_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const OVERVIEW_FILTERS = ["All", "Regular Payroll", "Overtime", "Bonus"];

const Skeleton = () => (
  <div className="animate-pulse bg-gray-200 h-10 w-full rounded-lg"></div>
);

// --- Main Component ---

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const account = useAccount();

  const router = useRouter();

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

  // --- State for Overview Tab ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState(OVERVIEW_FILTERS[0]);
  const [viewMode, setViewMode] = useState("list");
  const [filteredPayments, setFilteredPayments] = useState([]);
  const paymentId = Date.now().toString();

  // --- State for Edit Payroll Schedule Tab ---
  const [paymentInterval, setPaymentInterval] = useState("Monthly");
  const [paymentDay, setPaymentDay] = useState("Last working day");
  const [specificDate, setSpecificDate] = useState(1);
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState(WEEKLY_DAYS[0]);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [nextPaymentDate, setNextPaymentDate] = useState(null); // State for next payment date

  // --- State for Business Metrics (Overview) ---
  const [totalPayroll, setTotalPayroll] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [ytdPayroll, setYtdPayroll] = useState(0);

  // State to manage the selected payment and the modal visibility
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Add this new state
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);

  // Add this new state declaration
  const [paymentHistory, setPaymentHistory] = useState([]);

  // Add these new state variables after other state declarations
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Number of items to show per page
  const [totalPages, setTotalPages] = useState(1);

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
        setEmployees([]);
        setPaymentHistory([]);
        setIsLoadingAccount(false);
        router.push("/auth/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    let unsubscribeEmployees;
    let unsubscribePayrolls;

    if (firebaseUser && account) {
      const fetchBusinessData = async () => {
        const db = getFirestore(app);
        const businessDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const docSnap = await getDoc(businessDocRef);
          if (docSnap.exists()) {
            const businessData = docSnap.data();
            const registeredAddress = businessData.wallet_address.toLowerCase();
            const currentAddress = account?.address.toLowerCase();

            if (registeredAddress !== currentAddress) {
              showErrorToast(
                "Connected wallet does not match registered business account."
              );
              router.push("/auth/login");
              return;
            }

            const employeesRef = collection(
              db,
              "businesses",
              account.address,
              "workers"
            );
            unsubscribeEmployees = onSnapshot(
              employeesRef,
              (snapshot) => {
                const employeeData = snapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                }));
                setEmployees(employeeData);
                // Calculate total payroll and employee count from employee data
                const newTotalPayroll = employeeData.reduce(
                  (acc, emp) => acc + (emp.worker_salary || 0),
                  0
                );
                const newEmployeeCount = employeeData.length;
                setTotalPayroll(newTotalPayroll);
                setEmployeeCount(newEmployeeCount);
              },
              (error) => {
                console.error("Error fetching employees:", error);
                showErrorToast(`Error fetching employees: ${error.message}`);
              }
            );

            const payrollsRef = collection(
              db,
              "businesses",
              account.address,
              "payrolls"
            );
            unsubscribePayrolls = onSnapshot(
              payrollsRef,
              (snapshot) => {
                const payrollData = snapshot.docs
                  .map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                  }))
                  .sort((a, b) => {
                    // Sort by payrollDate in descending order (newest first)
                    const dateA = a.payrollDate?.seconds || 0;
                    const dateB = b.payrollDate?.seconds || 0;
                    return dateB - dateA;
                  });

                setPaymentHistory(payrollData);

                // Calculate YTD payroll from sorted payroll data
                const currentYear = new Date().getFullYear();
                const newYtdPayroll = payrollData
                  .filter((payroll) => {
                    const payrollDate = payroll.payrollDate?.seconds
                      ? new Date(payroll.payrollDate.seconds * 1000)
                      : null;
                    return (
                      payrollDate?.getFullYear() === currentYear &&
                      payroll.payrollStatus === "Success"
                    );
                  })
                  .reduce(
                    (acc, payroll) => acc + (payroll.totalAmount || 0),
                    0
                  );
                setYtdPayroll(newYtdPayroll);
              },
              (error) => {
                console.error("Error fetching payroll history:", error);
                showErrorToast(
                  `Error fetching payroll history: ${error.message}`
                );
              }
            );

            setPaymentInterval(
              businessData.settings?.paymentInterval || "Monthly"
            );
            setPaymentDay(
              businessData.settings?.paymentDay || "Last working day"
            );
            setSpecificDate(businessData.settings?.specificDate || 1);
            setSelectedWeeklyDay(
              businessData.settings?.selectedWeeklyDay || WEEKLY_DAYS[0]
            );
            setStartDate(businessData.settings?.startDate || "");

            // Fetch and set next payment date
            setNextPaymentDate(
              businessData.settings?.nextPaymentDate
                ? new Date(businessData.settings.nextPaymentDate.seconds * 1000)
                : null
            );

            // Fetch business metrics directly (if needed for initial display before onSnapshot fires)
            const businessMetricsRef = doc(db, "businesses", account.address);
            const businessMetricsSnap = await getDoc(businessMetricsRef);
            if (businessMetricsSnap.exists()) {
              const metrics = businessMetricsSnap.data();
              // Only set if not already set by onSnapshot (avoid race condition)
              setTotalPayroll((prev) =>
                prev === 0 ? metrics.totalPayroll || 0 : prev
              );
              setEmployeeCount((prev) =>
                prev === 0 ? metrics.employeeCount || 0 : prev
              );
            }
          } else {
            console.log("No such document!");
            showErrorToast("Business data not found.");
            router.push("/auth/login");
            return;
          }
        } catch (error) {
          console.error("Error fetching business data:", error);
          showErrorToast(`Error fetching business data: ${error.message}`);
          router.push("/auth/login");
        }
      };

      fetchBusinessData();
    } else {
      setEmployees([]);
      setPaymentHistory([]);
      setTotalPayroll(0);
      setEmployeeCount(0);
      setYtdPayroll(0);
    }

    return () => {
      if (unsubscribeEmployees) unsubscribeEmployees();
      if (unsubscribePayrolls) unsubscribePayrolls();
    };
  }, [firebaseUser, account, router]);

  // Add this new function after other function declarations
  const paginate = (items) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  // Modify the useEffect that handles filtering to include pagination
  useEffect(() => {
    const filtered = paymentHistory.filter((payment) => {
      if (!payment) return false;

      const searchLower = searchQuery.toLowerCase();
      const dateStr = payment.date ? formatDate(payment.date) : "";
      const amountStr = payment.amount ? formatCurrency(payment.amount) : "";
      const typeStr = payment.type ? payment.type.toLowerCase() : "";

      const dateMatch = dateStr.toLowerCase().includes(searchLower);
      const amountMatch = amountStr.toLowerCase().includes(searchLower);
      const typeMatch = typeStr.includes(searchLower);
      const filterMatch =
        selectedFilter === "All" || payment.type === selectedFilter;

      return (dateMatch || amountMatch || typeMatch) && filterMatch;
    });

    // Calculate total pages
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));

    // Reset to first page when filters change
    if (currentPage > Math.ceil(filtered.length / itemsPerPage)) {
      setCurrentPage(1);
    }

    // Apply pagination to filtered results
    setFilteredPayments(paginate(filtered));
  }, [searchQuery, selectedFilter, paymentHistory, currentPage, itemsPerPage]);

  // Add this new function to handle page changes
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Replace the existing pagination section with this updated version
  const PaginationSection = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg mt-4">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium ${
              currentPage === 1
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium ${
              currentPage === totalPages
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">
                {Math.min(
                  (currentPage - 1) * itemsPerPage + 1,
                  filteredPayments.length
                )}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(currentPage * itemsPerPage, filteredPayments.length)}
              </span>{" "}
              of <span className="font-medium">{paymentHistory.length}</span>{" "}
              results
            </p>
          </div>
          <div>
            <nav
              className="isolate inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center rounded-l-md px-2 py-2 ${
                  currentPage === 1
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-400 hover:bg-gray-50"
                } ring-1 ring-inset ring-gray-300`}
              >
                <span className="sr-only">Previous</span>
                <ChevronRight size={16} className="rotate-180" />
              </button>

              {pageNumbers.map((number) => (
                <button
                  key={number}
                  onClick={() => handlePageChange(number)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    currentPage === number
                      ? "bg-black text-white"
                      : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {number}
                </button>
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center rounded-r-md px-2 py-2 ${
                  currentPage === totalPages
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-400 hover:bg-gray-50"
                } ring-1 ring-inset ring-gray-300`}
              >
                <span className="sr-only">Next</span>
                <ChevronRight size={16} />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  const handlePayrollScheduleSave = async () => {
    if (!firebaseUser || !account?.address) {
      showErrorToast("Authentication required");
      return;
    }

    setIsUpdating(true);

    try {
      const db = getFirestore(app);
      const businessRef = doc(db, "businesses", account.address);
      const scheduleDocRef = doc(businessRef, "payroll_schedules", "current");

      const calculatedNextPaymentDate = calculateNextPaymentDate(
        paymentInterval,
        selectedWeeklyDay,
        specificDate
      ); //Calculate

      const scheduleData = {
        paymentInterval,
        paymentDay:
          paymentInterval === "Monthly" ? paymentDay : selectedWeeklyDay,
        specificDate: paymentInterval === "Monthly" ? specificDate : null,
        startDate: startDate || serverTimestamp(),
        nextPaymentDate: calculatedNextPaymentDate, // Save calculated date
        status: "active",
        lastUpdated: serverTimestamp(),
        updatedBy: firebaseUser.uid,
      };

      await setDoc(scheduleDocRef, scheduleData, { merge: true });

      await updateDoc(businessRef, {
        "settings.paymentInterval": paymentInterval,
        "settings.paymentDay": paymentDay,
        "settings.specificDate": specificDate,
        "settings.selectedWeeklyDay": selectedWeeklyDay,
        "settings.nextPaymentDate": calculatedNextPaymentDate, // AND HERE
        "settings.lastUpdated": serverTimestamp(),
      });

      // Update local state
      setNextPaymentDate(calculatedNextPaymentDate);

      showSuccessToast("Payroll schedule updated successfully!");
      setActiveTab("OVERVIEW");
    } catch (error) {
      console.error("Error updating payroll schedule:", error);
      showErrorToast(`Failed to update payroll schedule: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const fetchCurrentSchedule = async () => {
      if (!firebaseUser || !account?.address) return;

      try {
        const db = getFirestore(app);
        const scheduleDocRef = doc(
          db,
          "businesses",
          account.address,
          "payroll_schedules",
          "current"
        );
        const scheduleDoc = await getDoc(scheduleDocRef);

        if (scheduleDoc.exists()) {
          const data = scheduleDoc.data();
          setPaymentInterval(data.paymentInterval || "Monthly");
          setPaymentDay(data.paymentDay || "Last working day");
          setSpecificDate(data.specificDate || 1);
          setSelectedWeeklyDay(data.selectedWeeklyDay || WEEKLY_DAYS[0]);

          // Correctly handle the startDate, checking for Timestamp
          if (data.startDate && data.startDate.seconds) {
            setStartDate(
              new Date(data.startDate.seconds * 1000)
                .toISOString()
                .split("T")[0]
            );
          } else {
            setStartDate(""); // Or some default value if startDate is not a timestamp
          }

          // Set next payment date from fetched data
          if (data.nextPaymentDate) {
            // Check if nextPaymentDate is a Firestore Timestamp
            if (
              data.nextPaymentDate.seconds &&
              data.nextPaymentDate.nanoseconds
            ) {
              setNextPaymentDate(new Date(data.nextPaymentDate.seconds * 1000));
            } else if (typeof data.nextPaymentDate === "string") {
              // Handle string date (e.g., ISO string)
              setNextPaymentDate(new Date(data.nextPaymentDate));
            } else {
              console.warn(
                "Unexpected nextPaymentDate format:",
                data.nextPaymentDate
              );
              setNextPaymentDate(null); // Or some default/error date
            }
          }
        }
      } catch (error) {
        console.error("Error fetching payroll schedule:", error);
        showErrorToast(`Error fetching schedule: ${error.message}`);
      }
    };

    fetchCurrentSchedule();
  }, [firebaseUser, account?.address]);

  const getOrdinalSuffix = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  // Add this new function for deleting payroll schedule
  const handleDeleteSchedule = async () => {
    if (!firebaseUser || !account?.address) {
      showErrorToast("Authentication required");
      return;
    }

    setIsDeletingSchedule(true);

    try {
      const db = getFirestore(app);
      const businessRef = doc(db, "businesses", account.address);
      const scheduleDocRef = doc(businessRef, "payroll_schedules", "current");

      // Delete the schedule document
      await setDoc(
        scheduleDocRef,
        {
          status: "inactive",
          deletedAt: serverTimestamp(),
          deletedBy: firebaseUser.uid,
        },
        { merge: true }
      );

      // Update business settings
      await updateDoc(businessRef, {
        "settings.paymentInterval": null,
        "settings.paymentDay": null,
        "settings.specificDate": null,
        "settings.selectedWeeklyDay": null,
        "settings.nextPaymentDate": null,
        "settings.lastUpdated": serverTimestamp(),
      });

      // Reset local state
      setPaymentInterval("Monthly");
      setPaymentDay("Last working day");
      setSpecificDate(1);
      setSelectedWeeklyDay(WEEKLY_DAYS[0]);
      setNextPaymentDate(null);

      showSuccessToast("Payroll schedule deleted successfully!");
      setActiveTab("OVERVIEW");
    } catch (error) {
      console.error("Error deleting payroll schedule:", error);
      showErrorToast(`Failed to delete payroll schedule: ${error.message}`);
    } finally {
      setIsDeletingSchedule(false);
    }
  };

  const FilterDropdown = ({ options, selected, onSelect }) => (
    <div className="relative group">
      <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
        <Filter size={16} className="text-gray-500" />
        <span>{selected}</span>
        <ChevronDown size={16} className="text-gray-500" />
      </div>
      <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 hidden group-hover:block">
        {options.map((option) => (
          <div
            key={option}
            className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
            onClick={() => onSelect(option)}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  );

  const RadioOption = ({ value, label, description, isSelected, onChange }) => (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        isSelected
          ? "border-black bg-gray-50"
          : "border-gray-200 hover:border-black hover:bg-gray-50"
      }`}
      onClick={onChange}
    >
      <div className="flex items-start space-x-3">
        <div
          className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${
            isSelected ? "border-black bg-black" : "border-gray-300"
          }`}
        >
          {isSelected && <Check size={12} className="text-white" />}
        </div>
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
    </div>
  );

  const handleViewPayment = (payment) => {
    setSelectedPayment(payment);
    setIsModalOpen(true);
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedPayment(null);
    setIsModalOpen(false);
  };

  const calculateNextPaymentDate = (interval, selectedDay, specificDate) => {
    const today = new Date();
    let nextPaymentDate = new Date();

    switch (interval) {
      case "Weekly":
        const weekdays = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const currentDay = today.getDay();
        const targetDay = weekdays.indexOf(selectedDay);
        let daysUntilTarget = targetDay - currentDay;

        if (daysUntilTarget <= 0) {
          daysUntilTarget += 7;
        }
        nextPaymentDate.setDate(today.getDate() + daysUntilTarget);
        break;

      case "Monthly":
        nextPaymentDate.setMonth(today.getMonth() + 1);

        if (selectedDay === "Last working day") {
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1, 0);
          while (
            nextPaymentDate.getDay() === 0 ||
            nextPaymentDate.getDay() === 6
          ) {
            nextPaymentDate.setDate(nextPaymentDate.getDate() - 1);
          }
        } else {
          nextPaymentDate.setDate(specificDate);
          while (
            nextPaymentDate.getDay() === 0 ||
            nextPaymentDate.getDay() === 6
          ) {
            nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
          }
        }
        break;
    }

    while (
      nextPaymentDate.getDay() === 0 ||
      nextPaymentDate.getDay() === 6 ||
      nextPaymentDate < today
    ) {
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
    }

    return nextPaymentDate;
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4">
      <ToastContainer />
      {/* Header */}
      {isLoadingAccount ? (
        <Skeleton />
      ) : (
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Payroll Management</h1>
            <p className="text-sm text-gray-500">
              Manage employee compensation, benefits, and schedules
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 flex items-center gap-2 hover:bg-gray-50">
              <FileText size={16} />
              Export Report
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-8">
          {["OVERVIEW", "EDIT PAYROLL SCHEDULE"].map((tab) => (
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

      {/* --- OVERVIEW TAB CONTENT --- */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* Overview Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Next Payroll Card */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">
                  Next Payroll
                </h3>
                <span className="p-2 bg-gray-100 rounded-full">
                  <Calendar size={16} className="text-black" />
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-semibold">
                  {nextPaymentDate ? formatDate(nextPaymentDate) : "Unavailble"}
                </p>
                <p className="text-sm text-gray-500">
                  {nextPaymentDate
                    ? (() => {
                        const today = new Date();
                        const diffTime =
                          nextPaymentDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(
                          diffTime / (1000 * 60 * 60 * 24)
                        );
                        return diffDays > 0
                          ? `${diffDays} days from now`
                          : "Today";
                      })()
                    : "No scheduled payroll"}
                </p>
              </div>
            </div>

            {/* Total Amount Card */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">
                  Total Payroll
                </h3>
                <span className="p-2 bg-green-100 rounded-full">
                  <DollarSign size={16} className="text-green-600" />
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-semibold">
                  {formatCurrency(totalPayroll)}
                </p>
                <p className="text-sm text-gray-500">
                  For {employeeCount} employees
                </p>
              </div>
            </div>

            {/* Payment Schedule */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">
                  Payment Schedule
                </h3>
                <span className="p-2 bg-purple-100 rounded-full">
                  <Clock size={16} className="text-purple-600" />
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-semibold">{paymentInterval}</p>
                <p className="text-sm text-gray-500">
                  {paymentInterval === "Monthly" &&
                    (paymentDay === "Last working day"
                      ? "Last working day"
                      : `On the ${specificDate}${getOrdinalSuffix(
                          specificDate
                        )}`)}
                  {paymentInterval === "Weekly" && `Every ${selectedWeeklyDay}`}
                  {/* Removed Bi-weekly display */}
                </p>
              </div>
            </div>

            {/* YTD Payroll Card */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">
                  YTD Payroll
                </h3>
                <span className="p-2 bg-amber-100 rounded-full">
                  <DollarSign size={16} className="text-amber-600" />
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-semibold">Unavailable</p>
              </div>
            </div>
          </div>

          {/* Controls (Filter, View Mode, Search) */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <FilterDropdown
                options={OVERVIEW_FILTERS}
                selected={selectedFilter}
                onSelect={setSelectedFilter}
              />

              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  className={`px-3 py-2 ${
                    viewMode === "list"
                      ? "bg-gray-50 text-black"
                      : "bg-white text-gray-500"
                  }`}
                  onClick={() => setViewMode("list")}
                >
                  <FileText size={16} />
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                placeholder="Search payment history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Payment History Table */}
          <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100">
            {filteredPayments.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recipients
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
                  {filteredPayments.map((payroll) => (
                    <tr key={payroll.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {payroll.payrollDate
                            ? new Date(
                                payroll.payrollDate.seconds * 1000
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(payroll.totalAmount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {payroll.recipients?.length || 0} employees
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            payroll.payrollStatus === "Success"
                              ? "bg-green-100 text-green-800"
                              : payroll.payrollStatus === "Failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {payroll.payrollStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                          onClick={() => handleViewPayment(payroll)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center p-8 text-gray-500">
                No payroll history found
              </div>
            )}
          </div>

          {/* Pagination */}
          <PaginationSection />
        </div>
      )}

      {/* --- EDIT PAYROLL SCHEDULE TAB CONTENT --- */}
      {activeTab === "EDIT PAYROLL SCHEDULE" && (
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-semibold mb-6">
              Payment Schedule Settings
            </h2>

            <div className="bg-gray-50 border-l-4 border-black p-4 mb-8 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Clock className="h-5 w-5 text-black" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-700">
                    Changes to the payment schedule will be applied starting
                    from the next payment cycle. Current scheduled payments will
                    not be affected.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Payment Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Interval
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  How frequently do you want to process payroll?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {PAYMENT_INTERVALS.map((interval) => (
                    <RadioOption
                      key={interval}
                      value={interval}
                      label={interval}
                      description={
                        interval === "Weekly"
                          ? "Every week on a specified day"
                          : interval === "Monthly" //Simplified condition
                          ? "Once a month on a specified date"
                          : "" // No description needed for removed options
                      }
                      isSelected={paymentInterval === interval}
                      onChange={() => setPaymentInterval(interval)}
                    />
                  ))}
                </div>
              </div>

              {/* Payment Day */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Day
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Which day should payments be processed?
                </p>

                {paymentInterval === "Monthly" && (
                  <div className="space-y-4">
                    <RadioOption
                      value="Last working day"
                      label="Last working day of the month"
                      isSelected={paymentDay === "Last working day"}
                      onChange={() => setPaymentDay("Last working day")}
                    />

                    <div className="flex items-center space-x-3">
                      <input
                        id="specific-date"
                        type="radio"
                        checked={paymentDay === "Specific date"}
                        onChange={() => setPaymentDay("Specific date")}
                        className="h-4 w-4 text-black focus:ring-black focus:border-gray-300 rounded"
                      />
                      <label
                        htmlFor="specific-date"
                        className="text-sm text-gray-700"
                      >
                        Specific date of month
                      </label>

                      {paymentDay === "Specific date" && (
                        <select
                          className="ml-2 rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-black focus:outline-none focus:ring-black"
                          value={specificDate}
                          onChange={(e) =>
                            setSpecificDate(parseInt(e.target.value))
                          } // Parse to integer
                        >
                          {[...Array(28)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {paymentInterval === "Weekly" && (
                  <select
                    className="rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-black focus:outline-none focus:ring-black"
                    value={selectedWeeklyDay}
                    onChange={(e) => setSelectedWeeklyDay(e.target.value)}
                  >
                    {WEEKLY_DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                )}

                {/* Removed Bi-weekly section */}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <button
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
                  onClick={handleDeleteSchedule}
                  disabled={isDeletingSchedule}
                >
                  {isDeletingSchedule ? "Deleting..." : "Delete Schedule"}
                </button>
                <button
                  className={`px-4 py-2 ${
                    isUpdating
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-black hover:bg-gray-900"
                  } rounded-md text-sm font-medium text-white`}
                  onClick={handlePayrollScheduleSave}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {isModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
          <div className="relative bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
            <div className="absolute top-2 right-2">
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <h2 className="text-xl font-semibold mb-4">Payroll Details</h2>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Payroll ID:</span>{" "}
                {selectedPayment.payrollId || "N/A"}
              </div>
              <div>
                <span className="font-medium">Date:</span>{" "}
                {selectedPayment.payrollDate
                  ? new Date(
                      selectedPayment.payrollDate.seconds * 1000
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "N/A"}
              </div>
              <div>
                <span className="font-medium">Total Amount:</span>{" "}
                {formatCurrency(selectedPayment.totalAmount)}
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                {selectedPayment.payrollStatus}
              </div>
              <div>
                <span className="font-medium">Token:</span>{" "}
                {selectedPayment.payrollToken}
              </div>
              <div>
                <span className="font-medium">Transaction Hash:</span>{" "}
                <span className="text-sm text-gray-500 break-all">
                  {selectedPayment.transactionHash}
                </span>
              </div>
              <div>
                <span className="font-medium">Recipients:</span>
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {selectedPayment.recipients?.map((recipient, index) => (
                    <div
                      key={index}
                      className="text-sm border-b border-gray-100 py-2"
                    >
                      <div>{recipient.recipientName}</div>
                      <div className="text-gray-500 text-xs">
                        {formatCurrency(recipient.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
