/**
 * Enforces that files posted to the PUBLIC upload route are genuinely PNG, JPEG
 * or WebP, by checking their magic bytes.
 *
 * Why this exists: Strapi's own `upload.config.security.allowedTypes` does NOT
 * do this reliably. In @strapi/upload's utils/mime-validation.mjs, every
 * content-based check is gated on the `file-type` library having detected a
 * signature. When detection returns undefined — which it does for any
 * signature-less payload such as plain text, HTML, JS, CSV or a bare
 * `<svg …>` without an XML prolog — all of those checks are skipped and
 * validation falls through to `lookup(fileExtension)`. The extension comes from
 * the filename the client chose, so the allow-list ends up validating a
 * user-controlled string. A text file (or a bare SVG) renamed `.jpg` and
 * declared `image/jpeg` was accepted with a 201 before this middleware.
 *
 * There is no config-only fix: `deniedTypes` is evaluated against the mimetype
 * Strapi already settled on, which in that scenario is a clean `image/jpeg`.
 *
 * Scoped to `POST /api/upload` only, so the admin Media Library is untouched and
 * editors can still upload whatever the plugin config allows.
 *
 * We read the bytes ourselves rather than importing `file-type`: it is an
 * ESM-only transitive dependency of @strapi/upload, and for three formats the
 * signatures are trivial.
 */

import type { Core } from '@strapi/strapi';
import { open } from 'node:fs/promises';

const UPLOAD_PATH = '/api/upload';

// Longest prefix we need is WebP's "WEBP" marker at offset 8.
const HEADER_BYTES = 12;

const startsWith = (buf: Buffer, bytes: number[], offset = 0): boolean =>
  bytes.every((b, i) => buf[offset + i] === b);

const isPng = (b: Buffer) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isJpeg = (b: Buffer) => startsWith(b, [0xff, 0xd8, 0xff]);
const isWebp = (b: Buffer) =>
  startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8);

const looksLikeImage = (b: Buffer) => isPng(b) || isJpeg(b) || isWebp(b);

type IncomingFile = { filepath?: string; originalFilename?: string; size?: number };

async function readHeader(filepath: string): Promise<Buffer> {
  const handle = await open(filepath, 'r');
  try {
    const buf = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(buf, 0, HEADER_BYTES, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

const middleware: Core.MiddlewareFactory = (_config, { strapi }) => async (ctx, next) => {
  const isUpload =
    ctx.request.method === 'POST' && ctx.request.path === UPLOAD_PATH;

  if (!isUpload) {
    return next();
  }

  const incoming = (ctx.request as { files?: { files?: unknown } }).files?.files;
  const files: IncomingFile[] = Array.isArray(incoming)
    ? (incoming as IncomingFile[])
    : incoming
      ? [incoming as IncomingFile]
      : [];

  for (const file of files) {
    // No temp path means nothing was written to disk; leave it to Strapi's own
    // "Files are empty" handling rather than inventing a different error.
    if (!file?.filepath) continue;

    let header: Buffer;
    try {
      header = await readHeader(file.filepath);
    } catch {
      // Unreadable temp file is not the uploader's fault — don't turn an
      // infrastructure problem into a validation error.
      continue;
    }

    const name = file.originalFilename ?? 'file';

    // Empty files get their own message and code: the fix the uploader needs
    // ("open it so it downloads") is nothing like re-saving a wrong format. The
    // form guards this at selection too; this is the belt-and-braces path.
    if (header.length === 0) {
      strapi.log.warn(`[upload] rejected "${name}" — file is empty (0 bytes)`);
      return ctx.badRequest(
        `"${name}" is empty (0 bytes). If it's saved in OneDrive or iCloud, open it once so it downloads properly, then try again.`,
        { code: 'upload-empty-file' }
      );
    }

    if (!looksLikeImage(header)) {
      strapi.log.warn(
        `[upload] rejected "${name}" — content is not a PNG, JPEG or WebP (${
          file.size ?? 0
        } bytes)`
      );
      return ctx.badRequest(
        `"${name}" isn't a real PNG, JPG or WebP image. Please re-save it as one of those formats and try again.`,
        { code: 'upload-not-an-image' }
      );
    }
  }

  // MUST call next() rather than returning early with the files still on disk:
  // strapi::body deletes the temp files after its own `await next()` resolves,
  // so all reading has to happen before this point.
  return next();
};

export default middleware;
