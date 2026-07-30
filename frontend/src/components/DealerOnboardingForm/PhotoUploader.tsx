"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCEPT_ATTR,
  isAllowedImage,
  isEmptyFile,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
} from "./options";

const MAX = 5;

// Up to 5 dealership photos with object-URL previews and per-thumb remove.
export function PhotoUploader({
  files,
  onChange,
}: {
  files: File[];
  onChange: (next: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [sizeError, setSizeError] = useState(false);
  const [typeError, setTypeError] = useState(false);
  const [emptyError, setEmptyError] = useState(false);

  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX - files.length;
    const all = Array.from(list);
    // Only real raster images — no SVG (XSS vector). Enforced for real by the
    // backend signature middleware, not by Strapi's own allowedTypes.
    const images = all.filter(isAllowedImage);
    // Empty files are called out separately: a 0-byte photo looks valid to the
    // browser but makes Strapi reject the whole upload, so the fix the user
    // needs ("open the file so it downloads") is nothing like a wrong format.
    const empties = all.filter(isEmptyFile);
    setEmptyError(empties.length > 0);
    setTypeError(all.length - empties.length > images.length);
    setSizeError(images.some((f) => f.size > MAX_FILE_BYTES));
    const incoming = images
      .filter((f) => f.size <= MAX_FILE_BYTES)
      .slice(0, room);
    if (incoming.length) onChange([...files, ...incoming]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <div className="mt-0.5 grid grid-cols-[repeat(auto-fill,minmax(94px,1fr))] gap-2.5">
        {files.map((f, i) => (
          <div
            key={`${f.name}-${i}`}
            className="relative aspect-square overflow-hidden rounded-[10px] border border-line"
          >
            {/* Local object-URL preview — next/image not used for transient blobs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[i]} alt={`Dealership photo ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute right-[5px] top-[5px] flex h-[22px] w-[22px] items-center justify-center rounded-full border-0 bg-green-dark/80 text-[14px] leading-none text-white hover:bg-green-dark/95"
            >
              ×
            </button>
          </div>
        ))}
        {files.length < MAX && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-sand bg-cream-deep text-center text-[12px] font-semibold text-green-dark hover:bg-sand/40"
          >
            <span className="text-[20px] leading-none">+</span>
            <span>Add photo</span>
            <span className="font-normal text-muted">
              {files.length} of {MAX}
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        onChange={(e) => addFiles(e.target.files)}
        className="absolute h-px w-px overflow-hidden opacity-0"
        tabIndex={-1}
      />
      {emptyError && (
        <p className="mt-2 text-[12.5px] font-medium text-error">
          That file is empty (0 bytes). If it&apos;s saved in OneDrive or iCloud, open it
          once so it downloads properly, then add it again.
        </p>
      )}
      {typeError && (
        <p className="mt-2 text-[12.5px] font-medium text-error">
          Only PNG, JPG or WebP images are allowed.
        </p>
      )}
      {sizeError && (
        <p className="mt-2 text-[12.5px] font-medium text-error">
          Each photo must be {MAX_FILE_MB}MB or smaller.
        </p>
      )}
    </>
  );
}
