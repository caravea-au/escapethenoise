import type { RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/DealerOnboardingForm/Controls";
import type { ChipKey, DealerFilterOptions } from "@/lib/dealers";
import { PinIcon } from "./icons";

// The 6 chips the design allows — no "Special Offers" (the export invented
// it; there's no such data on a dealer).
const CHIPS: ChipKey[] = ["Sales", "Service", "Rentals", "Off-Road", "Open Now"];

type Props = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  options: DealerFilterOptions;
  stateValue: string;
  onStateChange: (value: string) => void;
  brandValue: string;
  onBrandChange: (value: string) => void;
  typeValue: string;
  onTypeChange: (value: string) => void;
  serviceValue: string;
  onServiceChange: (value: string) => void;
  onNearMe: () => void;
  activeChip: ChipKey | null;
  onChipSelect: (chip: ChipKey | null) => void;
  allCount: number;
};

export function FilterBar({
  searchInputRef,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  options,
  stateValue,
  onStateChange,
  brandValue,
  onBrandChange,
  typeValue,
  onTypeChange,
  serviceValue,
  onServiceChange,
  onNearMe,
  activeChip,
  onChipSelect,
  allCount,
}: Props) {
  return (
    <div className="px-6 py-[18px]">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
        <div className="flex items-center gap-[9px] rounded-input border border-line bg-cream px-3.5 lg:min-w-[230px] lg:flex-1">
          <PinIcon className="shrink-0 text-rust" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearchSubmit();
              }
            }}
            placeholder="Suburb, city or postcode…"
            className="w-full border-0 bg-transparent py-[13px] text-[15px] text-ink outline-none placeholder:text-muted"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:contents">
          <Select tone="white" aria-label="Filter by state" value={stateValue} onChange={(e) => onStateChange(e.target.value)}>
            <option value="">All States</option>
            {options.states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select tone="white" aria-label="Filter by brand" value={brandValue} onChange={(e) => onBrandChange(e.target.value)}>
            <option value="">All Brands</option>
            {options.brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select tone="white" aria-label="Filter by van type" value={typeValue} onChange={(e) => onTypeChange(e.target.value)}>
            <option value="">Van Type</option>
            {options.productTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select tone="white" aria-label="Filter by service" value={serviceValue} onChange={(e) => onServiceChange(e.target.value)}>
            <option value="">Services</option>
            {options.services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-2 lg:contents">
          <Button variant="primary" onClick={onSearchSubmit} className="flex-1 lg:flex-none">
            Search
          </Button>
          <Button variant="outline" onClick={onNearMe} className="flex-1 whitespace-nowrap lg:flex-none">
            📍 Near Me
          </Button>
        </div>
      </div>

      <div className="mt-3.5 flex gap-[9px] overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        <button
          type="button"
          aria-pressed={activeChip === null}
          onClick={() => onChipSelect(null)}
          className={`shrink-0 rounded-chip px-3.5 py-[7px] text-[13px] font-semibold transition-colors ${
            activeChip === null ? "bg-green text-white" : "border border-line bg-white text-tag"
          }`}
        >
          All ({allCount})
        </button>
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            aria-pressed={activeChip === chip}
            onClick={() => onChipSelect(chip)}
            className={`shrink-0 rounded-chip px-3.5 py-[7px] text-[13px] font-semibold transition-colors ${
              activeChip === chip ? "bg-green text-white" : "border border-line bg-white text-tag"
            }`}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
