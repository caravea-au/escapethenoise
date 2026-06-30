/**
 * dealer-submission lifecycles
 *
 * On create, email the team a summary of the new dealership listing. The send
 * is best-effort: any failure (e.g. placeholder SMTP creds in dev) is caught
 * and logged so it never fails the submission itself.
 */

type AnyRecord = Record<string, unknown>;

function line(label: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  const v = Array.isArray(value) ? value.join(', ') : String(value);
  return `${label}: ${v}\n`;
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
    line('Marketing consent', d.marketingConsent ? 'Yes' : 'No')
  );
}

export default {
  async afterCreate(event: { result: AnyRecord }) {
    const d = event.result;
    const to =
      process.env.LEADS_NOTIFY_EMAIL || process.env.SMTP_FROM || 'noreply7@caravea.au';

    try {
      await strapi.plugin('email').service('email').send({
        to,
        subject: `New dealership listing — ${d.dealershipName ?? 'Unknown'}`,
        text: buildSummary(d),
      });
      strapi.log.info(`[dealer-submission] notification emailed to ${to}`);
    } catch (err) {
      strapi.log.error(
        `[dealer-submission] notification email failed (submission still saved): ${
          (err as Error)?.message ?? err
        }`,
      );
    }
  },
};
