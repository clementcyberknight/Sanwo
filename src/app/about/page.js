"use client";
import React from "react";
import Link from "next/link";
import { Users, Award, Target, Briefcase } from "lucide-react";
import Header from "@/app/components/header";

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-medium text-gray-900 mb-6">
            Building the Future of
            <br />
            <span className="text-blue-600">Business Operations</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-600 mb-8">
            We're on a mission to simplify business operations for founders and
            entrepreneurs, making it easier to focus on what truly matters -
            growing your business.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-medium text-gray-900 mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                At Sanwó, we believe that running a business shouldn't be
                complicated. We're building comprehensive tools that automate
                and simplify essential business operations, from payroll to
                accounting.
              </p>
              <p className="text-lg text-gray-600">
                Our platform brings together everything founders need in one
                place, eliminating the complexity of managing multiple systems
                and processes.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <Users className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Team First
                </h3>
                <p className="text-gray-600">
                  Building with collaboration at our core
                </p>
              </div>
              <div className="bg-blue-50 p-6 rounded-lg">
                <Award className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Excellence
                </h3>
                <p className="text-gray-600">
                  Committed to the highest standards
                </p>
              </div>
              <div className="bg-blue-50 p-6 rounded-lg">
                <Target className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Innovation
                </h3>
                <p className="text-gray-600">Pushing boundaries in fintech</p>
              </div>
              <div className="bg-blue-50 p-6 rounded-lg">
                <Briefcase className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Security
                </h3>
                <p className="text-gray-600">Your data, protected always</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-medium text-gray-900 mb-12 text-center">
            Why Choose Sanwó
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "All-In-One Solution",
                description:
                  "Everything you need to run your business, in one platform",
              },
              {
                title: "Time-Saving Automation",
                description:
                  "Automated workflows that save hours of manual work",
              },
              {
                title: "Built for Scale",
                description:
                  "Growth-ready infrastructure that scales with your business",
              },
            ].map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-lg shadow-sm">
                <h3 className="text-xl font-medium text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-medium text-white mb-6">
            Ready to transform your business operations?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of founders who are simplifying their business
            management with Sanwó.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/book-demo"
              className="bg-white text-blue-600 px-8 py-4 rounded-full hover:bg-blue-50 transition duration-300"
            >
              Book A Demo
            </Link>
            <Link
              href="/auth/login"
              className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full hover:bg-blue-700 transition duration-300"
            >
              Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
