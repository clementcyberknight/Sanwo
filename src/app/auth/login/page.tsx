"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Check, ChevronRight } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  app,
  getFirestore,
  doc,
  getDoc,
  auth,
  signInWithEmailAndPassword,
  sendEmailVerification,
  getAuth,
} from "@/app/config/FirebaseConfig";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const SigninPage = () => {
  const router = useRouter();
  interface FormErrors {
    email?: string;
    password?: string;
  }

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const { address } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userData, setUserData] = useState(null);

  const showErrorToast = (message: string) => {
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

  const showSuccessToast = (message: string) => {
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

  const validateForm = () => {
    const errors: FormErrors = {};
    if (!email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "Email address is invalid";
    }
    if (!password) {
      errors.password = "Password is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;

    if (!address) {
      showErrorToast("Please connect your wallet before signing in.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      if (!user.emailVerified) {
        showErrorToast(
          "Email not verified. Please verify your email address before signing in."
        );
        handleResendVerificationEmail();
        setIsLoading(false);
        return;
      }

      const db = getFirestore(app);
      const businessDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(businessDocRef);

      if (docSnap.exists()) {
        const businessData = docSnap.data();
        const registeredAddress = businessData.wallet_address.toLowerCase();
        const currentAddress = address.toLowerCase();

        if (registeredAddress !== currentAddress) {
          showErrorToast(
            "Wallet address does not match the registered business account."
          );
          setIsLoading(false);
          return;
        }

        //@ts-ignore
        setUserData(businessData);
        showSuccessToast("Sign in successful! Proceeding...");
        router.push("/account/dashboard");
        console.log("Current user UID:", user.uid);
      } else {
        showErrorToast("User data not found in Firestore.");
      }
    } catch (firebaseError) {
      console.error("Firebase sign-in error:", firebaseError);
      //@ts-ignore
      showErrorToast(`Firebase sign-in failed: ${firebaseError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    const lastSentTime = localStorage.getItem("email_verification_sent");
    if (lastSentTime) {
      const timeDiff = Date.now() - Number.parseInt(lastSentTime, 10);
      const twoHours = 2 * 60 * 60 * 1000;
      if (timeDiff < twoHours) {
        showErrorToast(
          "Verification email was sent recently. Please wait before resending."
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      const authInstance = getAuth();
      //@ts-ignore
      await sendEmailVerification(authInstance.currentUser);
      showSuccessToast(
        "Verification email resent. Please check your inbox and spam folder."
      );
      localStorage.setItem("email_verification_sent", Date.now().toString());
    } catch (error) {
      console.error("Error resending verification email:", error);
      showErrorToast(
        "Failed to resend verification email. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-white to-blue-50 overflow-hidden">
      <ToastContainer />

      <div className="flex w-full max-w-7xl mx-auto my-8 rounded-2xl overflow-hidden shadow-2xl">
        {/* Left Section - Form */}
        <div className="w-1/2 p-10 bg-white">
          <div className="mb-8">
            <Link href="/" className="flex items-center">
              <Image
                src="/triv.png"
                alt="Sanwó Logo"
                width={40}
                height={40}
                className="mr-2"
              />
              <span className="text-xl font-bold text-blue-900">Sanwó</span>
            </Link>
          </div>

          <div className="max-w-lg">
            <h1 className="text-3xl font-bold text-blue-900 mb-2">
              Welcome back
            </h1>
            <p className="text-gray-600 mb-8">
              Sign in to access your business account
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {formErrors.email && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {formErrors.password && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.password}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="pt-4">
                {!address ? (
                  <div>
                    {connectors
                      .filter((connector) => connector.name === "MetaMask")
                      .map((connector) => (
                        <button
                          key={connector.uid}
                          onClick={() => connect({ connector })}
                          disabled={isPending}
                          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white flex items-center justify-center"
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
              </div>

              <button
                onClick={handleSignIn}
                disabled={isLoading || !email || !password || !address}
                className={`w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white flex items-center justify-center ${
                  isLoading || !email || !password || !address
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-3" />
                    Signing In...
                  </>
                ) : (
                  <span className="flex items-center">
                    Sign In
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </span>
                )}
              </button>

              <div className="text-center mt-6">
                <p className="text-gray-600">
                  Don't have an account?{" "}
                  <Link
                    href="/auth/signup"
                    className="text-blue-600 font-medium hover:underline"
                  >
                    Create an account
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Feature Showcase */}
        <div className="w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-10 flex flex-col justify-between">
          <div className="text-white">
            <h2 className="text-3xl font-semibold mb-4">
              The simplest way to manage your workforce payroll
            </h2>
            <p className="text-xl opacity-90 mb-6">
              Seamlessly pay your remote workers with just a click
            </p>

            <div className="space-y-4 mt-8">
              {[
                {
                  title: "Global Payments",
                  description: "Pay anyone, anywhere in the world instantly",
                },
                {
                  title: "Low Fees",
                  description: "Save up to 90% on international transfers",
                },
                {
                  title: "Compliance Built-in",
                  description: "Automatic tax and regulatory compliance",
                },
              ].map((feature, index) => (
                <div key={index} className="flex items-start">
                  <div className="bg-white/20 rounded-full p-1 mr-3 mt-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium">{feature.title}</h3>
                    <p className="text-sm opacity-80">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <div className="flex items-center space-x-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-white/20 border-2 border-blue-600 flex items-center justify-center text-xs text-white"
                  >
                    {i}
                  </div>
                ))}
              </div>
              <p className="text-white text-sm">
                Join <span className="font-bold">2,500+</span> businesses
                already using Sanwó
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SigninPage;
