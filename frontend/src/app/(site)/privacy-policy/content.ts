import type { Block } from "@/lib/strapi";

// Baseplate fallback for the privacy policy, mirroring the Footer's own
// hardcoded-fallback pattern: the page renders this when the Strapi
// `privacy-policy` single type is empty or unreachable, and the CMS overrides
// it once an editor fills it in. Content adapted from the Caravan Industry
// Association of Australia privacy policy (the site's copyright holder), under
// the Privacy Act 1988 (Cth) and the Australian Privacy Principles.

export const PRIVACY_TITLE = "Privacy Policy";
export const PRIVACY_LAST_UPDATED = "2026-07-01";

const p = (text: string): Block => ({
  type: "paragraph",
  children: [{ type: "text", text }],
});
const h = (text: string): Block => ({
  type: "heading",
  children: [{ type: "text", text }],
});

export const PRIVACY_FALLBACK: Block[] = [
  p(
    'This Privacy Policy explains how the Caravan Industry Association of Australia ("we", "us", "our") collects, holds, uses and discloses your personal information in connection with the Escape the Noise website and our related activities. We are committed to protecting your privacy and to handling your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).',
  ),

  h("What information is covered by the Privacy Act?"),
  p(
    'The Privacy Act covers "personal information", which is information or an opinion about an identified individual, or an individual who is reasonably identifiable, whether the information or opinion is true or not and whether it is recorded in a material form or not.',
  ),

  h("What kind of information do we collect and hold?"),
  p(
    "The kinds of personal information we collect and hold depend on your dealings with us and may include:",
  ),
  {
    type: "list",
    format: "unordered",
    children: [
      {
        type: "list-item",
        children: [
          {
            type: "text",
            text: "your name and contact details, such as your postal address, email address and telephone number;",
          },
        ],
      },
      {
        type: "list-item",
        children: [
          {
            type: "text",
            text: "information about your preferences, interests and the caravans or camping products you enquire about;",
          },
        ],
      },
      {
        type: "list-item",
        children: [
          {
            type: "text",
            text: "details you provide when you submit a form, make an enquiry, or ask us to put you in contact with a dealer; and",
          },
        ],
      },
      {
        type: "list-item",
        children: [
          {
            type: "text",
            text: 'technical information collected automatically when you use our website (see "Information collected via our website" below).',
          },
        ],
      },
    ],
  } as unknown as Block,

  h("Why do we collect personal information?"),
  p(
    "We collect personal information so that we can carry out our functions and activities, respond to your enquiries, connect you with dealers, provide and improve our services, communicate with you, comply with our legal and regulatory obligations, and — where you have not opted out — send you information and marketing that may be of interest to you.",
  ),

  h("Collecting personal information"),
  p(
    "We usually collect personal information directly from you — for example, when you complete a form on our website, contact us, or interact with us on social media. In some cases we may collect personal information about you from third parties, such as our members, dealers, service providers or publicly available sources, where it is not reasonable or practicable to collect it directly from you.",
  ),

  h("Information collected via our website"),
  p(
    'When you visit our website, our servers may automatically record information such as your IP address, browser type, the pages you visit and the date and time of your visit ("clickstream data"). We and our service providers may use cookies, web beacons and similar technologies to remember your preferences, understand how our website is used, and deliver relevant advertising. You can set your browser to refuse cookies, but some parts of the website may not function properly as a result.',
  ),

  h("How we use personal information"),
  p(
    "We use personal information to deliver and administer our services; to respond to your enquiries and connect you with dealers; to operate, maintain and improve our website; to conduct research and analysis; to comply with our legal obligations; and, where permitted, to send you direct marketing communications. You can opt out of receiving direct marketing at any time by using the unsubscribe facility in our communications or by contacting us using the details below.",
  ),

  h("When do we disclose personal information?"),
  p(
    "We may disclose your personal information to our members and dealers (for example, to connect you with a dealer you have asked about), to our employees and contractors, to third-party service providers who assist us to operate our business and website, and to government agencies, regulators and other parties where required or authorised by law.",
  ),

  h("Disclosure of your personal information overseas"),
  p(
    "Some of the service providers we use may store or process personal information outside Australia, including in the United States. Where we disclose personal information overseas, we take reasonable steps to ensure it is handled in accordance with the Australian Privacy Principles.",
  ),

  h("Notifiable Data Breaches scheme"),
  p(
    "We are subject to the Notifiable Data Breaches scheme under Part IIIC of the Privacy Act. If we become aware of an eligible data breach that is likely to result in serious harm, we will notify affected individuals and the Office of the Australian Information Commissioner as required by law.",
  ),

  h("Storage and security of personal information"),
  p(
    "We take reasonable steps to protect the personal information we hold from misuse, interference and loss, and from unauthorised access, modification or disclosure. This includes physical, electronic and procedural safeguards for both digital records and hard-copy records.",
  ),

  h("Updating and correcting your personal information"),
  p(
    "We take reasonable steps to ensure the personal information we hold is accurate, complete and up to date. You may ask us to update or correct your personal information at any time by contacting us using the details below.",
  ),

  h("How long will we keep your personal information?"),
  p(
    "We will keep your personal information only for as long as it is required for our business purposes and otherwise as required by law. When it is no longer needed, we will take reasonable steps to destroy or de-identify it.",
  ),

  h("Finding out what personal information we hold about you"),
  p(
    "You may request access to the personal information we hold about you by contacting us using the details below. We will respond to your request within a reasonable period. In some circumstances we may be permitted to refuse access, in which case we will explain why.",
  ),

  h("How to contact us, find out more information or make a complaint"),
  p(
    "If you have any questions about this Privacy Policy, wish to access or correct your personal information, or would like to make a complaint about how we have handled your personal information, please contact our Privacy Officer:",
  ),
  p("Attn: Privacy Officer, Caravan Industry Association of Australia, PO Box 788, Port Melbourne VIC 3207."),
  p(
    "We will acknowledge your enquiry or complaint and respond within a reasonable period. If you are not satisfied with our response, you may contact the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au.",
  ),
];
