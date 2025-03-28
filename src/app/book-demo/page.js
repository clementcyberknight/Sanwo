"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Users,
  Building,
  Globe,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { db, collection, addDoc } from "@/app/config/FirebaseConfig";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function BookDemo() {
  const [step, setStep] = useState(1);
  const router = useRouter();
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Simplified form data without personal info
  const [formData, setFormData] = useState({
    companyName: "",
    companyWebsite: "",
    companySize: "",
    industry: "",
    email: "", // Keep email for contact purposes
  });

  const features = [
    {
      icon: <Calendar className="w-6 h-6 text-blue-600" />,
      title: "30-Min Product Tour",
      description: "Comprehensive walkthrough of Sanwó platform",
    },
    {
      icon: <Users className="w-6 h-6 text-blue-600" />,
      title: "Q&A Session",
      description: "Direct interaction with our product specialists",
    },
    {
      icon: <Building className="w-6 h-6 text-blue-600" />,
      title: "Custom Solutions",
      description: "Tailored discussion for your business needs",
    },
  ];

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Add validation function
  const validateForm = () => {
    const errors = [];

    if (!formData.companyName.trim()) {
      errors.push("Company name is required");
    }

    if (!formData.companySize) {
      errors.push("Company size is required");
    }

    if (!formData.industry) {
      errors.push("Industry is required");
    }

    if (!formData.email) {
      errors.push("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push("Please enter a valid email address");
    }

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();

    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error));
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "DemoRequest"), {
        ...formData,
        timestamp: new Date(),
      });
      toast.success(
        "Demo successfully booked! Check your email for the meeting details."
      );
      setBookingConfirmed(true);
      setTimeout(() => router.push("/"), 5000);
    } catch (error) {
      console.error("Error adding document: ", error);
      toast.error("Failed to book demo. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Section - Form */}
      <div className="w-1/2 p-12 flex flex-col">
        <div className="mb-12 flex-shrink-0">
          <Link href="/" className="flex items-center">
            <img src="/triv.png" alt="Sanwó Logo" className="w-10 h-10" />
          </Link>
        </div>

        <div className="flex-1">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Book Your Personalized Demo
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            See how Sanwó can streamline your web3 business operations
          </p>

          {/* Progress Steps or Confirmation Message */}
          {bookingConfirmed ? (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-8">
              <strong className="font-bold">Success!</strong>
              <span className="block sm:inline">
                {" "}
                Your demo is booked. An email with the meeting link and details
                has been sent to {formData.email}.
              </span>
            </div>
          ) : (
            <div className="flex mb-12">
              <div
                className={`h-1 w-1/2 ${
                  step >= 1 ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
              <div
                className={`h-1 w-1/2 ${
                  step >= 2 ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            </div>
          )}

          {!bookingConfirmed && (
            <div className="space-y-6">
              <div>
                <label className="block text-gray-700 mb-2 font-medium">
                  Company Name*
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your company name"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-medium">
                  Company Website
                </label>
                <div className="flex">
                  <div className="bg-gray-50 p-3 border border-r-0 border-gray-300 rounded-l-lg">
                    <Globe className="w-5 h-5 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    name="companyWebsite"
                    value={formData.companyWebsite}
                    onChange={handleInputChange}
                    className="flex-1 p-3 border border-l-0 border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="www.yourcompany.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">
                    Company Size*
                  </label>
                  <select
                    name="companySize"
                    value={formData.companySize}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">
                    Industry*
                  </label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select industry</option>
                    <option value="web3">Web3/Crypto</option>
                    <option value="defi">DeFi</option>
                    <option value="nft">NFT/Digital Assets</option>
                    <option value="dao">DAO</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-medium">
                  Work Email*
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="name@company.com"
                  required
                />
              </div>

              <button
                onClick={handleSubmit}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center justify-center"
              >
                Book Your Demo
              </button>
            </div>
          )}

          <p className="text-sm text-gray-500 mt-6">
            By booking a demo, you agree to our{" "}
            <Link href="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>

      {/* Right Section - Info */}
      <div className="w-1/2 bg-gray-50 p-12 flex flex-col">
        <div className="flex-1">
          <div className="max-w-lg">
            <h2 className="text-3xl font-semibold text-gray-900 mb-8">
              What to Expect
            </h2>

            <div className="space-y-8 mb-12">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start">
                  <div className="bg-white p-2 rounded-lg shadow-sm">
                    {feature.icon}
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Featured Demo Highlights
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center text-gray-600">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mr-3" />
                  USDC Treasury Management
                </li>
                <li className="flex items-center text-gray-600">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mr-3" />
                  Automated Crypto Payroll
                </li>
                <li className="flex items-center text-gray-600">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mr-3" />
                  AI-Powered Bookkeeping
                </li>
                <li className="flex items-center text-gray-600">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mr-3" />
                  Compliance & Reporting
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-12">
          <div className="flex items-center p-4 bg-blue-50 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600 mr-3" />
            <p className="text-sm text-gray-600">
              Average demo duration: 30 minutes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
