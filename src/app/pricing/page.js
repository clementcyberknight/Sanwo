"use client";
import React, { useState } from "react";
import {
  Check,
  Wallet,
  FileText,
  Users,
  Clock,
  Shield,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import Header from "@/app/components/header";

const PricingPage = () => {
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Starter",
      price: "Free",
      description:
        "Perfect for getting started with crypto treasury management",
      features: [
        "USDC Wallet Management",
        "Basic Analytics",
        "Transaction Reports",
      ],
      buttonText: "Get Started",
      highlight: false,
    },
    {
      name: "Business",
      price: "$500",
      description: "Ideal for established web3 businesses",
      features: [
        "Everything in Free, plus:",
        "Multi-signature Wallets",
        "Advanced Analytics",
        "Custom Reports",
        "Priority Email Support",
      ],
      buttonText: "Start Trial",
      highlight: true,
    },
    {
      name: "Enterprise",
      price: "$999",
      description: "For companies requiring advanced features and support",
      features: [
        "Everything in Business, plus:",
        "24/7 Priority Support",
        "Custom Role Management",
        "Dedicated Account Manager",
        "Custom Integration Support",
        "Advanced Security Features",
        "SLA Guarantees",
      ],
      buttonText: "Contact Sales",
      highlight: false,
    },
  ];

  const commonFeatures = [
    {
      icon: <Wallet className="w-5 h-5 text-black" />,
      title: "Wallet Management",
      description: "Secure USDC wallet management for your business",
    },
    {
      icon: <FileText className="w-5 h-5 text-black" />,
      title: "Reports & Analytics",
      description: "Comprehensive transaction tracking and analysis",
    },
    {
      icon: <Users className="w-5 h-5 text-black" />,
      title: "Role Management",
      description: "Advanced user roles and permissions",
    },
    {
      icon: <Clock className="w-5 h-5 text-black" />,
      title: "24/7 Support",
      description: "Round-the-clock customer support",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-medium text-gray-900 mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-600 mb-8">
            Choose the plan that best fits your business needs
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`bg-white rounded-lg shadow-lg overflow-hidden ${
                  plan.highlight ? "ring-2 ring-black" : ""
                }`}
              >
                <div className="p-8">
                  <h3 className="text-2xl font-medium text-gray-900 mb-4">
                    {plan.name}
                  </h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.price}
                    </span>
                    {plan.price !== "Free" && (
                      <span className="text-gray-600">/month</span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-6">{plan.description}</p>
                  <Link
                    href={
                      plan.name === "Enterprise" ? "/book-demo" : "/book-demo"
                    }
                    className={`w-full py-3 px-6 rounded-lg ${
                      plan.highlight
                        ? "bg-black text-white hover:bg-gray-900"
                        : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    } transition duration-300`}
                  >
                    {plan.buttonText}
                  </Link>
                </div>
                <div className="bg-gray-50 px-8 py-6">
                  <ul className="space-y-4">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <Check className="w-5 h-5 text-black mr-2 mt-1 flex-shrink-0" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Common Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-medium text-gray-900 mb-12 text-center">
            Included in All Plans
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {commonFeatures.map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      {/* <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-medium text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          {/* Add FAQ content here if needed */}
      {/* </div>
      </section> */}

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-medium text-white mb-6">
            Ready to get started with Sanwó?
          </h2>
          <p className="text-xl text-gray-100 mb-8">
            Join leading web3 companies already using Sanwó
          </p>
          <Link
            href="/book-demo"
            className="bg-white text-black px-8 py-4 rounded-full hover:bg-gray-50 transition duration-300"
          >
            Start Your Free Trial
          </Link>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
