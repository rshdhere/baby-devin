import { BookOpen, GitBranch, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: BookOpen,
    label: "Learns your codebase",
    title: "Learns your codebase & picks up tribal knowledge",
    description:
      "Devin builds institutional memory from your repos, docs, and past sessions so it gets smarter with every task.",
  },
  {
    icon: Workflow,
    label: "Collaborate",
    title: "Works where your team works",
    description:
      "Ask Devin to triage Datadog incidents, route Slack messages, and tackle Linear tickets. Or automate entirely using the Devin API.",
  },
  {
    icon: GitBranch,
    label: "Multi-repo",
    title: "Multi-week, multi-repo projects",
    description:
      "Devin can spin up a team of agents for large tasks. It gets better over time by reading past session trajectories.",
  },
];

export function CollaborationSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Learn &amp; work together
          </h2>
          <p className="mt-5 text-[18px] leading-relaxed text-gray-600">
            Devin is built for engineering teams with complex, multi-repo
            projects.
          </p>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="group">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex h-56 flex-col justify-end p-6">
                  <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-7 items-center justify-center rounded bg-blue-500 text-white">
                        <feature.icon className="size-4" />
                      </div>
                      <span className="text-[14px] font-medium text-gray-700">
                        {feature.label}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-2.5 w-3/4 rounded bg-gray-100" />
                      <div className="h-2.5 w-1/2 rounded bg-gray-100" />
                    </div>
                  </div>
                </div>
              </div>
              <h3 className="mt-6 text-[18px] font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="mt-3 text-[16px] leading-relaxed text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
