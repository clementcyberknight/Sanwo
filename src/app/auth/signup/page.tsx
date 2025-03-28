"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Globe,
  Users,
  Briefcase,
  Loader2,
  ChevronRight,
  Check,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  app,
  getFirestore,
  setDoc,
  doc,
  serverTimestamp,
  auth,
  sendEmailVerification,
  createUserWithEmailAndPassword,
} from "@/app/config/FirebaseConfig";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const SignupPage = () => {
  const router = useRouter();
  interface FormErrors {
    email?: string;
    password?: string;
    companyName?: string;
    companyWebsite?: string;
    companySize?: string;
    industry?: string;
  }

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { address } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const [companyDetails, setCompanyDetails] = useState({
    companyName: "",
    companyWebsite: "",
    companySize: "",
    industry: "",
  });
  const [payrollDetails, setPayrollDetails] = useState<{
    payrollFrequency: string;
    monthlyTransactionVolume: string;
    featuresOfInterest: string[];
  }>({
    payrollFrequency: "",
    monthlyTransactionVolume: "",
    featuresOfInterest: [],
  });

  const formRefs = {
    companyName: useRef(null),
    companyWebsite: useRef(null),
    companySize: useRef(null),
    industry: useRef(null),
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

  const validateStep1 = () => {
    const errors = {};
    if (!email) {
      //@ts-ignore
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      //@ts-ignore
      errors.email = "Email address is invalid";
    }
    if (!password) {
      //@ts-ignore
      errors.password = "Password is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors = {};
    const fields = Object.keys(formRefs);

    fields.forEach((field) => {
      //@ts-ignore
      const value = formRefs[field].current?.value;
      if (!value || value.trim() === "") {
        //@ts-ignore
        errors[field] = `${
          field
            .replace(/([A-Z])/g, " $1")
            .charAt(0)
            .toUpperCase() +
          field
            .replace(/([A-Z])/g, " $1")
            .slice(1)
            .toLowerCase()
        } is required`;
      }
      // Special validation for companyWebsite
      if (field === "companyWebsite" && value) {
        try {
          new URL(value); // This will throw an error if the URL is invalid
        } catch (_) {
          //@ts-ignore
          errors.companyWebsite = "Invalid URL format";
        }
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
    } else if (step === 2) {
      if (validateStep2()) {
        setCompanyDetails({
          //@ts-ignore
          companyName: formRefs.companyName.current?.value,
          //@ts-ignore
          companyWebsite: formRefs.companyWebsite.current?.value,
          //@ts-ignore
          companySize: formRefs.companySize.current?.value,
          //@ts-ignore
          industry: formRefs.industry.current?.value,
        });
        setStep(3);
      }
    }
  };

  const handleFeatureChange = (feature: string) => {
    setPayrollDetails((prev) => {
      const features = prev.featuresOfInterest.includes(feature)
        ? prev.featuresOfInterest.filter((f) => f !== feature)
        : [...prev.featuresOfInterest, feature];
      return { ...prev, featuresOfInterest: features };
    });
  };

  const handleCreateAccount = async () => {
    if (!validateStep1()) return;
    if (!companyDetails.companyName) {
      showErrorToast("Company name is required");
      return;
    }
    if (!address) {
      showErrorToast("Please connect your wallet.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Firebase Authentication (Sign Up)
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Send email verification
      //@ts-ignore
      await sendEmailVerification(auth.currentUser);

      // 2. Save User to Firestore (using wallet address as ID)
      const success = await saveUserToFirestore(address, user.uid);
      if (success) {
        showSuccessToast(
          "Account created successfully! Email verification sent."
        );
        router.push("/auth/login");
      }
    } catch (error) {
      console.error("Signup error:", error);
      //@ts-ignore
      showErrorToast(`Signup failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUserToFirestore = async (address: string, uid: string) => {
    const db = getFirestore(app);
    try {
      const now = serverTimestamp();

      const businessData = {
        name: companyDetails.companyName,
        branding: { logoUrl: "", themeColor: "" },
        settings: {
          paymentSchedule: payrollDetails.payrollFrequency,
        },
        CompanyId: address,
        companyWalletAddress: address,
        balance: 0,
        createdAt: now,
        updatedAt: now,
        companyWebsite: companyDetails.companyWebsite,
        companySize: companyDetails.companySize,
        industry: companyDetails.industry,
        monthlyTransactionVolume: payrollDetails.monthlyTransactionVolume,
        featuresOfInterest: payrollDetails.featuresOfInterest,
        email: email,
      };

      await setDoc(doc(db, "businesses", address), businessData);
      console.log("Business document written with ID: ", address);

      const userRef = doc(db, "users", uid);
      await setDoc(userRef, {
        userId: uid,
        wallet_address: address,
      });
      console.log("User document written with ID: ", uid);
      return true;
    } catch (error) {
      console.error("Firestore error:", error);
      showErrorToast("Failed to create account. Please try again.");
      return false;
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-white to-gray-50 overflow-hidden">
      <ToastContainer />

      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex items-center space-x-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center">
              <div
                className={`rounded-full w-8 h-8 flex items-center justify-center ${
                  step >= i
                    ? "bg-black text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > i ? <Check className="h-4 w-4" /> : i}
              </div>
              {i < 3 && (
                <div
                  className={`w-12 h-1 mx-1 ${
                    step > i ? "bg-black" : "bg-gray-200"
                  }`}
                ></div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full max-w-7xl mx-auto my-8 rounded-2xl overflow-hidden shadow-2xl">
        {/* Left Section - Form */}
        <div className="w-1/2 p-10 bg-white">
          <div className="mb-8">
            <Link href="/" className="flex items-center">
              <Image
                src="/owo.png"
                alt="Sanwó Logo"
                width={140}
                height={140}
                className="mr-2"
              />
            </Link>
          </div>

          <div className="max-w-lg">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {step === 1
                ? "Create your account"
                : step === 2
                ? "Tell us about your company"
                : "Almost there!"}
            </h1>
            <p className="text-gray-600 mb-8">
              {step === 1
                ? "Start managing your business payroll in minutes"
                : step === 2
                ? "Help us customize your experience"
                : "Just a few more details to get you started"}
            </p>

            <div className="space-y-5">
              {step === 1 && (
                <>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
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
                      className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
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

                  <button
                    onClick={handleNext}
                    className="w-full py-3 rounded-lg bg-black text-white hover:bg-gray-900 transition-colors flex items-center justify-center"
                  >
                    <span>Continue</span>
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Company Name
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        ref={formRefs.companyName}
                        type="text"
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                        placeholder="Enter your company name"
                      />
                      {formErrors.companyName && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.companyName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Company Website
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        ref={formRefs.companyWebsite}
                        type="url"
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                        placeholder="https://yourcompany.com"
                      />
                      {formErrors.companyWebsite && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.companyWebsite}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Company Size
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <select
                        ref={formRefs.companySize}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent appearance-none"
                      >
                        <option value="">Select company size</option>
                        <option value="1-10">1-10 employees</option>
                        <option value="11-50">11-50 employees</option>
                        <option value="51-200">51-200 employees</option>
                        <option value="201-500">201-500 employees</option>
                        <option value="500+">500+ employees</option>
                      </select>
                      {formErrors.companySize && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.companySize}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Industry
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <select
                        ref={formRefs.industry}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent appearance-none"
                      >
                        <option value="">Select industry</option>
                        <option value="defi">DeFi</option>
                        <option value="nft">NFT/Digital Assets</option>
                        <option value="gaming">Gaming</option>
                        <option value="dao">DAO</option>
                        <option value="depin">DePIN</option>
                        <option value="desci">DeSci</option>
                        <option value="technology">Technology</option>
                        <option value="finance">Finance</option>
                        <option value="other">Other</option>
                      </select>
                      {formErrors.industry && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.industry}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleNext}
                    className="w-full py-3 rounded-lg bg-black text-white hover:bg-gray-900 transition-colors flex items-center justify-center"
                  >
                    <span>Continue</span>
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Payroll Frequency
                    </label>
                    <select
                      className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent appearance-none"
                      value={payrollDetails.payrollFrequency}
                      onChange={(e) =>
                        setPayrollDetails({
                          ...payrollDetails,
                          payrollFrequency: e.target.value,
                        })
                      }
                    >
                      <option value="">Select payroll frequency</option>
                      <option value="weekly">Weekly</option>
                      <option value="bi-weekly">Bi-Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Monthly Transaction Volume
                    </label>
                    <select
                      className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent appearance-none"
                      value={payrollDetails.monthlyTransactionVolume}
                      onChange={(e) =>
                        setPayrollDetails({
                          ...payrollDetails,
                          monthlyTransactionVolume: e.target.value,
                        })
                      }
                    >
                      <option value="">Select monthly volume</option>
                      <option value="0-1000 dollars">0 - $1,000</option>
                      <option value="1000-10,000 dollars">
                        $1,000 - $10,000
                      </option>
                      <option value="10000-50000 dollars">
                        $10,000 - $50,000
                      </option>
                      <option value="50000-100000 dollars">
                        $50,000 - $100,000
                      </option>
                      <option value="100000+ dollars">$100,000+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Features of Interest
                    </label>
                    <div className="space-y-2">
                      {[
                        {
                          id: "usdcWallets",
                          label: "USDC Wallets and Banking",
                        },
                        {
                          id: "automatedBookkeeping",
                          label: "Automated Bookkeeping & Tax",
                        },
                        { id: "payrollBenefits", label: "Payroll & Benefits" },
                        {
                          id: "treasuryManagement",
                          label: "Treasury Management",
                        },
                        {
                          id: "reportingAnalytics",
                          label: "Reporting & Analytics",
                        },
                      ].map((feature) => (
                        <label
                          key={feature.id}
                          className="flex items-center p-2 rounded-lg hover:bg-gray-50"
                        >
                          <div
                            className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${
                              payrollDetails.featuresOfInterest.includes(
                                feature.id
                              )
                                ? "bg-black border-black"
                                : "border-gray-300"
                            }`}
                          >
                            {payrollDetails.featuresOfInterest.includes(
                              feature.id
                            ) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={payrollDetails.featuresOfInterest.includes(
                              feature.id
                            )}
                            onChange={() => handleFeatureChange(feature.id)}
                          />
                          <span>{feature.label}</span>
                        </label>
                      ))}
                    </div>
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
                    onClick={handleCreateAccount}
                    disabled={isLoading || !address}
                    className={`w-full py-3 rounded-lg bg-black hover:bg-gray-900 transition-colors duration-200 text-white flex items-center justify-center ${
                      isLoading || !address
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5 mr-3" />
                        Creating Account...
                      </>
                    ) : (
                      "Create Business Account"
                    )}
                  </button>
                </>
              )}

              <p className="text-sm text-gray-600 mt-4">
                By creating an account, you agree to our{" "}
                <Link href="/terms" className="text-black hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-black hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Right Section - Feature Showcase */}
        <div className="w-1/2 bg-gradient-to-br from-gray-900 to-gray-800 p-10 flex flex-col justify-between">
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
                    className="w-8 h-8 rounded-full bg-white/20 border-2 border-gray-700 flex items-center justify-center text-xs text-white"
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

export default SignupPage;
