import { CollaborationSection } from "@/components/collaboration-section";
import { CtaSection } from "@/components/cta-section";
import { CustomersSection } from "@/components/customers-section";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { IntegrationsSection } from "@/components/integrations-section";
import { UseCasesSection } from "@/components/use-cases-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <div className="font-[family-name:var(--font-inter)] text-[17px] leading-relaxed sm:text-lg">
        <CustomersSection />
        <UseCasesSection />
        <CollaborationSection />
        <IntegrationsSection />
      </div>
      <CtaSection />
      <Footer />
    </div>
  );
}
