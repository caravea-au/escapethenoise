import { Select } from "@/components/DealerOnboardingForm/Controls";
import type { SortKey } from "@/lib/dealers";

type Props = {
  count: number;
  originLabel: string | null;
  sort: SortKey;
  sortDisabled: boolean;
  onSortChange: (sort: SortKey) => void;
  /**
   * The radius the results are constrained to, when they are. Null (the
   * default) keeps the original "near X" wording for any caller that isn't
   * constraining anything.
   */
  radiusKm?: number | null;
  /** Clears the location constraint. Null (the default) renders no such control. */
  onShowAll?: (() => void) | null;
};

// "Distance" / "Name" only — no "Rating" (the export invented it; there's no
// review data on a dealer).
export function ResultsHeader({
  count,
  originLabel,
  sort,
  sortDisabled,
  onSortChange,
  radiusKm = null,
  onShowAll = null,
}: Props) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
      <div className="text-[15px] text-ink" aria-live="polite" aria-atomic="true">
        <strong className="text-green">
          Showing {count} {count === 1 ? "dealer" : "dealers"}
        </strong>
        {/* Says the constraint out loud: a count that has changed because the
            results were narrowed to a radius must explain itself, or it reads
            as dealers having gone missing. */}
        {originLabel && (radiusKm ? <> within {radiusKm}km of {originLabel}</> : <> near {originLabel}</>)}
        {onShowAll && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => onShowAll()}
              className="font-semibold text-rust underline underline-offset-2"
            >
              Show all dealers
            </button>
          </>
        )}
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
