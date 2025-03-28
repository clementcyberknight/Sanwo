import React, { useState } from "react";
import { db, collection, addDoc } from "@/app/config/FirebaseConfig";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const WaitlistModal = ({ isOpen, onClose }) => {
  const [businessName, setBusinessName] = useState("");
  const [sector, setSector] = useState("Select Sector");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "waitlist"), {
        businessName,
        sector,
        companyEmail,
        companyWebsite,
        timestamp: new Date(),
      });
      toast.success("Successfully added to waitlist!");
      onClose(); // Close the modal after successful submission
    } catch (error) {
      console.error("Error adding document: ", error);
      toast.error("Failed to join waitlist. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <h2 className="text-2xl font-bold mb-4">Join The Waitlist</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Business Name
            </label>
            <input
              type="text"
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              placeholder="Name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Sector
            </label>
            <select
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              required
            >
              <option value="Select Sector">Select Sector</option>
              <option value="Mining">Mining</option>
              <option value="Trading">Trading</option>
              <option value="DeFi">DeFi</option>
              <option value="DePIN">DePIN</option>
              <option value="NFTs">NFTs</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Company Email
            </label>
            <input
              type="email"
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              placeholder="Enter Company's Email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Company Website
            </label>
            <input
              type="url"
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              placeholder="Enter Company website"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-300 disabled:bg-blue-400 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mx-auto"></div>
            ) : (
              "Join"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WaitlistModal;
