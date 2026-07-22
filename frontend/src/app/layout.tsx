import type { Metadata } from "next";
import { oswald, hanken } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://nobettertime.com.au"),
  title: {
    default: "Find a Dealer | Caravan Industry Association of Australia",
    template: "%s | No Better Time To Escape The Noise",
  },
  description:
    "Australia's most trusted caravan resource — search 403+ accredited dealers near you. The official dealer directory of the Caravan Industry Association of Australia.",
  keywords: [
    "caravan dealer",
    "accredited caravan dealer",
    "find a dealer",
    "caravan industry association of australia",
    "CIAA",
  ],
  openGraph: {
    type: "website",
    siteName: "Find a Dealer",
    locale: "en_AU",
    url: "https://nobettertime.com.au",
    title: "Find a Dealer | Caravan Industry Association of Australia",
    description:
      "Australia's most trusted caravan resource — search 403+ accredited dealers near you. The official dealer directory of the Caravan Industry Association of Australia.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "No Better Time To Escape The Noise",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find a Dealer | Caravan Industry Association of Australia",
    description:
      "Australia's most trusted caravan resource — search 403+ accredited dealers near you. The official dealer directory of the Caravan Industry Association of Australia.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${oswald.variable} ${hanken.variable}`}>
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-P3G34KRZ');`,
          }}
        />
        {/* End Google Tag Manager */}
        {/* Basecamp Pixel Code by Caravea */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){
    w[l]=w[l]||[];
    w[l].push({
        'pixel.token': 'BC-NOBZ9MF1',
        'pixel.endpoint': "https://basecamp.caravea.au/api/pixel/submit",
        'pixel.debug': true,
        'pixel.ecosystemKey': "{wl!F]4q0H'9~^-GBDpHo7ou[s!PW!Rx"
    });
    var f=d.getElementsByTagName(s)[0],j=d.createElement(s);
    j.async=1;
    j.src='https://basecamp.caravea.au/pixel/basecamp.js?v=' + Date.now();
    f.parentNode.insertBefore(j,f);
})(window,document,'script','basecampDataLayer','BC-NOBZ9MF1');`,
          }}
        />
        {/* End Basecamp Pixel Code */}
      </head>
      <body className="flex min-h-svh flex-col">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-P3G34KRZ"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {children}
      </body>
    </html>
  );
}
