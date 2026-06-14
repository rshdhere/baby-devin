import Link from "next/link";
import {
  ArrowRightLeft,
  Bug,
  CalendarClock,
  FileText,
  GitPullRequest,
  MoreHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface UseCase {
  icon: LucideIcon;
  title: string;
  bullets: string[];
  link?: { label: string; href: string };
}

const useCases: UseCase[] = [
  {
    icon: GitPullRequest,
    title: "PR review & visual QA",
    bullets: [
      "Automatically identify and resolve bugs",
      "Visual QA with full browser and desktop use",
      "Intelligently organize code diffs for review",
    ],
    link: { label: "Learn about Devin Review", href: "#" },
  },
  {
    icon: FileText,
    title: "Documentation",
    bullets: [
      "Auto-generate documentation and system diagrams for legacy codebases",
      "Comprehensive visibility into systems your team hasn't built",
    ],
    link: { label: "Learn more about DeepWiki", href: "#" },
  },
  {
    icon: ArrowRightLeft,
    title: "Code migration + refactors",
    bullets: [
      "Assign a fleet of agents to migrate all repos in parallel",
      "Accelerate modernizations — COBOL, .NET, Talend, legacy ETL, and more",
      "Complete audibility at each step",
    ],
  },
  {
    icon: CalendarClock,
    title: "Scheduled chores and application development",
    bullets: [
      "Schedule daily QA and release notes",
      "Continuously review and address user feedback",
      "Maintain documentation",
    ],
  },
  {
    icon: Bug,
    title: "Issue triage + bug fixing",
    bullets: [
      "Investigate Datadog incidents immediately",
      "Intelligently route Slack bug reports",
      "Automatically fix CI failures",
    ],
  },
  {
    icon: MoreHorizontal,
    title: "And many others",
    bullets: [
      "Automated ticket resolution",
      "Unit and E2E testing",
      "Performance optimization",
      "Web research and scraping",
      "Repetitive browser task automation",
    ],
  },
];

export function UseCasesSection() {
  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Use cases
          </h2>
          <p className="mt-5 text-[18px] leading-relaxed text-gray-600">
            Use Devin to plan and execute complex engineering tasks, from code
            migrations to on-call incident resolution.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-sm"
            >
              <div className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <useCase.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-[18px] font-semibold text-gray-900">
                {useCase.title}
              </h3>
              <ul className="mt-4 flex-1 space-y-2.5">
                {useCase.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-2.5 text-[16px] leading-relaxed text-gray-600"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-300" />
                    {bullet}
                  </li>
                ))}
              </ul>
              {useCase.link && (
                <Link
                  href={useCase.link.href}
                  className="mt-5 text-[16px] font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  {useCase.link.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
