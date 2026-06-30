// import { Button } from "@/components/ui/Button"; // hidden with search card + chips
import { strapiMedia, type HomeHero } from "@/lib/strapi";

// Fallbacks — the current hardcoded hero content, used when Strapi has no value.
const FALLBACK_POSTER = "/photos/hero.webp";
const FALLBACK_VIDEO = "/photos/hero.mp4";
const FALLBACK_SUBTITLE =
  "Australia's most trusted caravan resource — search 403+ accredited dealers near you.";

// Homepage hero — autoplaying muted video under a dark-green scrim (design.md §7),
// headline, and a search card. clamp() replaced with Tailwind breakpoint steps.
export function Hero({ data }: { data?: HomeHero }) {
  const poster = strapiMedia(data?.backgroundPoster?.url) ?? FALLBACK_POSTER;
  const video = strapiMedia(data?.backgroundVideo?.url) ?? FALLBACK_VIDEO;
  const subtitle = data?.subtitle ?? FALLBACK_SUBTITLE;
  const title = data?.title ?? null;

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(165deg,#2f5238_0%,#27412E_46%,#16271C_100%)]">
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

      <div className="relative z-[2] mx-auto max-w-[920px] px-6 pt-[92px] pb-[112px] text-center lg:pt-[120px] lg:pb-[140px] xl:pt-[150px] xl:pb-[172px]">
        <h1 className="m-0 whitespace-pre-line font-oswald text-[40px] font-bold uppercase leading-[.97] tracking-[-1.7px] text-white md:text-[51px] lg:text-[68px] xl:text-[78px]">
          {title ?? (
            <>
              Find your nearest
              <br />
              <span className="text-rust">accredited</span> caravan dealer
            </>
          )}
        </h1>
        <p className="mx-auto mt-6 max-w-[600px] text-[16px] font-normal leading-[1.5] text-[#c4b89b] lg:text-[18px] xl:text-[20px]">
          {subtitle}
        </p>

        {/* Hidden during design iteration — dealer-search elements (search card + chips):
        <div className="mx-auto mt-[46px] flex max-w-[680px] flex-wrap gap-3 rounded-[22px] bg-white p-3.5 shadow-[0_1px_0_rgba(255,255,255,.5)_inset,0_32px_70px_-20px_rgba(16,28,20,.7)]">
          <div className="flex min-w-[220px] flex-1 items-center gap-3 rounded-[14px] border border-line bg-cream px-[18px]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
              <path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" fill="#C17C2C" />
              <circle cx="12" cy="9" r="2.6" fill="#fff" />
            </svg>
            <input
              placeholder="Enter suburb or postcode…"
              aria-label="Enter suburb or postcode"
              className="w-full border-0 bg-transparent py-[19px] text-[16.5px] text-ink outline-none"
            />
          </div>
          <Button href="#" className="min-h-[60px] rounded-[14px] px-[34px]">
            Find Dealers
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-3.5">
          <Button href="#" variant="glass" className="rounded-chip px-5 py-3 text-sm">
            📍 Use my location
          </Button>
          <Button href="#" variant="glass" className="rounded-chip px-5 py-3 text-sm">
            Browse by state
          </Button>
        </div>
        */}
      </div>
    </section>
  );
}
