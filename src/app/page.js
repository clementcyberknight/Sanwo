"use client";
import React from "react";
import Link from "next/link";
import {
  Clock,
  FileText,
  Shield,
  UserCheck,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { Mail } from "lucide-react";
import { useState, useEffect } from "react";
import Header from "./components/header";
import { motion } from "framer-motion";

const FeatureSection = () => {
  const features = [
    {
      icon: <DollarSign className="w-8 h-8 text-gray-900 " />,
      title: "USDC Treasury Management",
      description:
        "Effortlessly manage your crypto treasury and track USDC balances in real-time.",
    },
    {
      icon: <Clock className="w-8 h-8 text-gray-900" />,
      title: "Automated Crypto Payroll",
      description:
        "Simplify payroll for your web3 team with automated USDC payouts and compliance.",
    },
    {
      icon: <FileText className="w-8 h-8 text-gray-900" />,
      title: "Transparent Financial Reporting",
      description:
        "Gain clear insights with detailed reports tailored for crypto businesses.",
    },
    {
      icon: <Shield className="w-8 h-8 text-gray-900" />,
      title: "Blockchain-Based Security",
      description:
        "Leverage blockchain for secure and transparent financial operations.",
    },
    {
      icon: <UserCheck className="w-8 h-8 text-gray-900" />,
      title: "Web3 Founder Focused",
      description:
        "Built with the unique needs of web3 founders and teams in mind.",
    },
    {
      icon: <CreditCard className="w-8 h-8 text-gray-900" />,
      title: "Crypto to Card Payments",
      description:
        "Pay business expenses directly from your crypto balance using a company card.",
    },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* All-in-One Platform Section */}
        <motion.div
          className="flex flex-col lg:flex-row justify-between items-center mb-20 gap-12"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="lg:w-1/2">
            <motion.h2
              className="text-4xl sm:text-5xl font-semibold text-gray-800 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Reclaim Your Time with the All-in-One Web3 Back Office
            </motion.h2>
          </div>
          <div className="lg:w-1/2">
            <motion.p
              className="text-xl text-gray-600 leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Stop juggling multiple platforms. Sanwó streamlines your web3
              business setup, from USDC banking and crypto payroll to automated
              bookkeeping and taxes – all in one unified platform.
            </motion.p>
            <Link href="/product">
              <motion.button
                className="mt-8 bg-gray-900  text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition duration-300 inline-flex items-center gap-2 font-medium"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                Learn More
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 18L15 12L9 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="bg-white rounded-xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col items-center text-center h-full" // Reduced padding to p-6 on smaller screens, p-8 on sm and up
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              // Removed style={{ width: 'calc(100% + 10px)' }}
            >
              <motion.div
                className="mb-5 bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {feature.icon}
              </motion.div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const TrackCostsSection = () => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Title */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-semibold text-gray-800 mb-4">
            Complete Web3 Business Suite
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to run your crypto-native business, all in one
            seamless platform.
          </p>
        </motion.div>

        {/* First Layout - USDC Banking */}
        <motion.div
          className="flex flex-col lg:flex-row items-center gap-16 mb-32"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="lg:w-1/2 order-2 lg:order-1"
            initial={{ x: -50, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl">
              <motion.img
                src="/card.svg"
                alt="USDC Banking Dashboard Preview"
                className="w-full h-auto"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400 }}
              />
            </div>
          </motion.div>
          <motion.div
            className="lg:w-1/2 order-1 lg:order-2"
            initial={{ x: 50, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="space-y-6">
              <h2 className="text-3xl font-semibold text-gray-800">
                USDC Banking for Web3
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Manage your crypto finances with ease. Open USDC wallets, issue
                crypto-enabled cards, and streamline payments all within Sanwó.
                Designed for the speed of web3.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Real-time USDC balance tracking
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Instant crypto transfers to any wallet
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Multi-signature security for all transactions
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Crypto to card payments for expenses
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>
        </motion.div>

        {/* Second Layout - Automated Bookkeeping */}
        <motion.div
          className="flex flex-col lg:flex-row items-center gap-16 mb-32"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="lg:w-1/2"
            initial={{ x: -50, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="space-y-6">
              <h2 className="text-3xl font-semibold text-gray-800">
                AI-Powered Bookkeeping
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Say goodbye to manual crypto bookkeeping. Sanwó automates your
                financial record-keeping, saving you time and reducing errors.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Automatic transaction categorization
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Real-time financial statements
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Tax-ready reporting at year-end
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>
          <motion.div
            className="lg:w-1/2"
            initial={{ x: 50, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className=" overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl">
              <motion.img
                src="/gogo.png"
                alt="Automated Bookkeeping Dashboard Preview"
                className="w-full h-auto"
                transition={{ type: "spring", stiffness: 400 }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Third Layout - Crypto Payroll & Benefits */}
        <motion.div
          className="flex flex-col lg:flex-row items-center gap-16 mb-32"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="lg:w-1/2 order-2 lg:order-1"
            initial={{ x: -50, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl">
              <motion.img
                src="/scheduled-trivix.png"
                alt="Crypto Payroll Dashboard Preview"
                className="w-full h-auto"
                transition={{ type: "spring", stiffness: 400 }}
              />
            </div>
          </motion.div>
          <motion.div
            className="lg:w-1/2 order-1 lg:order-2"
            initial={{ x: 50, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="space-y-6">
              <h2 className="text-3xl font-semibold text-gray-800">
                Web3 Payroll & Crypto Benefits
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Pay your global web3 team in USDC effortlessly. Manage payroll,
                offer crypto-compatible benefits, and stay compliant, all within
                a crypto-native system.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Automated USDC payments to global contractors
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Compliant crypto benefits packages
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Token vesting and distribution tools
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>
        </motion.div>

        {/* Fourth Layout - Unified Platform */}
        <motion.div
          className="flex flex-col lg:flex-row items-center gap-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="lg:w-1/2"
            initial={{ x: -50, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="space-y-6">
              <h2 className="text-3xl font-semibold text-gray-800">
                Unified Platform, Seamless Operations
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Sanwó brings all your essential back-office functions into one
                platform. Reduce complexity, improve efficiency, and focus on
                building your web3 vision.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Single dashboard for all back-office needs
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Integrated workflow across all modules
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <motion.div
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-black"
                    whileHover={{ scale: 1.2 }}
                  >
                    ✓
                  </motion.div>
                  <span className="text-gray-700">
                    Streamlined operations with fewer tools
                  </span>
                </li>
              </ul>
              <div className="pt-4">
                <Link href="/waitlist">
                  <motion.button
                    className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition duration-300 inline-flex items-center gap-2 font-medium"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Join the Waitlist
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9 18L15 12L9 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
          <motion.div
            className="lg:w-1/2"
            initial={{ x: 50, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl">
              <motion.img
                src="/trivix_dashboard.png"
                alt="Unified Dashboard Preview"
                className="w-full h-auto"
                transition={{ type: "spring", stiffness: 400 }}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-gray-900 to-gray-900 text-white py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          {/* Company Info */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center mb-6">
              <motion.div
                className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black font-bold text-xl mr-3"
                whileHover={{ rotate: 10, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                T
              </motion.div>
              <span className="text-xl font-semibold">Sanwó</span>
            </div>
            <p className="text-white mb-6">
              The complete back-office solution for web3 businesses.
            </p>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h3 className="text-lg font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              <motion.li
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Link
                  href="/features"
                  className="text-white hover:text-white transition-colors"
                >
                  Features
                </Link>
              </motion.li>
              <motion.li
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Link
                  href="/pricing"
                  className="text-white hover:text-white transition-colors"
                >
                  Pricing
                </Link>
              </motion.li>
              <motion.li
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Link
                  href="/integrations"
                  className="text-white hover:text-white transition-colors"
                >
                  Integrations
                </Link>
              </motion.li>
            </ul>
          </motion.div>

          {/* Company */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="text-lg font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
              <motion.li
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Link
                  href="/about"
                  className="text-white hover:text-white transition-colors"
                >
                  About Us
                </Link>
              </motion.li>
              <motion.li
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Link
                  href="/careers"
                  className="text-white hover:text-white transition-colors"
                >
                  Careers
                </Link>
              </motion.li>
              <motion.li
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Link
                  href="/blog"
                  className="text-white hover:text-white transition-colors"
                >
                  Blog
                </Link>
              </motion.li>
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-3">
              <motion.li
                className="flex items-center"
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Mail className="w-5 h-5 mr-2 text-white" />
                <a
                  href="mailto:sales@sanwó.xyz"
                  className="text-white hover:text-white transition-colors"
                >
                  sales@sanwó.xyz
                </a>
              </motion.li>
              <motion.li
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Link
                  href="/auth/login"
                  className="text-white hover:text-white transition-colors"
                >
                  Login to Dashboard
                </Link>
              </motion.li>
              <motion.li
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Link
                  href="/book-demo"
                  className="text-white hover:text-white transition-colors"
                >
                  Book a Demo
                </Link>
              </motion.li>
            </ul>
          </motion.div>
        </div>

        {/* Bottom Section */}
        <motion.div
          className="pt-8 border-t border-white flex flex-col md:flex-row justify-between items-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <p className="text-sm text-white">
            © {new Date().getFullYear()} Sanwó. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link
              href="/privacy"
              className="text-sm text-white hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-white hover:text-white transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

const LandingPage = () => {
  const [displayText, setDisplayText] = useState("");
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const texts = [
    "The Web3 Back Office,",
    "Automate Crypto Payroll,",
    "Automate Financial Management with AI",
    "Grow Your Crypto Team with Ease,",
    "Pay Your Team in USDC,",
    "Manage Crypto Finances Smart,",
    "Automated Crypto Payroll Flow,",
    "Automate Crypto Taxes with AI",
  ];
  const typingSpeed = 100;
  const deletingSpeed = 50;
  const delayBetweenTexts = 1500;
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const calculateRotation = () => {
    const maxScroll = 5000; // Adjust this value based on when you want the flip to complete
    const scrollProgress = Math.min(scrollPosition, maxScroll) / maxScroll;
    const rotation = scrollProgress * 180;
    const scale = Math.max(0.01, 1 - scrollProgress); // Ensure scale doesn't go to 0
    return {
      transform: `perspective(1000px) rotateX(${rotation}deg) scaleY(${scale})`,
      transition: "transform 0.1s ease-out",
      transformOrigin: "center",
    };
  };

  useEffect(() => {
    const typeOrDelete = () => {
      const currentText = texts[textIndex];
      if (isDeleting) {
        setDisplayText(currentText.substring(0, displayText.length - 1));
      } else {
        setDisplayText(currentText.substring(0, displayText.length + 1));
      }

      if (!isDeleting && displayText === currentText) {
        setTimeout(() => setIsDeleting(true), delayBetweenTexts);
      } else if (isDeleting && displayText === "") {
        setIsDeleting(false);
        setTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
      }
    };

    const timer = setTimeout(
      typeOrDelete,
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, textIndex, texts]);

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <motion.main
        className="pt-32 pb-16 px-4 sm:px-6 lg:px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delayChildren: 0.4, staggerChildren: 0.2 }}
      >
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.h1
              className="text-4xl md:text-6xl font-medium text-gray-700 mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {displayText} <br />
              <span className="text-gray-500">
                Built for Crypto-Native Businesses.
              </span>
            </motion.h1>
            <motion.p
              className="max-w-3xl mx-auto text-lg md:text-xl text-gray-600 mb-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Launch and scale your web3 company faster with Sanwó. Manage USDC
              banking, crypto payroll, automated bookkeeping, and taxes – all in
              one platform designed for the decentralized economy.
            </motion.p>
            <Link href="/book-demo">
              <motion.button
                className="bg-gray-900 text-white px-8 py-4 text-lg rounded-full hover:bg-gray-800 transition duration-300 inline-block"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Contact Sales
              </motion.button>
            </Link>
          </motion.div>

          {/* Dashboard Preview Image */}
          <div
            className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden"
            style={calculateRotation()}
          >
            <img
              src="/trivix_dashboard.png"
              alt="Sanwó Dashboard Preview - Web3 Back Office"
              className="w-full h-auto"
            />
          </div>
        </div>
      </motion.main>
      <FeatureSection />
      <TrackCostsSection />
      <Footer />
    </div>
  );
};

export default LandingPage;
