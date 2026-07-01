"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  Field,
  FormSection,
  RadioPills,
  Select,
  Textarea,
  ToggleLine,
} from "./Controls";
import { MultiSelect } from "./MultiSelect";
import { PhotoUploader } from "./PhotoUploader";
import { TradingHours, defaultHours, type Hours } from "./TradingHours";
import {
  ACCEPT_ATTR,
  BRANDS,
  DMS_SYSTEMS,
  isAllowedImage,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  PRODUCT_TYPES,
  SERVICES,
  STATE_ASSOCIATIONS,
  STATES,
} from "./options";

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// reCAPTCHA v3 action name (shows in the reCAPTCHA admin console).
const RECAPTCHA_ACTION = "dealer_submit";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

type DealerOnboardingFormProps = {
  recaptchaEnabled?: boolean;
  recaptchaSiteKey?: string | null;
};

// Scalar string fields (camelCase = Strapi attribute names).
type Fields = Record<string, string>;
const INITIAL_FIELDS: Fields = {
  dealershipName: "", legalName: "", abn: "", established: "", dms: "", dmsOther: "",
  street: "", suburb: "", state: "", postcode: "",
  phone: "", leadsEmail: "", smsNumber: "", contactName: "", contactRole: "", enquiriesEmail: "",
  servicesOther: "", brandsOther: "", productsOther: "",
  website: "", description: "",
  facebook: "", instagram: "", youtube: "", googleProfile: "",
  submitterName: "", submitterEmail: "", submitterPhone: "", stateAssociation: "",
};

type Flags = Record<string, boolean>;
const INITIAL_FLAGS: Flags = {
  multipleLocations: false, financeAvailable: false, deliveryAvailable: false,
  rvmapBadged: false, rvmasterBadged: false,
  authorised: false, privacyConsent: false, marketingConsent: false,
};

// Required scalar fields → counted in progress + validated as non-empty.
const REQUIRED: string[] = [
  "dealershipName", "legalName", "abn", "established", "dms", "street", "suburb",
  "state", "postcode", "phone", "leadsEmail", "smsNumber", "contactName",
  "contactRole", "enquiriesEmail", "website", "description", "submitterName",
  "submitterEmail",
];
const PROGRESS_TOTAL = REQUIRED.length + 5; // 3 option groups + logo + photos

export function DealerOnboardingForm({
  recaptchaEnabled = false,
  recaptchaSiteKey = null,
}: DealerOnboardingFormProps = {}) {
  const router = useRouter();
  const recaptchaActive = recaptchaEnabled && !!recaptchaSiteKey;
  const [fields, setFields] = useState<Fields>(INITIAL_FIELDS);
  const [flags, setFlags] = useState<Flags>(INITIAL_FLAGS);
  const [stockCondition, setStockCondition] = useState("Both");
  const [services, setServices] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [hours, setHours] = useState<Hours>(defaultHours);
  const [logo, setLogo] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consentError, setConsentError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Load the reCAPTCHA v3 script once when protection is enabled.
  useEffect(() => {
    if (!recaptchaActive) return;
    const src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  }, [recaptchaActive, recaptchaSiteKey]);

  const set = (name: string, value: string) =>
    setFields((f) => ({ ...f, [name]: value }));
  const flag = (name: string, value: boolean) =>
    setFlags((f) => ({ ...f, [name]: value }));

  const groupHas = (arr: string[], other: string) =>
    arr.length > 0 || other.trim().length > 0;

  // Live progress.
  const done = useMemo(() => {
    let n = 0;
    REQUIRED.forEach((k) => {
      if (fields[k]?.trim()) n++;
    });
    if (groupHas(services, fields.servicesOther)) n++;
    if (groupHas(brands, fields.brandsOther)) n++;
    if (groupHas(productTypes, fields.productsOther)) n++;
    if (logo) n++;
    if (photos.length) n++;
    return n;
  }, [fields, services, brands, productTypes, logo, photos]);
  const pct = Math.round((done / PROGRESS_TOTAL) * 100);

  function validate(): string | null {
    const errs: Record<string, string> = {};
    REQUIRED.forEach((k) => {
      if (!fields[k]?.trim()) errs[k] = "This field is required.";
    });
    ["leadsEmail", "enquiriesEmail", "submitterEmail"].forEach((k) => {
      if (fields[k]?.trim() && !EMAIL_RE.test(fields[k])) errs[k] = "Enter a valid email address.";
    });
    if (fields.postcode.trim() && !/^\d{4}$/.test(fields.postcode))
      errs.postcode = "Enter a valid 4-digit postcode.";
    if (fields.abn.trim() && !/^\d{11}$/.test(fields.abn.replace(/\s/g, "")))
      errs.abn = "Enter a valid 11-digit ABN.";
    if (fields.dms === "Other" && !fields.dmsOther.trim())
      errs.dms = "Please specify your system.";
    if (!groupHas(services, fields.servicesOther)) errs.services = "Select at least one service.";
    if (!groupHas(brands, fields.brandsOther)) errs.brands = "Select or add at least one brand.";
    if (!groupHas(productTypes, fields.productsOther)) errs.productTypes = "Select at least one product type.";
    if (!logo) errs.logo = "Please upload your logo.";
    if (!photos.length) errs.photos = "Please add at least one photo.";

    const consentOk = flags.authorised && flags.privacyConsent && flags.marketingConsent;
    setConsentError(!consentOk);
    setErrors(errs);
    const firstKey = Object.keys(errs)[0];
    if (firstKey) return firstKey;
    if (!consentOk) return "consent";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const first = validate();
    if (first) {
      const el = formRef.current?.querySelector(`[data-field="${first}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      // Get a fresh reCAPTCHA v3 token (verified server-side on create).
      let recaptchaToken: string | undefined;
      if (recaptchaActive) {
        if (!window.grecaptcha) throw new Error("recaptcha not loaded");
        recaptchaToken = await new Promise<string>((resolve, reject) => {
          window.grecaptcha!.ready(() => {
            window
              .grecaptcha!.execute(recaptchaSiteKey!, { action: RECAPTCHA_ACTION })
              .then(resolve)
              .catch(reject);
          });
        });
      }

      // Upload the files first (Strapi routes them to the DigitalOcean Space),
      // then store the returned public URLs directly on the entry — logo as a
      // string, photos as a JSON array of URLs.
      const upload = async (list: File[]): Promise<string[]> => {
        if (!list.length) return [];
        const fd = new FormData();
        list.forEach((f) => fd.append("files", f, f.name));
        const r = await fetch(`${STRAPI_URL}/api/upload`, { method: "POST", body: fd });
        if (!r.ok) throw new Error(`upload ${r.status}`);
        const out = (await r.json()) as { url: string }[];
        // DO Spaces URLs are absolute; the local dev provider returns a relative
        // /uploads path, so make those absolute too.
        return out.map((u) => (u.url.startsWith("http") ? u.url : `${STRAPI_URL}${u.url}`));
      };
      const [logoUrl] = await upload(logo ? [logo] : []);
      const photoUrls = await upload(photos);

      const data = {
        ...fields,
        ...flags,
        established: fields.established ? Number(fields.established) : null,
        stockCondition,
        services,
        brands,
        productTypes,
        tradingHours: hours,
        logo: logoUrl ?? null,
        photos: photoUrls,
        submittedAt: new Date().toISOString(),
        ...(recaptchaToken ? { recaptchaToken } : {}),
      };
      const res = await fetch(`${STRAPI_URL}/api/dealer-submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      router.push("/dealer-directory-onboarding/thank-you");
    } catch (err) {
      setSubmitting(false);
      setSubmitError(
        "Something went wrong sending your details. Please try again in a moment.",
      );
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen bg-cream-deep">
      {/* Sticky progress rail */}
      <div className="sticky top-0 z-50 border-b border-line border-t-[3px] border-t-rust bg-cream-deep/90 backdrop-blur-[8px]">
        <div className="mx-auto flex max-w-[720px] items-center gap-3.5 px-[18px] py-[11px] sm:px-7">
          <span className="hidden whitespace-nowrap font-oswald text-[15px] font-semibold text-green sm:inline">
            Escape the Noise
          </span>
          <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-badge-open-bg">
            <div
              className="h-full rounded-full bg-green transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-[12.5px] font-semibold text-muted">
            {done} of {PROGRESS_TOTAL} done
          </span>
        </div>
      </div>

      {/* Masthead */}
      <header className="mx-auto max-w-[720px] px-[18px] pb-3 pt-8 sm:px-7 sm:pt-12">
        <Image
          src="/brand/lockup-horizontal-fullcolour.svg"
          alt="Escape the Noise"
          width={220}
          height={44}
          className="mb-5"
          style={{ height: "44px", width: "auto" }}
          priority
        />
        <Eyebrow className="mb-2.5">no better time to</Eyebrow>
        <h1 className="m-0 mb-3.5 font-oswald text-[32px] font-bold leading-[1.06] tracking-tight text-green md:text-[40px] lg:text-[46px]">
          List your dealership
        </h1>
        <p className="m-0 max-w-[54ch] text-[16.5px] text-muted">
          Get found by the caravan and RV travellers searching for their next escape.
          Fill this in once and your dealership goes live on{" "}
          <strong className="font-semibold text-green">nobettertime.com.au</strong>.
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-badge-open-bg px-3.5 py-[7px] text-[12.5px] font-semibold text-green-dark">
          Takes about 5 minutes
        </span>
      </header>

      {/* Form */}
      <form
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        className="mx-auto max-w-[720px] px-[18px] pb-16 pt-7 sm:px-7 sm:pb-20"
      >
        {/* 1. Dealership details */}
        <FormSection num={1} title="Dealership details" subtitle="The basics buyers will see on your listing.">
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
            <Field full label="Dealership name" required htmlFor="dealershipName" hint="The trading name shown on your listing." error={errors.dealershipName} >
              <span data-field="dealershipName" />
              <Input id="dealershipName" value={fields.dealershipName} onChange={(e) => set("dealershipName", e.target.value)} aria-invalid={!!errors.dealershipName} placeholder="e.g. Aussie Caravan Centre" />
            </Field>
            <Field label="Registered business name" required htmlFor="legalName" hint="Your full legal entity name, if it differs." error={errors.legalName}>
              <span data-field="legalName" />
              <Input id="legalName" value={fields.legalName} onChange={(e) => set("legalName", e.target.value)} aria-invalid={!!errors.legalName} placeholder="Full registered business name" />
            </Field>
            <Field label="ABN" required htmlFor="abn" hint="Your 11-digit Australian Business Number." error={errors.abn}>
              <span data-field="abn" />
              <Input id="abn" inputMode="numeric" value={fields.abn} onChange={(e) => set("abn", e.target.value)} aria-invalid={!!errors.abn} placeholder="11 digits" />
            </Field>
            <Field label="Year established" required htmlFor="established" hint="The year your dealership first opened." error={errors.established}>
              <span data-field="established" />
              <Input id="established" type="number" min={1900} max={2026} value={fields.established} onChange={(e) => set("established", e.target.value)} aria-invalid={!!errors.established} placeholder="e.g. 1998" />
            </Field>
            <Field label="Dealer / stock management system" required htmlFor="dms" hint="So we can look at syncing your stock feed where possible." error={errors.dms}>
              <span data-field="dms" />
              <Select id="dms" value={fields.dms} onChange={(e) => set("dms", e.target.value)} aria-invalid={!!errors.dms}>
                <option value="" disabled>Select your system…</option>
                {DMS_SYSTEMS.map((s) => <option key={s}>{s}</option>)}
              </Select>
              {fields.dms === "Other" && (
                <Input className="mt-2.5" value={fields.dmsOther} onChange={(e) => set("dmsOther", e.target.value)} placeholder="Please specify your system" />
              )}
            </Field>
          </div>
        </FormSection>

        {/* 2. Location */}
        <FormSection num={2} title="Location" subtitle="So buyers can find the dealers nearest them.">
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
            <Field full label="Street address" required htmlFor="street" hint="Where buyers will find your yard." error={errors.street}>
              <span data-field="street" />
              <Input id="street" value={fields.street} onChange={(e) => set("street", e.target.value)} aria-invalid={!!errors.street} placeholder="e.g. 42 Princes Highway" />
            </Field>
            <Field label="Suburb / town" required htmlFor="suburb" hint="The suburb or town you're in." error={errors.suburb}>
              <span data-field="suburb" />
              <Input id="suburb" value={fields.suburb} onChange={(e) => set("suburb", e.target.value)} aria-invalid={!!errors.suburb} placeholder="e.g. Dandenong" />
            </Field>
            <Field label="State" required htmlFor="state" hint="Pick your state or territory." error={errors.state}>
              <span data-field="state" />
              <Select id="state" value={fields.state} onChange={(e) => set("state", e.target.value)} aria-invalid={!!errors.state}>
                <option value="" disabled>Select state…</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field full label="Postcode" required htmlFor="postcode" hint="Used to match you with nearby buyers." error={errors.postcode}>
              <span data-field="postcode" />
              <Input id="postcode" inputMode="numeric" maxLength={4} className="max-w-[160px]" value={fields.postcode} onChange={(e) => set("postcode", e.target.value)} aria-invalid={!!errors.postcode} placeholder="e.g. 3175" />
            </Field>
            <div className="sm:col-span-2">
              <ToggleLine id="multipleLocations" name="multipleLocations" checked={flags.multipleLocations} onChange={(v) => flag("multipleLocations", v)} label="We have more than one location" sub="Tick this and we'll be in touch to list your other yards." />
            </div>
          </div>
        </FormSection>

        {/* 3. Contact & enquiries */}
        <FormSection num={3} title="Contact & enquiries" subtitle="Where your future calls and enquiries go.">
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
            <Field label="Phone number" required htmlFor="phone" hint="Your main line for buyer enquiries." error={errors.phone}>
              <span data-field="phone" />
              <Input id="phone" type="tel" value={fields.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} placeholder="e.g. (03) 9000 0000" />
            </Field>
            <Field label="Email for enquiries" required htmlFor="leadsEmail" hint="Every enquiry lands here." error={errors.leadsEmail}>
              <span data-field="leadsEmail" />
              <Input id="leadsEmail" type="email" value={fields.leadsEmail} onChange={(e) => set("leadsEmail", e.target.value)} aria-invalid={!!errors.leadsEmail} placeholder="sales@yourdealership.com.au" />
            </Field>
            <Field label="Mobile for instant lead alerts" required htmlFor="smsNumber" hint="We can text you the moment an enquiry comes in." error={errors.smsNumber}>
              <span data-field="smsNumber" />
              <Input id="smsNumber" type="tel" value={fields.smsNumber} onChange={(e) => set("smsNumber", e.target.value)} aria-invalid={!!errors.smsNumber} placeholder="e.g. 0400 000 000" />
            </Field>
            <Field label="Main contact name" required htmlFor="contactName" hint="Who we should speak to at your dealership." error={errors.contactName}>
              <span data-field="contactName" />
              <Input id="contactName" value={fields.contactName} onChange={(e) => set("contactName", e.target.value)} aria-invalid={!!errors.contactName} placeholder="Who should we reach?" />
            </Field>
            <Field label="Their role" required htmlFor="contactRole" hint="Their position on your team." error={errors.contactRole}>
              <span data-field="contactRole" />
              <Input id="contactRole" value={fields.contactRole} onChange={(e) => set("contactRole", e.target.value)} aria-invalid={!!errors.contactRole} placeholder="e.g. Dealer Principal" />
            </Field>
            <Field label="Public enquiries email" required htmlFor="enquiriesEmail" hint="Shown publicly on your listing." error={errors.enquiriesEmail}>
              <span data-field="enquiriesEmail" />
              <Input id="enquiriesEmail" type="email" value={fields.enquiriesEmail} onChange={(e) => set("enquiriesEmail", e.target.value)} aria-invalid={!!errors.enquiriesEmail} placeholder="info@yourdealership.com.au" />
            </Field>
          </div>
        </FormSection>

        {/* 4. Trading hours */}
        <FormSection num={4} title="Trading hours" subtitle="When you're open. Untick a day to mark it closed.">
          <TradingHours hours={hours} onChange={setHours} />
        </FormSection>

        {/* 5. What you offer */}
        <FormSection num={5} title="What you offer" subtitle="This powers the directory's search filters.">
          <div className="grid grid-cols-1 gap-[18px]">
            <Field full label="Services offered" required hint="Pick everything your dealership offers." error={errors.services}>
              <span data-field="services" />
              <MultiSelect placeholder="Select services…" options={SERVICES} selected={services} onChange={setServices} invalid={!!errors.services} />
              <Input className="mt-2.5" value={fields.servicesOther} onChange={(e) => set("servicesOther", e.target.value)} placeholder="Other services not listed — separate with commas" />
            </Field>
            <Field full label="Brands stocked" required hint="All the brands you currently stock." error={errors.brands}>
              <span data-field="brands" />
              <MultiSelect placeholder="Select brands…" options={BRANDS} selected={brands} onChange={setBrands} invalid={!!errors.brands} />
              <Input className="mt-2.5" value={fields.brandsOther} onChange={(e) => set("brandsOther", e.target.value)} placeholder="Other brands not listed — separate with commas" />
            </Field>
            <Field full label="Product types you sell" required hint="The kinds of vans you sell." error={errors.productTypes}>
              <span data-field="productTypes" />
              <MultiSelect placeholder="Select product types…" options={PRODUCT_TYPES} selected={productTypes} onChange={setProductTypes} invalid={!!errors.productTypes} />
              <Input className="mt-2.5" value={fields.productsOther} onChange={(e) => set("productsOther", e.target.value)} placeholder="Other product types not listed — separate with commas" />
            </Field>
            <Field full label="Do you sell new, used, or both?" hint="Lets buyers filter for what they're after.">
              <RadioPills name="stockCondition" options={["New", "Used", "Both"]} value={stockCondition} onChange={setStockCondition} />
            </Field>
            <div>
              <ToggleLine id="financeAvailable" name="financeAvailable" checked={flags.financeAvailable} onChange={(v) => flag("financeAvailable", v)} label="We offer finance & insurance" sub="Tick if you can arrange finance and insurance." />
              <ToggleLine id="deliveryAvailable" name="deliveryAvailable" checked={flags.deliveryAvailable} onChange={(v) => flag("deliveryAvailable", v)} label="We deliver Australia-wide" sub="Helps buyers outside your area know they can still buy from you." />
            </div>
            <Field full label="Accreditation" hint="Industry badges your stock carries.">
              <ToggleLine id="rvmapBadged" name="rvmapBadged" checked={flags.rvmapBadged} onChange={(v) => flag("rvmapBadged", v)} label="I sell RVMAP-badged RVs" sub="Tick if your RVs carry the RVMAP accreditation badge." />
              <ToggleLine id="rvmasterBadged" name="rvmasterBadged" checked={flags.rvmasterBadged} onChange={(v) => flag("rvmasterBadged", v)} label="I sell RV Master-badged RVs" sub="Tick if your RVs carry the RV Master badge." />
            </Field>
          </div>
        </FormSection>

        {/* 6. Your listing */}
        <FormSection num={6} title="Your listing" subtitle="What makes your profile look the part.">
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
            <Field full label="Website" required htmlFor="website" hint="Your dealership's main website address." error={errors.website}>
              <span data-field="website" />
              <Input id="website" type="url" value={fields.website} onChange={(e) => set("website", e.target.value)} aria-invalid={!!errors.website} placeholder="https://www.yourdealership.com.au" />
            </Field>
            <Field full label="Short description" required htmlFor="description" hint="A line or two for the top of your listing." error={errors.description}>
              <span data-field="description" />
              <Textarea id="description" maxLength={320} value={fields.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!errors.description} placeholder="e.g. Family-owned since 1998, we stock Australia's leading off-road vans with a full service workshop on site." />
              <span className="-mt-0.5 text-right text-[12px] text-muted">{fields.description.length} / 320</span>
            </Field>
            <Field full label="Dealership logo" required hint={`Appears at the top of your listing. Max ${MAX_FILE_MB}MB.`} error={errors.logo}>
              <span data-field="logo" />
              <div className="flex flex-wrap items-center gap-3.5">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-input bg-badge-open-bg px-4 py-2.5 text-[14px] font-semibold text-green-dark hover:bg-sand/50">
                  Upload logo
                  <input type="file" accept={ACCEPT_ATTR} className="absolute h-px w-px overflow-hidden opacity-0" onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && !isAllowedImage(f)) {
                      setErrors((prev) => ({ ...prev, logo: "Logo must be a PNG, JPG or WebP image." }));
                      return;
                    }
                    if (f && f.size > MAX_FILE_BYTES) {
                      setErrors((prev) => ({ ...prev, logo: `Logo must be ${MAX_FILE_MB}MB or smaller.` }));
                      return;
                    }
                    setErrors((prev) => ({ ...prev, logo: "" }));
                    setLogo(f);
                  }} />
                </label>
                <span className="text-[13px] text-muted">{logo ? logo.name : "PNG, JPG or WebP"}</span>
              </div>
            </Field>
            <Field full label="Dealership photos" required hint={`Add at least one — up to 5. Your yard, showroom or vans on display (your logo stays separate). Max ${MAX_FILE_MB}MB per photo.`} error={errors.photos}>
              <span data-field="photos" />
              <PhotoUploader files={photos} onChange={setPhotos} />
            </Field>
            <Field label="Facebook" optional htmlFor="facebook" hint="Your Facebook page link.">
              <Input id="facebook" type="url" value={fields.facebook} onChange={(e) => set("facebook", e.target.value)} placeholder="facebook.com/yourdealership" />
            </Field>
            <Field label="Instagram" optional htmlFor="instagram" hint="Your Instagram profile link.">
              <Input id="instagram" type="url" value={fields.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="instagram.com/yourdealership" />
            </Field>
            <Field label="YouTube" optional htmlFor="youtube" hint="Your YouTube channel link.">
              <Input id="youtube" type="url" value={fields.youtube} onChange={(e) => set("youtube", e.target.value)} placeholder="youtube.com/@yourdealership" />
            </Field>
            <Field label="Google profile" optional htmlFor="googleProfile" hint="Lets us show your Google rating.">
              <Input id="googleProfile" type="url" value={fields.googleProfile} onChange={(e) => set("googleProfile", e.target.value)} placeholder="Link to your Google listing" />
            </Field>
          </div>
        </FormSection>

        {/* 7. Final details */}
        <FormSection num={7} title="Final details" subtitle="A few last details, then you're done.">
          <div className="mb-[18px] grid grid-cols-1 gap-[18px] sm:grid-cols-2">
            <Field label="Your name" required htmlFor="submitterName" hint="The person filling this in." error={errors.submitterName}>
              <span data-field="submitterName" />
              <Input id="submitterName" value={fields.submitterName} onChange={(e) => set("submitterName", e.target.value)} aria-invalid={!!errors.submitterName} placeholder="Your full name" />
            </Field>
            <Field label="Your email" required htmlFor="submitterEmail" hint="Where we'll send your confirmation." error={errors.submitterEmail}>
              <span data-field="submitterEmail" />
              <Input id="submitterEmail" type="email" value={fields.submitterEmail} onChange={(e) => set("submitterEmail", e.target.value)} aria-invalid={!!errors.submitterEmail} placeholder="you@yourdealership.com.au" />
            </Field>
            <Field label="Your phone" optional htmlFor="submitterPhone" hint="In case we need to follow up.">
              <Input id="submitterPhone" type="tel" value={fields.submitterPhone} onChange={(e) => set("submitterPhone", e.target.value)} placeholder="e.g. 0400 000 000" />
            </Field>
            <Field label="Your state association" optional htmlFor="stateAssociation" hint="Your state's caravan industry body.">
              <Select id="stateAssociation" value={fields.stateAssociation} onChange={(e) => set("stateAssociation", e.target.value)}>
                <option value="" disabled>Select your association…</option>
                {STATE_ASSOCIATIONS.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <div data-field="consent" className="rounded-input bg-[#f6eedc] px-5 py-[18px]">
            <ToggleLine id="authorised" name="authorised" checked={flags.authorised} onChange={(v) => flag("authorised", v)} label={<>I&apos;m authorised to list this dealership and confirm the details above are correct. <span className="font-bold text-rust">*</span></>} />
            <div className="mt-[11px]">
              <ToggleLine id="privacyConsent" name="privacyConsent" checked={flags.privacyConsent} onChange={(v) => flag("privacyConsent", v)} label={<>I agree to my dealership being listed on nobettertime.com.au and to future enquiries being passed to the contacts provided. <span className="font-bold text-rust">*</span></>} />
            </div>
            <div className="mt-[11px]">
              <ToggleLine id="marketingConsent" name="marketingConsent" checked={flags.marketingConsent} onChange={(v) => flag("marketingConsent", v)} label={<>I agree to be contacted for training and lead management by Caravea. <span className="font-bold text-rust">*</span></>} />
            </div>
            {consentError && (
              <span className="mt-2.5 block text-[12.5px] font-medium text-[#b4452f]">Please tick all three boxes to continue.</span>
            )}
          </div>
        </FormSection>

        <Button variant="primary" fullWidth type="submit" disabled={submitting} className="text-green-dark">
          {submitting ? "Sending…" : "List my dealership"}
        </Button>
        {submitError && (
          <p className="mt-3 text-center text-[13px] font-medium text-[#b4452f]">{submitError}</p>
        )}
        <p className="mt-3.5 text-center text-[12.5px] text-muted">
          We&apos;ll review your details and have your listing live shortly.
        </p>
        {recaptchaActive && (
          <p className="mt-2 text-center text-[11px] text-muted">
            This site is protected by reCAPTCHA and the Google{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>{" "}
            and{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms of Service</a>{" "}
            apply.
          </p>
        )}
        <p className="mt-7 flex items-center justify-center gap-1 text-[12px] text-muted">
          Powered by
          <a
            href="https://caravea.au/"
            target="_blank"
            rel="noopener"
            className="group inline-flex items-center gap-1 font-semibold text-green"
          >
            <Image
              src="/brand/caravea-icon-form.svg"
              alt=""
              width={14}
              height={14}
              className="inline-block"
            />
            <span className="group-hover:underline">Caravea</span>
          </a>
        </p>
      </form>
    </div>
  );
}
