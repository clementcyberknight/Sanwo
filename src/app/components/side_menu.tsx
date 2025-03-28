"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  LayoutDashboard,
  CalendarClock,
  FileText,
  Users,
  User,
  Wallet,
  BarChart3,
  TrendingUp,
  DollarSign,
  LucideProps,
  Loader2,
} from "lucide-react";
import {
  auth,
  app,
  getFirestore,
  doc,
  getDoc,
} from "@/app/config/FirebaseConfig";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { DocumentData } from "firebase/firestore";
import { User as FirebaseUser } from "firebase/auth";
import { toast } from "react-toastify";

interface MenuItem {
  name: string;
  icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
  >;
  path: string;
  disabled?: boolean;
}

const SideMenu = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [companyData, setCompanyData] = useState<DocumentData | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const { address } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    let authUnsubscribe: () => void;

    const initializeAuth = async () => {
      authUnsubscribe = auth.onAuthStateChanged(
        async (user: FirebaseUser | null) => {
          setFirebaseUser(user);
          setIsAuthReady(true);

          if (user) {
            if (!address) {
              console.log("Please connect your wallet to view worker data.");
              setIsLoading(false);
              return;
            }
          } else {
            router.push("/auth/login");
          }
        }
      );
    };

    initializeAuth();

    return () => {
      if (authUnsubscribe) authUnsubscribe();
    };
  }, [address, router]);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (address) {
        const db = getFirestore(app);
        const companyDocRef = doc(db, "businesses", address);
        console.log(address);
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
          setCompanyData(null);
          toast.error("Error fetching Company Data!");
        } finally {
          setIsLoading(false);
        }
      } else {
        setCompanyData(null);
        setIsLoading(false);
      }
    };

    if (address) {
      fetchCompanyData();
    } else {
      setIsLoading(false);
    }
  }, [address]);

  const menuItems: MenuItem[] = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/account/dashboard",
    },
    {
      name: "Scheduled Payments",
      icon: CalendarClock,
      path: "/account/scheduled-payments",
    },
    { name: "Payroll", icon: FileText, path: "/account/payroll" },
    { name: "Workers", icon: Users, path: "/account/workers" },
    {
      name: "Pay Workers",
      icon: DollarSign,
      path: "/account/pay_worker",
    },
    {
      name: "Contractors",
      icon: User,
      path: "/account/contractors",
    },
    {
      name: "Wallet",
      icon: Wallet,
      path: "/account/wallet",
    },
    {
      name: "Accounting",
      icon: BarChart3,
      path: "/account/accounting",
    },
    {
      name: "Investments",
      icon: TrendingUp,
      path: "/account/investment",
    },
  ];

  const companyInitial = companyData?.name
    ? companyData.name.charAt(0).toUpperCase()
    : "S"; // Changed default initial to "S"
  const companyName = companyData?.name || "Sanwó Business"; // Changed default company name to "Sanwó Business"

  return (
    <aside
      className={`relative h-screen sticky top-0 w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col transition-all duration-300 ease-in-out`}
    >
      {/* Company Logo */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
            {" "}
            {/* Changed logo background to black */}
            <span className="text-white font-bold text-xl">
              {companyInitial}
            </span>
          </div>
          <div className="overflow-hidden transition-all duration-300 w-full">
            <div className="font-semibold dark:text-white whitespace-nowrap">
              {companyName}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-hidden">
        <ul className="space-y-1 px-3">
          {menuItems.map((item) => (
            <li key={item.name}>
              <Link
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  item.disabled
                    ? "cursor-not-allowed opacity-50"
                    : pathname === item.path
                    ? "bg-gray-100 text-black dark:bg-gray-900 dark:text-white" // Changed active link styles to black and white
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
                title={item.name}
                onClick={item.disabled ? (e) => e.preventDefault() : undefined}
              >
                <item.icon
                  size={20}
                  className="flex-shrink-0 text-gray-500 dark:text-gray-400"
                />
                <span className="whitespace-nowrap transition-all duration-300 w-full opacity-100">
                  {item.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t dark:border-gray-700 flex flex-col gap-3">
        {!address ? (
          <div>
            {connectors
              .filter((connector) => connector.name === "MetaMask")
              .map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                  className="w-full py-3 rounded-lg bg-black hover:bg-gray-900 transition-colors duration-200 text-white flex items-center justify-center" // Changed button styles to black and white
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-3" />
                      Connecting...
                    </>
                  ) : (
                    "Connect Wallet"
                  )}
                </button>
              ))}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-gray-100 rounded-lg p-3">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </div>
            <button
              onClick={() => disconnect()}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Logout */}
        <Link
          href="/logout"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Logout"
        >
          <LogOut
            size={18}
            className="flex-shrink-0 text-gray-500 dark:text-gray-400"
          />
          <span className="whitespace-nowrap transition-all duration-300 w-full opacity-100">
            Logout
          </span>
        </Link>
      </div>
    </aside>
  );
};

export default SideMenu;
