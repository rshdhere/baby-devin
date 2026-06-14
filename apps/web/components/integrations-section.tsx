const integrations = [
  "GitHub",
  "Linear",
  "Slack",
  "Datadog",
  "AWS",
  "Stripe",
  "Notion",
  "Confluence",
  "Sentry",
  "PostgreSQL",
  "MongoDB",
  "Snowflake",
  "Azure",
  "Databricks",
  "Airtable",
  "Asana",
  "Segment",
  "Google Drive",
];

const highlights = [
  {
    name: "GitHub",
    description:
      "Devin ships PRs the way your team does — picking up review feedback and CI results to get each PR approved and merged.",
  },
  {
    name: "Linear",
    description:
      "Assign Devin tickets directly in Linear, or add a Devin label.",
  },
  {
    name: "Slack and Teams",
    description:
      "Tag Devin in any conversation to surface relevant context, dig into issues, or turn discussions directly into PRs.",
  },
];

export function IntegrationsSection() {
  return (
    <section className="overflow-hidden border-t border-gray-100 bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Able to work with hundreds of tools
          </h2>
        </div>

        <div className="relative mt-14">
          <div className="animate-marquee flex gap-5 whitespace-nowrap">
            {[...integrations, ...integrations].map((tool, i) => (
              <span
                key={`${tool}-${i}`}
                className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-white px-5 py-2.5 text-[15px] font-medium text-gray-600"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-20 grid gap-7 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.name}
              className="rounded-xl border border-gray-200 bg-white p-8"
            >
              <h3 className="text-[18px] font-semibold text-gray-900">
                {item.name}
              </h3>
              <p className="mt-3 text-[16px] leading-relaxed text-gray-600">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
