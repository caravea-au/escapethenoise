import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/DealerOnboardingForm/Controls";
import { GENERIC_SUBMIT_ERROR, messageForCode, readStrapiError } from "@/lib/formErrors";
import type { DirectoryDealer } from "@/lib/strapi";

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Own action name — never mixed with the dealer onboarding form's score stats.
const RECAPTCHA_ACTION = "dealer_enquiry";
const RECAPTCHA_TIMEOUT_MS = 10_000;
const SUBMIT_TIMEOUT_MS = 20_000;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

type Props = {
  dealer: DirectoryDealer;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string | null;
  // True only when the /api/recaptcha-config fetch itself failed (not when
  // reCAPTCHA is deliberately turned off) — offer the dealer's phone number
  // as a fallback rather than fail the whole page (see find-dealer/page.tsx).
  recaptchaConfigError: boolean;
  // Closes the parent modal — used by the success panel's "Done" button.
  onDone: () => void;
};

export function DealerEnquiryForm({ dealer, recaptchaEnabled, recaptchaSiteKey, recaptchaConfigError, onDone }: Props) {
  const recaptchaActive = recaptchaEnabled && !!recaptchaSiteKey;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [interest, setInterest] = useState("");
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState(""); // honeypot
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const loadedAt = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);

  // Load the reCAPTCHA v3 script the first time this form mounts, i.e. the
  // first time a dealer's modal is opened — never on page load.
  useEffect(() => {
    if (!recaptchaActive) return;
    const src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  }, [recaptchaActive, recaptchaSiteKey]);

  async function mintToken(): Promise<string | undefined> {
    if (!recaptchaActive) return undefined;
    if (!window.grecaptcha) throw new Error("recaptcha not loaded");
    const execute = new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window
          .grecaptcha!.execute(recaptchaSiteKey!, { action: RECAPTCHA_ACTION })
          .then(resolve)
          .catch(reject);
      });
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("recaptcha timeout")), RECAPTCHA_TIMEOUT_MS),
    );
    return await Promise.race([execute, timeout]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "This field is required.";
    if (!email.trim()) errs.email = "This field is required.";
    else if (!EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email address.";
    if (!message.trim()) errs.message = "This field is required.";
    setErrors(errs);

    const firstKey = Object.keys(errs)[0];
    if (firstKey) {
      // Scrolling alone is silent for a screen-reader user — the button
      // appears to do nothing. Move focus to the first invalid field itself
      // (mirrors DealerOnboardingForm's validate-and-focus approach).
      const control = formRef.current?.querySelector<HTMLElement>(`#enquiry-${firstKey}`);
      control?.scrollIntoView({ behavior: "smooth", block: "center" });
      control?.focus({ preventScroll: true });
      return;
    }

    setSubmitting(true);
    try {
      const recaptchaToken = await mintToken();
      const res = await fetch(`${STRAPI_URL}/api/dealer-enquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            dealer: dealer.documentId,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            postcode: postcode.trim() || undefined,
            interest: interest.trim() || undefined,
            message: message.trim(),
            comment,
            elapsedMs: Date.now() - loadedAt.current,
            ...(recaptchaToken ? { recaptchaToken } : {}),
          },
        }),
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      });

      if (!res.ok) {
        const { status, code, message: errMessage } = await readStrapiError(res);
        console.error(`[dealer-enquiry] submit ${status} ${code} ${errMessage}`);
        setSubmitting(false);
        setSubmitError(messageForCode(code, null));
        return;
      }

      setSubmitting(false);
      setSent(true);
    } catch (err) {
      setSubmitting(false);
      const failedRecaptcha =
        err instanceof Error && (err.message === "recaptcha not loaded" || err.message === "recaptcha timeout");
      setSubmitError(failedRecaptcha ? messageForCode("recaptcha-browser-blocked", null) : GENERIC_SUBMIT_ERROR);
      console.error(err);
    }
  }

  if (sent) {
    return (
      <div role="status" className="pt-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-badge-open-bg text-3xl">✅</div>
        <h4 className="mt-[18px] font-oswald text-[22px] font-bold text-green">Thanks — your enquiry has been sent</h4>
        <p className="mt-2.5 text-[14.5px] leading-[1.55] text-muted">
          Your enquiry has been recorded for {dealer.dealershipName}.
        </p>
        <Button variant="tertiary" onClick={onDone} className="mt-6">
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-[22px] border-t border-line pt-5">
      <h4 className="font-oswald text-[17px] font-bold text-green">Enquire with this dealer</h4>
      {/* TODO(client): replace with copy confirming what happens after an enquiry is
          sent — enquiries are collected only right now, no email goes to the dealer
          or the buyer, so the export's "goes straight to the dealer — no spam" line
          would be false. */}
      {recaptchaConfigError && dealer.phone && (
        <p className="mt-[5px] text-[12.5px] text-muted">
          Our spam check is temporarily unavailable. If sending doesn&apos;t work, you can call {dealer.dealershipName}{" "}
          directly on <a href={`tel:${dealer.phone}`} className="font-semibold text-green underline">{dealer.phone}</a>.
        </p>
      )}
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-3.5 flex flex-col gap-[11px]">
        <div className="flex gap-[11px] flex-wrap">
          <div className="min-w-[130px] flex-1">
            <label htmlFor="enquiry-name" className="sr-only">
              Name
            </label>
            <Input
              tone="white"
              id="enquiry-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              required
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "enquiry-name-error" : undefined}
            />
            {errors.name && (
              <span id="enquiry-name-error" className="mt-1 block text-[12.5px] font-medium text-error">
                {errors.name}
              </span>
            )}
          </div>
          <div className="min-w-[130px] flex-1">
            <label htmlFor="enquiry-phone" className="sr-only">
              Phone
            </label>
            <Input
              tone="white"
              id="enquiry-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
            />
          </div>
        </div>
        <div className="flex gap-[11px] flex-wrap">
          <div className="min-w-[130px] flex-1">
            <label htmlFor="enquiry-email" className="sr-only">
              Email
            </label>
            <Input
              tone="white"
              id="enquiry-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "enquiry-email-error" : undefined}
            />
            {errors.email && (
              <span id="enquiry-email-error" className="mt-1 block text-[12.5px] font-medium text-error">
                {errors.email}
              </span>
            )}
          </div>
          <div className="min-w-[90px] flex-1">
            <label htmlFor="enquiry-postcode" className="sr-only">
              Postcode
            </label>
            <Input
              tone="white"
              id="enquiry-postcode"
              inputMode="numeric"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="Postcode"
            />
          </div>
        </div>
        <div>
          <label htmlFor="enquiry-interest" className="sr-only">
            Which van or brand? (optional)
          </label>
          <Input
            tone="white"
            id="enquiry-interest"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder="Which van or brand? (optional)"
          />
        </div>
        <div>
          <label htmlFor="enquiry-message" className="sr-only">
            Your enquiry
          </label>
          <Textarea
            tone="white"
            id="enquiry-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your enquiry…"
            required
            aria-required="true"
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? "enquiry-message-error" : undefined}
          />
          {errors.message && (
            <span id="enquiry-message-error" className="mt-1 block text-[12.5px] font-medium text-error">
              {errors.message}
            </span>
          )}
        </div>

        {/* Honeypot — off-screen, not display:none (bots skip hidden inputs but
            fill visually-hidden ones). */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="enquiry-comment">Comment</label>
          <input
            id="enquiry-comment"
            name="comment"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <Button variant="primary" fullWidth type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send Enquiry"}
        </Button>
        {submitError && (
          <p role="alert" className="text-center text-[13px] font-medium text-error">
            {submitError}
          </p>
        )}
        {recaptchaActive && (
          <p className="text-center text-[11px] text-muted">
            This site is protected by reCAPTCHA and the Google{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              Privacy Policy
            </a>{" "}
            and{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">
              Terms of Service
            </a>{" "}
            apply.
          </p>
        )}
      </form>
    </div>
  );
}
