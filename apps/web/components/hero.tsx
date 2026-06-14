import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-[90rem] px-4 pt-16 pb-20 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
        <div className="flex flex-col items-center text-center">
          <Link
            href="#"
            className="hero-capsule mb-10 inline-flex items-center gap-2.5 rounded-full border border-gray-800 bg-gray-950 px-4 py-2 text-[15px] font-medium text-white hover:bg-gray-900"
          >
            <span className="rounded-full bg-blue-500 px-3 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
              New
            </span>
            <span>Windsurf is now Devin Desktop</span>
            <ArrowUpRight className="size-4 text-gray-400" />
          </Link>

          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl lg:text-[72px] lg:leading-[1.08]">
            <span className="block">Devin, the AI</span>
            <span className="block">software engineer</span>
          </h1>
        </div>

        <div className="relative -mx-4 mt-14 sm:-mx-6 sm:mt-16 lg:-mx-10 lg:mt-20">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)]">
            <Image
              src="/hero_new.webp"
              alt="Devin dashboard showing sessions, activity feed, and test report"
              width={2400}
              height={1400}
              priority
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
