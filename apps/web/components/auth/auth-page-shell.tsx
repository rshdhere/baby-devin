import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthPageShell({
  title,
  subtitle,
  children,
  footer,
}: AuthPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#121212] px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center text-gray-500">
          <Logo size={40} />
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2 text-[15px] text-gray-500">{subtitle}</p>
        </div>

        {children}

        <div className="mt-8 text-center text-[14px] text-gray-500">
          {footer}
        </div>
      </div>
    </div>
  );
}

export function AuthFooterLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-[#4a90e2] hover:text-[#6aa8ef]"
    >
      {children}
    </Link>
  );
}
