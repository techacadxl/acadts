// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import LatexProvider from "@/components/LatexProvider";

export const metadata: Metadata = {
  title: "My App",
  description: "Next.js + Firebase app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <LatexProvider>
            {children}
          </LatexProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
