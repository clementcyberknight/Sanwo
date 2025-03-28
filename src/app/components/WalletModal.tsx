import React from "react";

const WalletModal = ({
  isOpen,
  onClose,
  address,
  onDisconnect,
}: {
  isOpen: boolean;
  onClose: () => void;
  address: string | null;
  onDisconnect: () => void;
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 flex justify-center items-center z-50" // Changed backdrop to black with 70% opacity
      onClick={handleOverlayClick}
    >
      <div className="bg-gray-900 text-white rounded-lg shadow-lg p-6 w-80">
        {" "}
        {/* Changed modal background to dark gray and text to white, padding increased to p-6 */}
        <div className="flex flex-col items-start space-y-3">
          {" "}
          {/* Increased space-y-3 for better spacing */}
          {address && (
            <div className="flex flex-col items-center w-full">
              <div className="font-medium text-white">
                {" "}
                {/* Changed address text to white */}
                {address.slice(0, 8)}...{address.slice(-4)}
              </div>
              <div className="text-sm text-gray-300">Network: Ethereum</div>{" "}
              {/* Changed network text to light gray */}
            </div>
          )}
          <button
            className="flex items-center space-x-3 text-gray-300 hover:text-red-500 w-full justify-start" // Changed button text to light gray and hover to red
            onClick={onDisconnect}
          >
            <span className="text-xl">
              <img
                src="/icons/exit-white.svg" // Assuming you have a white exit icon
                alt="Disconnect Icon"
                className="w-5 h-5"
              />
            </span>
            <span>Disconnect</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-300 hover:text-gray-100" // Changed close button color to light gray and hover to white, padding increased to top-3 right-3
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default WalletModal;
