import path from "path";
import type { NextConfig } from "next";

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;

type ImageRemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

const remotePatterns: ImageRemotePattern[] = [];

if (strapiUrl) {
  const { protocol, hostname, port } = new URL(strapiUrl);

  remotePatterns.push({
    protocol: protocol.replace(":", "") as "http" | "https",
    hostname,
    port,
    pathname: "/**",
  });

  // Strapi Cloud serves uploads from *.media.strapiapp.com, not the API hostname.
  if (hostname.endsWith(".strapiapp.com")) {
    remotePatterns.push({
      protocol: "https",
      hostname: "**.media.strapiapp.com",
      port: "",
      pathname: "/**",
    });
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    remotePatterns,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
