![alt text](https://firebasestorage.googleapis.com/v0/b/trivixpay.firebasestorage.app/o/Screenshot%202025-03-28%20220606.png?alt=media&token=fcd57a4d-15b9-4cb1-9474-700290589a9c)

# Sanwó: Streamlining Workforce Payroll & Payments For Web3 Business

## Overview

Sanwó is a fintech platform designed to simplify and enhance how businesses manage their workforce payroll and contractor payments,Vendor payment, leveraging the power of Web3 technology for secure, transparent, and efficient transactions.

<pre>
const EmployerPoolContractAddress ="0x93877a92e644B8Efb29B12b258c5C4B637BEDE75";
const SanwoUtilityToken = "0xE78751788EE2Bd9bE6691c8e9BB618968795a956";
</pre>


## Key Features

*   **Payroll Management:**
    *   Manage employee information (name, email, role, salary).
    *   Schedule recurring payroll payments.
    *   Track payment history.
    *   Generate payroll reports.
*   **Contractor Payments:**
    *   Onboard and manage contractors.
    *   Send secure payment invitations.
    *   Track contractor payment status.
*   **Web3 Wallet Integration:**
    *   Secure connection to Web3 wallets for seamless transactions.
    *   Payment is in USDC
*   **Transaction Tracking:**
    *   Comprehensive record of all payroll and contractor payment transactions.
    *   Filtering and search capabilities.
*   **Financial Reporting:**
    *   Overview of key financial metrics (total payroll disbursed, transaction volume).
    *   Payment trends analysis.
*   **User Authentication & Security:**
    *   Firebase authentication for secure user accounts.
    *   MetaMask SDK integration for Web3 wallet management and secure transactions.


## Technologies Used

*   **Frontend:** Next.js, Tailwind CSS, Lucide React (icons), React Toastify (notifications).
*   **Backend & Authentication:** Firebase Authentication, Firestore Database, MetaMask SDK.
*   **Web3 Integration:** MetaMask SDK, Ether.js, Solidity smart contract.



## Key Components

*   **`PayrollPage.js`:**  Manages the main payroll interface, including employee lists, payment schedules, and transaction history.
*   **`WorkersPage.js`:**  Displays and manages the worker list.
*   **`ContractorPage.js`:**  Manages contractor information and payments.
*   **`SideMenu.js`:**  Provides navigation throughout the application.
*   **`SignupPage.js`:** Handles user registration and initial business setup, integrating Firebase and Arcana.
*   **`FirebaseConfig.js`:** Firebase credentials and helper functions.


![alt text](https://firebasestorage.googleapis.com/v0/b/trivixpay.firebasestorage.app/o/sanwo_landing.png?alt=media&token=cc4c2811-83d0-401c-bb7c-53dd534fe8bc)

![alt text](https://firebasestorage.googleapis.com/v0/b/trivixpay.firebasestorage.app/o/signup.png?alt=media&token=1bdafeed-4eec-4156-9d9c-b40be64dc2c0)

![alt text](https://firebasestorage.googleapis.com/v0/b/trivixpay.firebasestorage.app/o/trivix_dashboard.png?alt=media&token=93ca2bc6-126e-4175-85de-d594eb8604e4)

## Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Implement your changes and write tests.
4.  Submit a pull request.
