"use client";
import React from "react";
import { Providers } from "@/app/wagmiProvider";

export default function ClientLayout({ children }) {
  return <Providers>{children}</Providers>;
}
