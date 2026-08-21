import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { dealerCardImage, type DirectoryDealer } from "@/lib/strapi";
import { distanceLabelFor, isOpenNow, todayHoursLabel, type DealerOrigin } from "@/lib/dealers";
import { DealerEnquiryForm } from "./DealerEnquiryForm";
import { BrandsIcon, ClockIcon, CloseIcon, DirectionsIcon, PhoneIcon, PinIcon, ServicesIcon, WebsiteIcon } from "./icons";

type Props = {
  dealer: DirectoryDealer;
  now: number | null;
  origin: DealerOrigin | null;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string | null;
  recaptchaConfigError: boolean;
  onClose: () => void;
};

function directionsUrl(d: DirectoryDealer): string {
  const address = [d.street, d.suburb, d.state, d.postcode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

// A bare host like "caravea.au" needs a scheme before it's a usable href.
function normaliseWebsite(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function DealerModal({
  dealer,
  now,
  origin,
  recaptchaEnabled,
  recaptchaSiteKey,
  recaptchaConfigError,
  onClose,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Focus management: remember what had focus, move focus into the dialog,
  // restore it on close.
  useEffect(() => {
    previousActiveElement.current = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, []);

  // Esc to close + a Tab focus trap that cycles both directions.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Scroll lock, compensated for the scrollbar width so the page doesn't jump.
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  const openNow = now !== null ? isOpenNow(dealer.tradingHours, dealer.state, now) : null;
  const image = dealerCardImage(dealer);
  const location = [dealer.suburb, dealer.state].filter(Boolean).join(", ");
  const address = [dealer.street, dealer.suburb, dealer.state, dealer.postcode].filter(Boolean).join(", ");
  const hoursLabel = now !== null ? todayHoursLabel(dealer.tradingHours, dealer.state, now) : null;

  const distanceLabel = distanceLabelFor(origin, dealer);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-[rgba(16,28,20,.55)] px-4 py-10 backdrop-blur-[3px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100svh-80px)] w-full max-w-[560px] overflow-y-auto overscroll-contain rounded-card bg-white shadow-[0_40px_90px_rgba(16,28,20,.55)] animate-pop"
      >
        <div className="relative h-[170px] overflow-hidden rounded-t-card">
          {image ? (
            <Image src={image} alt={`${dealer.dealershipName} storefront`} fill className="object-cover" />
          ) : (
            <div className="h-full w-full bg-cream-deep" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(22,39,28,.45),transparent_55%)]" />
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close dealer details"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[rgba(16,28,20,.5)] text-white"
          >
            <CloseIcon />
          </button>
          {openNow !== null && (
            <span
              className={`absolute left-4 top-3.5 rounded-chip px-3 py-[5px] text-[11.5px] font-bold ${
                openNow ? "bg-badge-open-bg text-badge-open" : "bg-badge-closed-bg text-badge-closed"
              }`}
            >
              {openNow ? "Open now" : "Closed"}
            </span>
          )}
        </div>

        <div className="px-7 pb-[26px] pt-[22px]">
          <div className="flex flex-wrap items-center gap-[9px]">
            <h3 id={titleId} className="font-oswald text-2xl font-bold tracking-[-.4px] text-green">
              {dealer.dealershipName}
            </h3>
            {/* Mirrors DealerCard: the ✓ badge is only shown for a dealer
                Connect has approved, and every other dealer gets no pill at
                all rather than a neutral placeholder. Same dealer, same badge,
                same place beside the name, whether you read it in the list or
                the modal. */}
            {dealer.approved && (
              <span className="rounded-chip bg-badge-accredited-bg px-[9px] py-[3px] text-[10.5px] font-bold tracking-[.3px] text-rust-deep">
                ✓ Accredited
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-[5px] text-[13.5px] text-muted">
            <PinIcon className="text-rust" />
            <span>
              {location}
              {distanceLabel && (
                <>
                  {" · "}
                  <strong className="text-green">{distanceLabel}</strong>
                </>
              )}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button variant="secondary" href={directionsUrl(dealer)} target="_blank" rel="noopener noreferrer" className="min-w-[140px] flex-1">
              <DirectionsIcon />
              Get directions
            </Button>
            {dealer.website && (
              <Button
                variant="secondary"
                href={normaliseWebsite(dealer.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-[140px] flex-1"
              >
                <WebsiteIcon />
                Visit Website
              </Button>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2.5 rounded-[14px] border border-line bg-cream px-4 py-[15px]">
            {address && (
              <div className="flex items-start gap-[11px] text-[13.5px] text-ink">
                <PinIcon className="mt-px shrink-0 text-gold-deep" />
                {address}
              </div>
            )}
            {dealer.phone && (
              <div className="flex items-start gap-[11px] text-[13.5px] text-ink">
                <PhoneIcon className="mt-px shrink-0 text-gold-deep" />
                <a href={`tel:${dealer.phone}`} className="hover:underline">
                  {dealer.phone}
                </a>
              </div>
            )}
            {hoursLabel && (
              <div className="flex items-start gap-[11px] text-[13.5px] text-ink">
                <ClockIcon className="mt-px shrink-0 text-gold-deep" />
                {hoursLabel}
              </div>
            )}
          </div>

          {dealer.services.length > 0 && (
            <div className="mt-4">
              <div className="mb-2.5 flex items-center gap-[7px]">
                <ServicesIcon className="text-gold-deep" />
                <div className="text-[11px] font-bold uppercase tracking-[1px] text-gold-deep">Services Offered</div>
              </div>
              <div className="flex flex-wrap gap-[7px]">
                {dealer.services.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-[5px] rounded-[7px] bg-badge-accredited-bg px-[11px] py-[5px] text-xs font-semibold text-green"
                  >
                    <span className="h-[5px] w-[5px] rounded-full bg-gold-deep" />
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {dealer.brands.length > 0 && (
            <div className="mt-4">
              <div className="mb-2.5 flex items-center gap-[7px]">
                <BrandsIcon className="text-gold-deep" />
                <div className="text-[11px] font-bold uppercase tracking-[1px] text-gold-deep">Brands Stocked</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {dealer.brands.map((b) => (
                  <span
                    key={b}
                    className="rounded-lg border border-line-strong bg-white px-[13px] py-[7px] text-[12.5px] font-semibold text-green shadow-[0_1px_2px_rgba(39,65,46,.05)]"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Every dealer in the directory can be sent an enquiry, whether or
              not Connect has approved them. The ✓ Accredited pill above stays
              gated on `dealer.approved`: that pill is a claim about the dealer,
              this form is only a way to reach them, and the two are separate
              decisions. The dealer-enquiry controller no longer checks approval
              either, so a direct POST behaves the same as this form. */}
          <DealerEnquiryForm
            dealer={dealer}
            recaptchaEnabled={recaptchaEnabled}
            recaptchaSiteKey={recaptchaSiteKey}
            recaptchaConfigError={recaptchaConfigError}
            onDone={onClose}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
