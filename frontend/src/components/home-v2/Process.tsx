import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const STEPS = [
  { n: "01", title: "Find", body: "Search 403+ accredited dealers by suburb, state or brand — wherever the road takes you." },
  { n: "02", title: "Visit", body: "Every listed dealer meets the CIAA accreditation standard, so you deal with the right people." },
  { n: "03", title: "Buy with confidence", body: "Backed by the industry and your state and territory caravanning association." },
];

// /02/ — three-step process as an editorial timeline with oversized step numerals.
export function Process() {
  return (
    <section className="bg-cream py-24 md:py-36">
      <Container>
        <div className="grid gap-8 border-b border-line pb-12 md:grid-cols-[1fr_1.1fr] md:items-end">
          <Reveal y={12}>
            <span className="text-[12px] font-semibold uppercase tracking-[3px] text-rust">
              / 02 / How it works
            </span>
            <h2 className="mt-8 font-oswald text-[36px] font-bold uppercase leading-[1.02] tracking-[-0.5px] text-green sm:text-[48px] lg:text-[62px]">
              Three steps to
              <br />
              the open road
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="max-w-[420px] text-[16px] leading-[1.7] text-muted md:justify-self-end">
              No jargon, no pressure. Accreditation does the vetting, so you can skip straight to
              finding the van — and the dealer — that fits.
            </p>
          </Reveal>
        </div>

        <div className="mt-2 grid md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="group h-full border-b border-line py-10 md:border-b-0 md:border-r md:px-10 md:py-12 md:last:border-r-0 md:[&:first-child]:pl-0">
                <div className="font-oswald text-[72px] font-bold leading-none text-line transition-colors duration-300 group-hover:text-rust">
                  {s.n}
                </div>
                <h3 className="mt-6 font-oswald text-[24px] font-bold uppercase tracking-[-0.3px] text-green">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-[34ch] text-[15px] leading-[1.65] text-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
