"use client";

import { useEffect, useId, useRef, useState } from "react";

// Searchable multi-select with removable tag chips. Search box appears when the
// list is long (≥20 options). Closes on outside-click / Escape. Tokens only.
export function MultiSelect({
  placeholder,
  options,
  selected,
  onChange,
  invalid,
}: {
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const showSearch = options.length >= 20;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(opt: string) {
    onChange(
      selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt],
    );
  }

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2.5 rounded-input border-[1.5px] bg-cream px-[13px] py-[11px] text-left text-[15px] text-ink ${invalid ? "border-[#b4452f]" : "border-line"}`}
      >
        <span className={selected.length ? "text-ink" : "text-muted"}>
          {selected.length ? `${selected.length} selected` : placeholder}
        </span>
        <span
          className={`flex-none text-[11px] text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[260px] overflow-y-auto rounded-input border border-line bg-cream p-[5px] shadow-[0_14px_36px_rgba(27,56,83,.16)]"
        >
          {showSearch && (
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="sticky top-0 z-[1] mb-1 w-full border-0 border-b border-line bg-cream px-3 py-2.5 text-[14px] text-ink placeholder:text-muted focus:outline-none"
            />
          )}
          {filtered.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-[11px] rounded-[8px] px-3 py-[9px] text-[14.5px] text-green hover:bg-cream-deep"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-[17px] w-[17px] flex-none cursor-pointer accent-green"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-[7px]">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-chip bg-badge-open-bg py-[5px] pl-3 pr-1.5 text-[13px] font-medium text-green-dark"
            >
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => toggle(s)}
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-green/10 text-[13px] leading-none text-green-dark hover:bg-green/25"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
