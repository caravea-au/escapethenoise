/**
 * dealer-submission lifecycles
 *
 * On create, email the team a summary of the new dealership listing. SMTP
 * credentials come from the "SMTP Settings" single type (managed in the admin,
 * not .env). The send is best-effort: any failure (missing/placeholder creds)
 * is caught and logged so it never fails the submission itself.
 */

import nodemailer from 'nodemailer';

import { isConnectEnabled, postDealerRegistration } from '../../../../utils/connect-client';
import { shouldPushToConnect, toConnectRegistration } from '../../../../utils/connect-registration';

type AnyRecord = Record<string, unknown>;

function line(label: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  const v = Array.isArray(value) ? value.join(', ') : String(value);
  return `${label}: ${v}\n`;
}

/**
 * Media failures get their own block, NOT a `line()` call: `line()` does
 * String(value) on arrays, so an array of objects would render as
 * "[object Object], [object Object]". This block is the operational channel for
 * chasing a dealer whose logo or photo didn't upload — the submission is saved
 * either way, so without this nobody would know anything was missing.
 */
function buildMediaBlock(d: AnyRecord): string {
  const failures = Array.isArray(d.mediaErrors) ? (d.mediaErrors as AnyRecord[]) : [];
  if (!failures.length) return '';
  const rows = failures
    .map(
      (m) =>
        `  - ${String(m.field)}: ${String(m.name)} (${String(m.size)} bytes, ${
          String(m.type) || 'no type'
        }) — ${String(m.message)}\n`,
    )
    .join('');
  return `\n*** ${failures.length} IMAGE(S) FAILED TO UPLOAD — chase the dealer for these ***\n${rows}`;
}

function buildSummary(d: AnyRecord): string {
  return (
    line('Dealership', d.dealershipName) +
    line('Registered name', d.legalName) +
    line('ABN', d.abn) +
    line('Established', d.established) +
    line('DMS', d.dmsOther || d.dms) +
    '\n' +
    line('Address', [d.street, d.suburb, d.state, d.postcode].filter(Boolean).join(', ')) +
    // The pin the dealer placed on the map, if they placed one. Readable here
    // because the coordinates are now columns on this row, written before
    // `super.create`, so they are in `event.result` — when they lived in a
    // separate collection this lifecycle ran too early to ever see them.
    // `line()` returns '' for null, so a pin-less submission just omits the row.
    line(
      'Map pin',
      Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
        ? `${d.latitude}, ${d.longitude} (${d.precision === 'street' ? 'street level' : 'approximate'}` +
            `${d.geocodeSource === 'adjusted' ? ', dealer positioned it themselves' : ''}) ` +
            `https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}`
        : '',
    ) +
    line('Motor Dealer Licence name', d.motorDealerLicenceName) +
    line('Motor Dealer Licence number', d.motorDealerLicenceNumber) +
    line('Multiple locations', d.multipleLocations ? 'Yes' : 'No') +
    '\n' +
    line('Phone', d.phone) +
    line('Leads email', d.leadsEmail) +
    line('SMS number', d.smsNumber) +
    line('Contact', [d.contactName, d.contactRole].filter(Boolean).join(' — ')) +
    line('Public enquiries email', d.enquiriesEmail) +
    '\n' +
    line('Services', d.services) +
    line('Other services', d.servicesOther) +
    line('Brands', d.brands) +
    line('Other brands', d.brandsOther) +
    line('Product types', d.productTypes) +
    line('Other product types', d.productsOther) +
    line('Stock condition', d.stockCondition) +
    line('Finance available', d.financeAvailable ? 'Yes' : '') +
    line('Delivery Australia-wide', d.deliveryAvailable ? 'Yes' : '') +
    line('RVMAP badged', d.rvmapBadged ? 'Yes' : '') +
    line('RV Master badged', d.rvmasterBadged ? 'Yes' : '') +
    '\n' +
    line('Website', d.website) +
    line('Description', d.description) +
    line('Facebook', d.facebook) +
    line('Instagram', d.instagram) +
    line('YouTube', d.youtube) +
    line('Google profile', d.googleProfile) +
    '\n' +
    line('Submitted by', [d.submitterName, d.submitterEmail, d.submitterPhone].filter(Boolean).join(' / ')) +
    line('State association', d.stateAssociation) +
    line('Authorised', d.authorised ? 'Yes' : 'No') +
    line('Privacy consent', d.privacyConsent ? 'Yes' : 'No') +
    line('Marketing consent', d.marketingConsent ? 'Yes' : 'No') +
    line('Spam suspect', d.spamSuspect ? 'YES — review before listing' : '') +
    buildMediaBlock(d)
  );
}

export default {
  async afterCreate(event: { result: AnyRecord }) {
    const d = event.result;

    // Caravea Connect forward — its OWN try/catch, placed BEFORE the SMTP
    // block below on purpose. That block RETURNS EARLY whenever the "SMTP
    // Settings" single type is missing, disabled, or hostless — true on
    // every environment without SMTP configured — so anything placed after
    // that return would be dead code there. Best-effort only: afterCreate
    // runs inside the create's DB write transaction, so there is no retry;
    // a miss is covered by a separate re-push, not automatically here.
    try {
      if (isConnectEnabled()) {
        const documentId = String(d.documentId ?? '');
        const gate = shouldPushToConnect(d);
        if (gate.ok) {
          const payload = toConnectRegistration(d);
          await postDealerRegistration(strapi, documentId, payload);
        } else {
          strapi.log.warn(
            `[dealer-submission] Connect push skipped (documentId=${documentId}, reason=${gate.reason})`,
          );
        }
      }
    } catch (err) {
      strapi.log.error(
        `[dealer-submission] Connect forward failed (submission still saved): ${
          (err as Error)?.message ?? err
        }`,
      );
    }

    try {
      const cfg = (await strapi
        .documents('api::smtp-setting.smtp-setting')
        .findFirst()) as AnyRecord | null;

      if (!cfg || cfg.enabled === false || !cfg.host) {
        strapi.log.warn(
          '[dealer-submission] SMTP Settings not configured (or disabled); skipping notification email. Submission still saved.',
        );
        return;
      }

      const fromEmail = (cfg.fromEmail as string) || 'noreply7@caravea.au';
      const from = cfg.fromName ? `"${cfg.fromName}" <${fromEmail}>` : fromEmail;
      const receiver = (cfg.notifyEmail as string) || fromEmail;

      const transporter = nodemailer.createTransport({
        host: cfg.host as string,
        port: (cfg.port as number) ?? 587,
        secure: (cfg.secure as boolean) ?? false, // 587 uses STARTTLS, not implicit TLS
        auth: cfg.username
          ? { user: cfg.username as string, pass: (cfg.password as string) ?? '' }
          : undefined,
        // Keep a misconfigured SMTP host from hanging the submission request.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });

      // Each send is independent: one failing must not stop the other.
      const send = async (
        label: string,
        opts: { to: string; subject: string; text: string },
      ) => {
        try {
          await transporter.sendMail({ from, replyTo: fromEmail, ...opts });
          strapi.log.info(`[dealer-submission] ${label} emailed to ${opts.to}`);
        } catch (err) {
          strapi.log.error(
            `[dealer-submission] ${label} email failed (submission still saved): ${
              (err as Error)?.message ?? err
            }`,
          );
        }
      };

      const dealership = (d.dealershipName as string) ?? 'Unknown';

      // 1. Alert the admin / receiver that a new submission came in.
      await send('admin notification', {
        to: receiver,
        subject: `New dealership listing — ${dealership}`,
        text: `A new dealership listing has been received from the Escape the Noise site.\n\n${buildSummary(d)}`,
      });

      // 2. Confirm receipt to the person who filled in the form.
      const submitterEmail = (d.submitterEmail as string)?.trim();
      if (submitterEmail) {
        const submitterName = (d.submitterName as string)?.trim() || 'there';
        await send('submitter confirmation', {
          to: submitterEmail,
          subject: "We've received your dealership listing",
          text: `Hi ${submitterName},

Thanks for submitting ${dealership} to Escape the Noise. We've received your details and our team will review them shortly — your listing will be live on nobettertime.com.au soon.

We'll be in touch using the contact details provided.

— The Escape the Noise team`,
        });
      }
    } catch (err) {
      strapi.log.error(
        `[dealer-submission] notification email setup failed (submission still saved): ${
          (err as Error)?.message ?? err
        }`,
      );
    }
  },
};
