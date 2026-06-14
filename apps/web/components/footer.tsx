import Link from "next/link";
import { Logo } from "@/components/logo";

const footerLinks = {
  Product: ["Features", "Pricing", "Devin Review", "DeepWiki", "API"],
  Solutions: ["Enterprise", "Startups", "Code migration", "On-call"],
  Resources: ["Blog", "Docs", "Changelog", "Status"],
  Company: ["About", "Careers", "Contact", "Privacy"],
};

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-[90rem] px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 text-gray-900">
              <Logo size={20} />
              <span className="text-[15px] font-semibold tracking-tight">
                Devin
              </span>
            </Link>
            <p className="mt-4 text-[13px] leading-relaxed text-gray-500">
              The AI software engineer that helps your team plan, code, review,
              and ship faster.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-[13px] font-semibold text-gray-900">
                {category}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-[13px] text-gray-500 transition-colors hover:text-gray-900"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 sm:flex-row">
          <p className="text-[13px] text-gray-400">
            © {new Date().getFullYear()} Devin. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="#"
              className="text-[13px] text-gray-400 transition-colors hover:text-gray-600"
            >
              Terms
            </Link>
            <Link
              href="#"
              className="text-[13px] text-gray-400 transition-colors hover:text-gray-600"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
