import type { Core } from '@strapi/strapi';

// Hard cap on any single uploaded file, enforced server-side (the form's
// client-side check is bypassable). Keep in sync with the note shown on the
// dealer-directory-onboarding form.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  // Uploads are capped at 50 MB per file and stored in a DigitalOcean Space
  // (S3-compatible) instead of the app server's local disk, which was filling
  // up. The Space is configured via env in backend/.env — see DO_SPACE_* keys.
  // With a blank DO_SPACE_ENDPOINT the provider block is omitted and Strapi
  // falls back to the local provider, so dev without Spaces credentials still
  // works; the size limit applies eitherway.
  upload: {
    config: {
      sizeLimit: MAX_UPLOAD_BYTES,
      // Only real image files may be uploaded. SVG is deliberately excluded — it
      // can embed <script>. If an editor later needs SVG/PDF in the admin, widen
      // this list.
      //
      // CAUTION — this allow-list is NOT a magic-byte check, despite what an
      // earlier version of this comment claimed. Strapi only compares against
      // detected content when the bundled file-type lib actually recognises a
      // signature; for anything signature-less (plain text, HTML, JS, a bare
      // <svg> with no XML prolog) it falls back to the *filename extension*
      // (@strapi/upload → utils/mime-validation.mjs, `expectedMimeFromExt`).
      // That extension is client-supplied, so `evil.txt` renamed `evil.jpg` and
      // declared image/jpeg passed this list with a 201.
      //
      // Real enforcement for the PUBLIC route lives in
      // backend/src/middlewares/require-image-signature.ts, which reads the
      // leading bytes itself. Adding `deniedTypes` here does not help: it is
      // evaluated against the mimetype Strapi already settled on, which in that
      // scenario is a clean image/jpeg.
      security: {
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp'],
      },
      ...(env('DO_SPACE_ENDPOINT')
        ? {
            provider: 'aws-s3',
            providerOptions: {
              // Public URL Strapi stores for each file. Defaults to the S3
              // origin; set DO_SPACE_CDN_URL to serve via the Spaces CDN.
              baseUrl: env('DO_SPACE_CDN_URL') || undefined,
              // Folder (key prefix) within the bucket, e.g. "nobettertime".
              rootPath: env('DO_SPACE_ROOT_PATH') || undefined,
              s3Options: {
                credentials: {
                  accessKeyId: env('DO_SPACE_ACCESS_KEY'),
                  secretAccessKey: env('DO_SPACE_SECRET_KEY'),
                },
                endpoint: env('DO_SPACE_ENDPOINT'),
                region: env('DO_SPACE_REGION'),
                params: {
                  ACL: env('DO_SPACE_ACL', 'public-read'),
                  Bucket: env('DO_SPACE_BUCKET'),
                },
              },
            },
            actionOptions: {
              upload: {},
              uploadStream: {},
              delete: {},
            },
          }
        : {}),
    },
  },

  // SMTP credentials are no longer configured here. They live in the
  // "SMTP Settings" single type (admin-managed, not .env) and are read at
  // send-time by the dealer-submission afterCreate lifecycle, which builds its
  // own nodemailer transport. See:
  //   backend/src/api/dealer-submission/content-types/dealer-submission/lifecycles.ts

  // The `mcp` plugin below is disabled because no matching plugin package is
  // installed or published on npm, which prevented Strapi from booting
  // ("Error loading the plugin mcp because mcp is not installed"). Strapi MCP
  // access is already provided by the standalone `@bschauer/strapi-mcp-server`
  // configured in the repo-root `.mcp.json` (it talks to Strapi over REST and
  // needs no in-Strapi plugin). Re-enable this block only once a real `mcp`
  // plugin package is added to backend/package.json dependencies.
  //
  // mcp: {
  //   enabled: true,
  //   config: {
  //     session: {
  //       type: 'memory',
  //     },
  //     allowedIPs: ['127.0.0.1', '::1'],
  //   },
  // },
});

export default config;
