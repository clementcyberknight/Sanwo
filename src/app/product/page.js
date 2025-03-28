"use client";
import React, { useState } from "react";
import Link from "next/link";
import {
  Wallet,
  CreditCard,
  FileText,
  Users,
  ArrowRight,
  Building2,
  Landmark,
  BookOpen,
} from "lucide-react";
import Header from "@/app/components/header";

const ProductPage = () => {
  const features = [
    {
      icon: <Wallet className="w-12 h-12 text-black" />,
      title: "USDC Wallet Management",
      description:
        "Secure multi-signature wallets with complete visibility and control over your crypto treasury.",
    },
    {
      icon: <CreditCard className="w-12 h-12 text-black" />,
      title: "Corporate Cards",
      description:
        "Issue crypto-enabled cards to your team for easy expense management and tracking.",
    },
    {
      icon: <FileText className="w-12 h-12 text-black" />,
      title: "AI Bookkeeping",
      description:
        "Automated transaction categorization and reconciliation powered by artificial intelligence.",
    },
    {
      icon: <Users className="w-12 h-12 text-black" />,
      title: "Global USDC Payroll",
      description:
        "Pay your worldwide team in USDC with compliant, automated payroll processing.",
    },
  ];

  const benefits = [
    {
      icon: <Building2 className="w-8 h-8 text-black" />,
      title: "Built for Web3 Companies",
      description:
        "Native support for crypto operations, eliminating the need for constant fiat conversion.",
    },
    {
      icon: <Landmark className="w-8 h-8 text-black" />,
      title: "Regulatory Compliance",
      description:
        "Stay compliant with automated reporting and documentation for crypto transactions.",
    },
    {
      icon: <BookOpen className="w-8 h-8 text-black" />,
      title: "Simplified Operations",
      description:
        "Reduce administrative overhead with our integrated platform approach.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-medium text-gray-900 mb-6">
            The Complete Back Office for
            <br />
            <span className="text-black">Web3 Businesses</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-600 mb-8">
            Manage your entire business operations in USDC - from treasury and
            payroll to bookkeeping and compliance.
          </p>
          <Link
            href="/book-demo"
            className="bg-black text-white px-8 py-4 rounded-full hover:bg-gray-900 transition duration-300"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Main Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition duration-300"
              >
                <div className="mb-6">{feature.icon}</div>
                <h3 className="text-2xl font-medium text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-lg">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-medium text-gray-900 mb-12 text-center">
            Why Choose Sanwó
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white p-8 rounded-lg shadow-sm">
                <div className="mb-4">{benefit.icon}</div>
                <h3 className="text-xl font-medium text-gray-900 mb-4">
                  {benefit.title}
                </h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-medium text-white mb-6">
            Ready to modernize your business operations?
          </h2>
          <p className="text-xl text-gray-100 mb-8">
            Join forward-thinking companies already using Sanwó to streamline
            their operations.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/book-demo"
              className="bg-white text-black px-8 py-4 rounded-full hover:bg-gray-50 transition duration-300"
            >
              Book A Demo
            </Link>
            <Link
              href="/auth/login"
              className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full hover:bg-gray-700 transition duration-300"
            >
              Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProductPage;
