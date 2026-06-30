"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX - files.length;
    const incoming = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
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
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(e) => addFiles(e.target.files)}
        className="absolute h-px w-px overflow-hidden opacity-0"
        tabIndex={-1}
      />
    </>
  );
}
