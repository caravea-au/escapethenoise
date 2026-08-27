import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { dealerCardImage, type DirectoryDealer } from "@/lib/strapi";
import {
  distanceLabelFor,
  isOpenNow,
  CHIP_PREDICATES,
  type ChipKey,
  type DealerOrigin,
} from "@/lib/dealers";
import { PinIcon } from "./icons";

// Card-level tags reuse the same taxonomy as the filter chips (no invented
// "Special Offers" or rating data). "Open Now" isn't a tag — it's the pill.
const TAG_CHIPS: ChipKey[] = ["Sales", "Service", "Rentals", "Off-Road"];

type Props = {
  dealer: DirectoryDealer;
  now: number | null;
  origin: DealerOrigin | null;
  selected: boolean;
  // Site-wide switch, not a per-dealer field. See DealerDirectory’s Props.
  enquiryFormEnabled: boolean;
  onSelect: () => void;
  onOpenModal: () => void;
};

export function DealerCard({ dealer, now, origin, selected, enquiryFormEnabled, onSelect, onOpenModal }: Props) {
  const openNow = now !== null ? isOpenNow(dealer.tradingHours, dealer.state, now) : null;
  const image = dealerCardImage(dealer);
  const location = [dealer.suburb, dealer.state].filter(Boolean).join(", ");

  const distanceLabel = distanceLabelFor(origin, dealer);

  // Predicates only need `nowMs` for the "Open Now" key, which isn't in this
  // list, so the placeholder value is never read.
  const tags = TAG_CHIPS.filter((key) => CHIP_PREDICATES[key](dealer, 0));

  return (
    <div
      className={`rounded-card bg-white p-4 transition-transform duration-[350ms] hover:-translate-y-[3px] ${
        selected
          ? "border-2 border-rust shadow-[0_18px_40px_-14px_rgba(193,124,44,.24)]"
          : "border border-line shadow-[0_8px_20px_-12px_rgba(22,39,28,.08)]"
      }`}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} className="block w-full cursor-pointer text-left">
        <div className="flex gap-[13px]">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[10px] bg-cream-deep">
            {image ? (
              <Image
                src={image}
                alt={`${dealer.dealershipName} storefront`}
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-oswald text-xl font-bold text-green">
                {dealer.dealershipName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {/* Two-item layout (name + open/closed) keeps `justify-between`
                verbatim, so a dealer without the ✓ badge renders exactly as it
                did. Adding the badge makes it three items, and at 320px this
                row is only 145px wide while the two pills alone are 131px of
                it, so that case swaps to `flex-wrap` + `ml-auto` and lets the
                open/closed pill drop to a second line rather than crushing the
                name. Measured: 320px row height 22px unapproved (unchanged),
                50px approved. */}
            <div className={`flex items-start gap-2 ${dealer.approved ? "flex-wrap" : "justify-between"}`}>
              <h3 className="font-oswald text-base font-bold leading-[1.2] text-green">{dealer.dealershipName}</h3>
              {/* The ✓ badge is a CLAIM about this dealer, so it is rendered
                  ONLY for one Connect has approved. Every other dealer gets no
                  pill at all: a neutral placeholder pill on all 119 read as
                  though the whole directory carried the claim, which is what
                  the client objected to. Conditional rendering, never a class
                  toggle — a hidden-by-class pill still occupies this row, and
                  `Button`'s `inline-flex` beats a passed-in `hidden` anyway.
                  Mirrors DealerModal, which sits the same pill beside the same
                  name. */}
              {dealer.approved && (
                <span className="shrink-0 whitespace-nowrap rounded-chip bg-badge-accredited-bg px-[7px] py-[2px] text-[10.5px] font-bold text-rust-deep">
                  ✓ Accredited
                </span>
              )}
              {openNow !== null && (
                <span
                  className={`ml-auto shrink-0 whitespace-nowrap rounded-chip px-2 py-[3px] text-[10.5px] font-bold ${
                    openNow ? "bg-badge-open-bg text-badge-open" : "bg-badge-closed-bg text-badge-closed"
                  }`}
                >
                  {openNow ? "Open now" : "Closed"}
                </span>
              )}
            </div>
            <div className="mt-[5px] flex items-center gap-1 text-[12.5px] text-muted">
              <PinIcon className="text-rust" />
              <span className="min-w-0 truncate">
                {location}
                {distanceLabel && (
                  <>
                    {" — "}
                    <strong className="text-green">{distanceLabel}</strong>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </button>

      {tags.length > 0 && (
        <div className="mt-[11px] flex flex-wrap gap-[5px]">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md border border-line bg-cream px-2 py-[3px] text-[11px] font-medium text-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* "& Enquire" is only promised when the modal this button opens will
          actually carry a form. `enquiryFormEnabled` is ONE site-wide switch
          (Strapi’s Dealer Directory Settings), not a per-dealer field, so the
          wording has to check it too, or every selected card would promise an
          enquiry the modal does not offer. It is still only shown when
          selected, because that is the state whose modal the button opens
          straight into. */}
      <Button variant={selected ? "primary" : "secondary"} fullWidth onClick={onOpenModal} className="mt-3">
        {selected && enquiryFormEnabled ? "View Profile & Enquire →" : "View Profile →"}
      </Button>
    </div>
  );
}
