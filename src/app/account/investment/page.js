"use client";

import React from "react";
import { CalendarClock, BrainCog, BarChart3, TrendingUp } from "lucide-react"; //Or other relevant icons

const InvestmentPageComingSoon = () => {
  return (
    <div className="min-h-screen bg-white py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            Investment Management - Coming Soon!
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Revolutionize how your business invests with our upcoming AI-powered
            investment management tools.
          </p>
        </div>

        <div className="mt-10">
          <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
            <div className="relative">
              <dt>
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <BrainCog className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  AI-Powered Investment Agent
                </p>
              </dt>
              <dd className="mt-2 ml-16 text-base text-gray-500">
                Our AI Agent will analyze market trends, assess risk, and
                recommend optimal investment strategies tailored to your
                business goals. Imagine hands-free investment management,
                optimized for maximum returns.
              </dd>
            </div>

            <div className="relative">
              <dt>
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                  <BarChart3 className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Data-Driven Insights & Reporting
                </p>
              </dt>
              <dd className="mt-2 ml-16 text-base text-gray-500">
                Gain access to clear, concise reports on your investment
                performance. Understand key metrics, track your progress, and
                make informed decisions based on real-time data.
              </dd>
            </div>

            <div className="relative">
              <dt>
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-purple-500 text-white">
                  <TrendingUp className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Automated Portfolio Optimization
                </p>
              </dt>
              <dd className="mt-2 ml-16 text-base text-gray-500">
                Let our system automatically rebalance your portfolio to
                maintain your desired risk level and maximize potential gains.
                Say goodbye to manual adjustments and hello to effortless
                growth.
              </dd>
            </div>

            <div className="relative">
              <dt>
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-red-500 text-white">
                  <CalendarClock className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Scheduled Investment Plans
                </p>
              </dt>
              <dd className="mt-2 ml-16 text-base text-gray-500">
                Set up recurring investment plans to automatically allocate
                funds to your portfolio on a regular basis. Build wealth
                gradually and consistently, without the need for constant
                monitoring.
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-12 text-center">
          <p className="text-lg text-gray-600">
            Stay tuned for updates and be among the first to access these
            powerful new features.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvestmentPageComingSoon;
