import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Devin — The AI Software Engineer",
  description:
    "Devin is an AI software engineer that helps you plan, code, review, and ship faster.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${inter.className} bg-background text-foreground antialiased`}
      >
        <main>{children}</main>
      </body>
    </html>
  );
}
