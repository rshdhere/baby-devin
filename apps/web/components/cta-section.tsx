import Link from "next/link";
import { cn } from "@/lib/utils";

export function CtaSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gray-900 px-8 py-20 text-center sm:px-16 sm:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%)]" />
          <div className="relative">
            <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Ready to ship faster with Devin?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[18px] leading-relaxed text-gray-400">
              Join engineering teams using Devin to plan, code, review, and ship
              — from migrations to on-call incident resolution.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/login"
                className={cn(
                  "rounded-lg bg-blue-500 px-6 py-3 text-[16px] font-medium text-white",
                  "transition-colors hover:bg-blue-600",
                )}
              >
                Try Devin
              </Link>
              <Link
                href="#"
                className={cn(
                  "rounded-lg border border-gray-600 px-6 py-3 text-[16px] font-medium text-gray-300",
                  "transition-colors hover:border-gray-500 hover:text-white",
                )}
              >
                Contact sales
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
