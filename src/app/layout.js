import localFont from "next/font/local";
import ClientLayout from "./components/ClientLayout";
import "./globals.css";

// Font configurations
const myFont = localFont({ src: "./fonts/Aeonik.otf" });

export const metadata = {
  title: "sanwo",
  description:
    "Sanwo - Financial management platform for web3 business with StableCoin(USDC) and AI agent",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="Sanwó" content="Sanwó" />
      </head>
      <body className={myFont.className}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
