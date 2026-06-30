import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Baseplate Starter",
};

export default function HomePage() {
  return (
    <div className="relative overflow-hidden bg-[linear-gradient(180deg,#fff_0%,#f6f8fb_45%,#eef3f8_100%)]">
      <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,#ffc869_0%,rgba(255,200,105,0.24)_24%,transparent_58%)]" />

      <section className="relative mx-auto flex min-h-[72vh] w-full max-w-6xl flex-col justify-center gap-10 px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-brand-primary">
            Clean Baseplate
          </p>
          <h1 className="font-(family-name:--font-display) text-5xl uppercase leading-[0.95] text-brand-ink md:text-7xl">
            Start `[project-name]` from a minimal shell.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-text-muted">
            Use this shell to define the real information architecture,
            components, content model, and design system of `[project-name]`.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <a
            href="/admin"
            className="inline-flex h-12 items-center justify-center rounded-[var(--radius-button)] bg-brand-primary px-8 font-semibold text-brand-ink transition-transform hover:-translate-y-0.5"
          >
            Open Strapi
          </a>
          <a
            href="/contact"
            className="inline-flex h-12 items-center justify-center rounded-[var(--radius-button)] border border-brand-ink/15 bg-white px-8 font-semibold text-brand-ink transition-colors hover:border-brand-primary hover:text-brand-primary"
          >
            Define Project Scope
          </a>
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-6xl gap-6 px-6 pb-20 md:grid-cols-3">
        <article className="rounded-[var(--radius-card)] border border-black/8 bg-white p-6 shadow-[0_18px_60px_rgba(17,24,39,0.06)]">
          <h2 className="font-(family-name:--font-display) text-2xl uppercase text-brand-ink">
            Frontend Base
          </h2>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            Build the route structure, page components, and visual language
            from this minimal starting point.
          </p>
        </article>

        <article className="rounded-[var(--radius-card)] border border-black/8 bg-white p-6 shadow-[0_18px_60px_rgba(17,24,39,0.06)]">
          <h2 className="font-(family-name:--font-display) text-2xl uppercase text-brand-ink">
            Backend Base
          </h2>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            Model the Strapi instance around the real domain and add only the
            content types the project actually needs.
          </p>
        </article>

        <article className="rounded-[var(--radius-card)] border border-black/8 bg-white p-6 shadow-[0_18px_60px_rgba(17,24,39,0.06)]">
          <h2 className="font-(family-name:--font-display) text-2xl uppercase text-brand-ink">
            Next Steps
          </h2>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            Replace placeholder metadata, add the first real content model, and
            introduce only the components that `[project-name]` actually needs.
          </p>
        </article>
      </section>
    </div>
  );
}
