// Placeholder home page. The real pages are built per-section via
// /criteria <page>/<section> → /build-component. This scaffold only confirms
// the brand foundation renders; replace it with the first real page.
export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-[820px] flex-col items-start justify-center gap-4 px-6 py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[2px] text-rust">
        Brand foundation ready
      </p>
      <h1 className="font-(family-name:--font-display) text-[40px] font-bold uppercase leading-[0.95] tracking-[-1px] text-green md:text-[51px]">
        Find a Dealer
      </h1>
      <p className="max-w-prose text-[17px] leading-[1.6] text-muted">
        Tokens, fonts, global chrome and Tier-1 primitives are in place. Build
        pages section by section with{" "}
        <code className="rounded bg-cream-deep px-1.5 py-0.5 text-[15px] text-ink">
          /criteria
        </code>
        .
      </p>
    </section>
  );
}
