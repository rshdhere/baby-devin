const customers = [
  "Nubank",
  "Goldman Sachs",
  "Ramp",
  "Citadel",
  "Palantir",
  "Brex",
  "Anduril",
  "Rivian",
];

export function CustomersSection() {
  return (
    <section className="border-t border-gray-100 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-[15px] font-medium tracking-wide text-gray-500 uppercase">
            Industry leaders choose to
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            Build with Devin
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-2 items-center gap-x-8 gap-y-12 sm:grid-cols-4 lg:grid-cols-8">
          {customers.map((name) => (
            <div
              key={name}
              className="flex items-center justify-center text-center"
            >
              <span className="text-base font-semibold tracking-tight text-gray-400 transition-colors hover:text-gray-600">
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
