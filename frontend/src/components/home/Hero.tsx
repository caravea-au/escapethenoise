import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { strapiMedia, type HomeHero } from "@/lib/strapi";

// Fallbacks — the current hardcoded hero content, used when Strapi has no value.
const FALLBACK_POSTER = "/photos/hero.webp";
const FALLBACK_VIDEO = "/photos/hero.mp4";
const FALLBACK_EYEBROW = "No better time to";
const FALLBACK_SUBTITLE =
  "Plain-English guides that help everyday Australians choose the right van and escape the noise.";
const FALLBACK_SEARCH_PLACEHOLDER = "Enter suburb or postcode…";
const FALLBACK_SEARCH_CTA_LABEL = "Find Dealers";
// The 📍 emoji lives in JSX as its own aria-hidden span now, so this fallback
// is text-only — a CMS editor no longer has to paste an emoji to keep the icon.
const FALLBACK_LOCATION_CHIP_LABEL = "Use my location";
const FALLBACK_STATE_CHIP_LABEL = "Browse by state";

// Shared <h1> styling — used by both the HTML (Strapi) and JSX (prop/fallback) branches.
const H1_CLASS =
  "m-0 mt-3.5 whitespace-pre-line font-oswald text-[40px] font-bold uppercase leading-[.97] tracking-[-1.7px] text-white md:text-[51px] lg:text-[68px] xl:text-[78px]";

// eyebrow + headline + sub. clamp() replaced with Tailwind breakpoint steps.
// Content comes from Strapi (`data`) with hardcoded fallbacks; the eyebrow/
// title/subtitle/children props let other pages — e.g. the dealer onboarding
// thank-you — reuse the same banner with their own copy (props beat `data`).
export function Hero({
  data,
  eyebrow: eyebrowProp,
  title: titleProp,
  subtitle: subtitleProp,
  fullHeight = false,
  showSearch = false,
  children,
}: {
  data?: HomeHero;
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  // Grow to fill a flex-column parent and vertically centre the content. Used by
  // the dealer onboarding thank-you page to fill 100svh minus the header/footer.
  fullHeight?: boolean;
  // Opt-in only: Hero is also used by the dealer onboarding thank-you page, an
  // exact-100svh layout — a `true` default would inject a ~200px search card
  // there and introduce a scrollbar on a page built not to scroll.
  showSearch?: boolean;
  children?: ReactNode;
} = {}) {
  const poster = strapiMedia(data?.backgroundPoster?.url) ?? FALLBACK_POSTER;
  const video = strapiMedia(data?.backgroundVideo?.url) ?? FALLBACK_VIDEO;
  const eyebrow = eyebrowProp ?? data?.eyebrow ?? FALLBACK_EYEBROW;
  const subtitle = subtitleProp ?? data?.subtitle ?? FALLBACK_SUBTITLE;
  // The Strapi title is a plain string that may contain HTML (e.g. a
  // `<span class="text-rust">` to colour a word), so render it via
  // dangerouslySetInnerHTML. A `titleProp` ReactNode (other pages) and the
  // hardcoded fallback stay on the normal children path.
  const strapiTitle =
    titleProp == null && typeof data?.title === "string" ? data.title : null;
  const searchPlaceholder = data?.searchPlaceholder ?? FALLBACK_SEARCH_PLACEHOLDER;
  const searchCtaLabel = data?.searchCtaLabel ?? FALLBACK_SEARCH_CTA_LABEL;
  const locationChipLabel = data?.locationChipLabel ?? FALLBACK_LOCATION_CHIP_LABEL;
  const stateChipLabel = data?.stateChipLabel ?? FALLBACK_STATE_CHIP_LABEL;

  return (
    <section
      className={`relative overflow-hidden bg-[linear-gradient(165deg,#2f5238_0%,#27412E_46%,#16271C_100%)]${
        fullHeight ? " flex flex-1 items-center" : ""
      }`}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        poster={poster}
        className="absolute inset-0 z-0 h-full w-full object-cover"
      >
        <source src={video} type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(168deg,rgba(22,39,28,.78)_0%,rgba(39,65,46,.42)_46%,rgba(22,39,28,.82)_100%)]" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(95%_75%_at_50%_40%,transparent_0%,rgba(22,39,28,.5)_100%)]" />

      <div
        className={`relative z-[2] mx-auto w-full max-w-[920px] px-6 text-center ${
          fullHeight
            ? "py-12 lg:py-16"
            : "pt-[92px] pb-[112px] lg:pt-[120px] lg:pb-[140px] xl:pt-[150px] xl:pb-[172px]"
        }`}
      >
        <Eyebrow tone="gold" className="tracking-[3px]">
          {eyebrow}
        </Eyebrow>
        {strapiTitle != null ? (
          <h1 className={H1_CLASS} dangerouslySetInnerHTML={{ __html: strapiTitle }} />
        ) : (
          <h1 className={H1_CLASS}>
            {titleProp ?? (
              <>
                Buy your caravan with
                <br />
                <span className="text-rust">confidence</span>
              </>
            )}
          </h1>
        )}
        <p className="mx-auto mt-6 max-w-[600px] text-[16px] font-normal leading-[1.5] text-[#c4b89b] lg:text-[18px] xl:text-[20px]">
          {subtitle}
        </p>
        {children}

        {showSearch && (
          <>
            <form
              method="get"
              action="/find-dealer"
              role="search"
              className="mx-auto mt-[46px] flex max-w-[680px] flex-wrap gap-3 rounded-[22px] bg-white p-3.5 shadow-[0_1px_0_rgba(255,255,255,.5)_inset,0_32px_70px_-20px_rgba(16,28,20,.7)]"
            >
              <div className="flex min-w-[220px] flex-1 items-center gap-3 rounded-[14px] border border-line bg-cream px-[18px]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 text-rust" aria-hidden="true">
                  <path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" fill="currentColor" />
                  <circle cx="12" cy="9" r="2.6" className="fill-white" />
                </svg>
                <label htmlFor="hero-dealer-search" className="sr-only">Suburb or postcode</label>
                <input
                  id="hero-dealer-search"
                  name="q"
                  placeholder={searchPlaceholder}
                  className="w-full border-0 bg-transparent py-[19px] text-[16.5px] text-ink outline-none"
                />
              </div>
              {/* type="submit" works because Button spreads ...rest AFTER its type="button" default — keep that order. */}
              <Button type="submit" className="min-h-[60px] rounded-[14px] px-[34px]">
                {searchCtaLabel}
              </Button>
            </form>

            <div className="mt-5 flex flex-wrap justify-center gap-3.5">
              <Button href="/find-dealer" variant="glass" className="rounded-chip px-5 py-3 text-sm">
                <span aria-hidden="true">📍</span> {locationChipLabel}
              </Button>
              <Button href="/find-dealer#states" variant="glass" className="rounded-chip px-5 py-3 text-sm">
                {stateChipLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
