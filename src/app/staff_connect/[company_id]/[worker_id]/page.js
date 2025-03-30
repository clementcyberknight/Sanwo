"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  app,
  getFirestore,
  setDoc,
  doc,
  getDoc,
} from "@/app/config/FirebaseConfig";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useParams } from "next/navigation";

export default function WorkerConnectPage() {
  const router = useRouter();
  const { company_id, worker_id } = useParams();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const account = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    handleResize();

    // Log IDs on component mount
    console.log("Company ID:", company_id);
    console.log("Worker ID:", worker_id);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [company_id, worker_id]);

  useEffect(() => {
    if (account && account.address) {
      setWalletAddress(account.address);
    } else {
      setWalletAddress("");
    }
  }, [account]);

  const showToast = (message, type = "error") => {
    toast[type](message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  const handleSubmit = () => {
    if (!account || !account.address) {
      showToast("Please connect your wallet.");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);

    try {
      if (!company_id || !worker_id) {
        showToast("Invalid company ID or worker ID.");
        return;
      }

      if (!account || !account.address) {
        showToast("Please connect your wallet.");
        return;
      }

      const db = getFirestore(app);
      const workerRef = doc(db, "Workers", company_id, "workers", worker_id);
      const workerSnap = await getDoc(workerRef);

      await setDoc(
        workerRef,
        {
          worker_wallet: account.address,
          status: "active",
          company_id: company_id,
        },
        { merge: true }
      );

      showToast("Wallet address saved successfully!", "success");
      setShowSuccessModal(true);
      router.push(`/`);
    } catch (error) {
      console.error("Error saving wallet address:", error);
      showToast(`Error saving wallet address: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-white to-gray-50">
        <ToastContainer />

        {/* Left Section */}
        <div
          className={`${
            isMobile ? "w-full p-6" : "w-1/2 p-12"
          } flex flex-col justify-center`}
        >
          <div className="max-w-md mx-auto w-full">
            <h1
              className={`${
                isMobile ? "text-3xl" : "text-[40px]"
              } font-medium text-gray-800 mb-4`}
            >
              Welcome to Sanwó
            </h1>
            <p
              className={`text-gray-600 mb-8 ${
                isMobile ? "text-base" : "text-lg"
              }`}
            >
              To receive payments from your employer, please connect your USDC
              wallet.
            </p>

            {/* Wallet Address Display */}
            <div className="mb-6">
              <label
                className={`block text-gray-700 ${
                  isMobile ? "text-base" : "text-lg"
                } mb-2`}
              >
                Connected Wallet Address
              </label>
              <input
                type="text"
                value={walletAddress}
                placeholder="Connect your wallet"
                className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-black text-gray-600"
                readOnly
                disabled
              />
            </div>

            {/* Connect Wallet Button */}
            <div className="mb-8 flex justify-center">
              {!account.address ? (
                <div>
                  {connectors
                    .filter((connector) => connector.name === "MetaMask")
                    .map((connector) => (
                      <button
                        key={connector.uid}
                        onClick={() => connect({ connector })}
                        disabled={isPending}
                        className="w-full py-3 rounded-lg bg-black hover:bg-gray-900 transition-colors duration-200 text-white flex items-center justify-center"
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
                      {account.address.slice(0, 6)}...
                      {account.address.slice(-4)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading || !account}
              className={`w-full bg-black text-white py-4 rounded-xl mb-4 hover:bg-gray-900 ${
                isMobile ? "text-base" : "text-lg"
              } font-medium ${
                isLoading || !account ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-3 inline-block" />
                  Submitting...
                </>
              ) : (
                "Confirm Wallet"
              )}
            </button>

            {/* Terms Text */}
            <p
              className={`text-gray-500 ${isMobile ? "text-sm" : "text-base"}`}
            >
              By submitting or connecting your wallet you agree to{" "}
              <Link href="/terms" className="text-black hover:underline">
                Terms of service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-black hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Right Section - Hidden on Mobile */}
        {!isMobile && (
          <div className="w-1/2 bg-black p-16 flex flex-col justify-center">
            <div className="text-white max-w-xl">
              <h2 className="text-5xl font-bold mb-6">
                No limits, no borders, no wahala.
              </h2>
              <p className="text-2xl mb-16">
                Receive salary payment faster, easier and more securely
              </p>

              {/* Payment Cards Container */}
              <div className="relative mt-12">
                <div className="transform rotate-[-15deg] w-[300px]">
                  <Image
                    src="/coinbase.png"
                    alt="Coinbase Transaction Card"
                    width={300}
                    height={180}
                    className="w-full h-auto rounded-2xl shadow-lg"
                  />
                </div>

                <div className="absolute top-24 left-64 transform rotate-[15deg] w-[300px]">
                  <Image
                    src="/phantom.png"
                    alt="Phantom Transaction Card"
                    width={300}
                    height={180}
                    className="w-full h-auto rounded-2xl shadow-lg"
                  />
                </div>

                <div className="absolute -top-20 right-0 animate-[flight_3s_ease-in-out_infinite]">
                  <Image
                    src="/pplane.png"
                    alt="Paper Plane"
                    width={120}
                    height={120}
                    className="w-auto h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full">
            <h3
              className={`${isMobile ? "text-lg" : "text-xl"} font-medium mb-4`}
            >
              Confirm Wallet Address
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to save this wallet address?
              <br />
              <span className="text-sm break-all mt-2 block">
                {walletAddress}
              </span>
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-black text-white rounded-xl"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-3 inline-block" />
                    Confirming...
                  </>
                ) : (
                  "Confirm"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl text-center max-w-md w-full">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3
              className={`${
                isMobile ? "text-xl" : "text-2xl"
              } font-medium mb-4`}
            >
              Successfully sent
            </h3>
            <p className="text-black text-lg">wallet address saved</p>
          </div>
        </div>
      )}
    </>
  );
}
