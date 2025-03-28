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
      className="fixed top-0 left-0 w-full h-full bg-gray-800 bg-opacity-50 flex justify-center items-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-lg shadow-lg p-4 w-80">
        <div className="flex flex-col items-start space-y-2">
          {address && (
            <div className="flex flex-col items-center w-full">
              <div className="font-medium text-gray-800">
                {address.slice(0, 8)}...{address.slice(-4)}
              </div>
              <div className="text-sm text-gray-500">Network: Stellar</div>
            </div>
          )}

          <button
            className="flex items-center space-x-2 text-gray-700 hover:text-red-600 w-full justify-start"
            onClick={onDisconnect}
          >
            <span className="text-xl">
              <img
                src="/icons/exit.svg"
                alt="Disconnect Icon"
                className="w-5 h-5"
              />
            </span>
            <span>Disconnect</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
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
      </div>
    </div>
  );
};

export default WalletModal;
