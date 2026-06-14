"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Product", href: "#" },
  { label: "Solutions", href: "#" },
  { label: "Customers", href: "#" },
  { label: "Resources", href: "#" },
  { label: "Pricing", href: "#" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 sm:px-6 lg:px-8">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full px-4 transition-all duration-300 sm:px-6",
          scrolled
            ? "bg-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150"
            : "bg-transparent",
        )}
      >
        <Link href="/" className="flex items-center text-gray-900">
          <Logo size={26} />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[15px] font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="#"
            className="hidden text-[15px] font-medium text-gray-600 transition-colors hover:text-gray-900 sm:inline"
          >
            Contact sales
          </Link>
          <Link
            href="#"
            className={cn(
              "hidden rounded-full border border-gray-200 bg-white px-4 py-2",
              "text-[15px] font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:inline",
            )}
          >
            Download
          </Link>
          <Link
            href="/signup"
            className={cn(
              "rounded-full bg-blue-500 px-4 py-2 text-[15px] font-medium text-white",
              "transition-colors hover:bg-blue-600",
            )}
          >
            Try Devin
          </Link>
        </div>
      </div>
    </header>
  );
}
