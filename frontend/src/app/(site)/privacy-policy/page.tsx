import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { ArticleBody } from "@/components/ArticleBody/ArticleBody";
import { getPrivacyPolicy } from "@/lib/strapi";
import { PRIVACY_FALLBACK, PRIVACY_TITLE, PRIVACY_LAST_UPDATED } from "./content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How we collect, use, hold, and disclose your personal information.",
};

// Format an ISO date (e.g. "2026-07-01") as "1 July 2026". Returns null on a bad value.
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default async function PrivacyPolicyPage() {
  // Strapi single type overrides the baseplate fallback (same pattern as Footer).
  const policy = await getPrivacyPolicy();
  const title = policy?.title ?? PRIVACY_TITLE;
  const blocks = policy?.content?.length ? policy.content : PRIVACY_FALLBACK;
  const lastUpdated = formatDate(policy?.lastUpdated ?? PRIVACY_LAST_UPDATED);

  return (
    <article>
      {/* Hero */}
      <section className="bg-green-dark">
        <Container width="article" className="pt-10 pb-[46px]">
          <Heading
            as="h1"
            className="text-[30px] tracking-[-1px] text-balance text-white md:text-[40px] lg:text-[50px]"
          >
            {title}
          </Heading>
          {lastUpdated && (
            <p className="mt-4 text-[13.5px] text-sand">Last updated {lastUpdated}</p>
          )}
        </Container>
      </section>

      {/* Body */}
      <Container width="article" className="pt-12 pb-16">
        <ArticleBody blocks={blocks} />
      </Container>
    </article>
  );
}
