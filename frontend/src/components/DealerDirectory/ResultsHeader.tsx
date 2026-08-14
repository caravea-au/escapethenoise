import { Select } from "@/components/DealerOnboardingForm/Controls";
import type { SortKey } from "@/lib/dealers";

type Props = {
  count: number;
  originLabel: string | null;
  sort: SortKey;
  sortDisabled: boolean;
  onSortChange: (sort: SortKey) => void;
};

// "Distance" / "Name" only — no "Rating" (the export invented it; there's no
// review data on a dealer).
export function ResultsHeader({ count, originLabel, sort, sortDisabled, onSortChange }: Props) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
      <div className="text-[15px] text-ink" aria-live="polite" aria-atomic="true">
        <strong className="text-green">
          Showing {count} {count === 1 ? "dealer" : "dealers"}
        </strong>
        {originLabel && <> near {originLabel}</>}
      </div>
      <div className="flex items-center gap-[7px] text-[13.5px] text-muted">
        Sort:
        <Select
          tone="white"
          aria-label="Sort results"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
        >
          <option value="distance" disabled={sortDisabled}>
            Distance
          </option>
          <option value="name">Name</option>
        </Select>
      </div>
    </div>
  );
}
