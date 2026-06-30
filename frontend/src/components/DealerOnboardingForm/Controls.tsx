import type { ComponentPropsWithoutRef, ReactNode } from "react";

// Presentational form controls for the dealership onboarding form. Stateless —
// styled to the project tokens (matching the design export). Bundled client-side
// via their importer (DealerOnboardingForm). Tailwind-first; the only non-token
// colour is the terracotta error (#b4452f — no error token exists in the theme).

// Shared field surface — mirrors the Tier-1 Input so selects/textareas match.
const fieldBase =
  "w-full rounded-input border border-line bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-muted aria-[invalid=true]:border-[#b4452f]";

// Numbered section card (used 7×).
export function FormSection({
  num,
  title,
  subtitle,
  children,
}: {
  num: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 rounded-card border border-line bg-cream p-6 shadow-[0_1px_2px_rgba(19,39,26,.06),0_10px_30px_rgba(19,39,26,.07)] md:p-[30px]">
      <div className="mb-6 flex items-center gap-[15px]">
        <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] bg-green text-sm font-bold text-cream">
          {num}
        </div>
        <div>
          <h2 className="font-oswald text-[20px] font-semibold tracking-tight text-green">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// Label + hint + control + inline error. `full` spans the 2-col grid.
export function Field({
  label,
  htmlFor,
  hint,
  required,
  optional,
  error,
  full,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  error?: string | null;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-[7px] ${full ? "sm:col-span-2" : ""}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-green">
        {label}{" "}
        {required && <span className="font-bold text-rust">*</span>}
        {optional && (
          <span className="text-[11.5px] font-medium text-muted">(optional)</span>
        )}
      </label>
      {hint && <span className="-mt-1 text-[12.5px] text-muted">{hint}</span>}
      {children}
      {error && (
        <span className="text-[12.5px] font-medium text-[#b4452f]">{error}</span>
      )}
    </div>
  );
}

export function Select({
  className = "",
  children,
  ...rest
}: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={`${fieldBase} cursor-pointer appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236d6e71' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...rest
}: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={`${fieldBase} min-h-[90px] resize-y ${className}`}
      {...rest}
    />
  );
}

// Checkbox + label (+ optional sub-line).
export function ToggleLine({
  id,
  name,
  checked,
  onChange,
  label,
  sub,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-[11px] py-[3px]">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] flex-none cursor-pointer accent-green"
      />
      <label htmlFor={id} className="cursor-pointer text-[14px] font-medium text-green">
        {label}
        {sub && <span className="mt-px block text-[12.5px] font-normal text-muted">{sub}</span>}
      </label>
    </div>
  );
}

// Segmented radio pills (New / Used / Both).
export function RadioPills({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[10px]">
      {options.map((opt) => {
        const id = `${name}_${opt.toLowerCase()}`;
        return (
          <div key={opt} className="relative min-w-[110px] flex-1">
            <input
              id={id}
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="peer absolute h-px w-px opacity-0"
            />
            <label
              htmlFor={id}
              className="block cursor-pointer rounded-input border-[1.5px] border-line bg-cream-deep p-3 text-center text-[14px] font-semibold text-green peer-checked:border-green peer-checked:bg-badge-open-bg peer-checked:text-green-dark"
            >
              {opt}
            </label>
          </div>
        );
      })}
    </div>
  );
}
