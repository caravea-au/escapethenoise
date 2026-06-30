import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

// Open Day banner — single highlighted event CTA on the green band.
export function OpenDayCTA() {
  return (
    <section className="relative overflow-hidden bg-green">
      <div className="absolute inset-0 bg-[radial-gradient(80%_130%_at_85%_0%,rgba(193,124,44,.28),transparent_58%)]" />
      <Container className="relative flex flex-wrap items-center justify-between gap-7 py-12">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[15px] border border-gold/[.35] bg-gold/[.16]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E5C079" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
              <path d="M3.5 9.5h17M8 3v4M16 3v4" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[2px] text-gold">
              12 July 2026 · Nationwide
            </div>
            <h3 className="mt-1.5 font-oswald text-[22px] font-semibold uppercase leading-[1.05] tracking-[-.3px] text-white md:text-[23px] lg:text-[31px] xl:text-[32px]">
              National Caravan Open Day
            </h3>
          </div>
        </div>
        <Button href="#" className="px-8 py-[17px] text-[15.5px]">
          Register Now →
        </Button>
      </Container>
    </section>
  );
}
