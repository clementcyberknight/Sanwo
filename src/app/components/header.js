"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

const Header = () => {
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleProductMouseEnter = () => {
    setIsProductDropdownOpen(true);
  };

  const handleProductMouseLeave = () => {
    setTimeout(() => {
      setIsProductDropdownOpen(false);
    }, 500);
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <img src="/logo.png" alt="Sanwó Logo" className="w-18 h-14" />
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/about" className="text-gray-600 hover:text-gray-900">
              Why Sanwó
            </Link>
            <div
              className="relative group"
              onMouseEnter={handleProductMouseEnter}
              onMouseLeave={handleProductMouseLeave}
            >
              <button className="text-gray-600 hover:text-gray-900">
                Product
              </button>
              <div
                className={`absolute mt-2 py-2 w-56 bg-white rounded-md shadow-xl z-10 ${
                  isProductDropdownOpen ? "block" : "hidden"
                }`}
              >
                <Link
                  href="/product"
                  className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                >
                  Payroll
                </Link>
                <Link
                  href="/product"
                  className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                >
                  Bookkeeping
                </Link>
                <Link
                  href="/product"
                  className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                >
                  Wallet
                </Link>
                <Link
                  href="/product"
                  className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                >
                  Card
                </Link>
              </div>
            </div>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900">
              Pricing
            </Link>
          </div>

          {/* Right side buttons */}
          <div className="flex items-center space-x-4">
            <Link
              href="/auth/login"
              className="text-gray-600 hover:text-gray-900"
            >
              Login
            </Link>
            <Link
              href="/book-demo"
              className="bg-gray-900 text-white px-6 py-2 rounded-full hover:bg-gray-800 transition duration-300"
            >
              Book A Demo
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
