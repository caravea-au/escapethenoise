"use client";

import { DAYS } from "./options";

export type DayHours = { open: boolean; openTime: string; closeTime: string };
export type Hours = Record<string, DayHours>;

// Mon–Sat open 09:00–17:00, Sunday closed (mirrors the design default).
export function defaultHours(): Hours {
  return DAYS.reduce<Hours>((acc, day, i) => {
    acc[day] = { open: i < 6, openTime: "09:00", closeTime: "17:00" };
    return acc;
  }, {});
}

const timeCls =
  "rounded-input border-[1.5px] border-line bg-cream px-3 py-2 text-[14px] text-ink";

export function TradingHours({
  hours,
  onChange,
}: {
  hours: Hours;
  onChange: (next: Hours) => void;
}) {
  function set(day: string, patch: Partial<DayHours>) {
    onChange({ ...hours, [day]: { ...hours[day], ...patch } });
  }

  function copyMondayToWeekdays() {
    const mon = hours[DAYS[0]];
    const next = { ...hours };
    for (let i = 1; i < 5; i++) {
      next[DAYS[i]] = { open: true, openTime: mon.openTime, closeTime: mon.closeTime };
    }
    onChange(next);
  }

  return (
    <div>
      <button
        type="button"
        onClick={copyMondayToWeekdays}
        className="mb-3 cursor-pointer text-[12.5px] font-semibold text-green-dark underline underline-offset-[3px]"
      >
        Copy Monday&apos;s hours to Tue–Fri
      </button>
      <div>
        {DAYS.map((day) => {
          const h = hours[day];
          return (
            <div
              key={day}
              className="grid grid-cols-[78px_auto] items-center gap-x-2.5 gap-y-1.5 border-b border-line py-[9px] last:border-b-0 sm:grid-cols-[92px_78px_1fr_14px_1fr] sm:gap-y-0"
            >
              <span className="text-[14px] font-semibold text-green">{day}</span>
              <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <input
                  type="checkbox"
                  checked={h.open}
                  onChange={(e) => set(day, { open: e.target.checked })}
                  className="h-[15px] w-[15px] cursor-pointer accent-green"
                />
                Open
              </label>
              {h.open ? (
                <>
                  <input
                    type="time"
                    aria-label={`${day} opening time`}
                    value={h.openTime}
                    onChange={(e) => set(day, { openTime: e.target.value })}
                    className={`${timeCls} col-span-2 sm:col-span-1`}
                  />
                  <span className="hidden text-center text-muted sm:block">–</span>
                  <input
                    type="time"
                    aria-label={`${day} closing time`}
                    value={h.closeTime}
                    onChange={(e) => set(day, { closeTime: e.target.value })}
                    className={`${timeCls} col-span-2 sm:col-span-1`}
                  />
                </>
              ) : (
                <span className="col-span-2 text-[13px] text-muted sm:col-span-3">
                  Closed
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
