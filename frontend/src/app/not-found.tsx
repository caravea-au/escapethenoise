import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-(family-name:--font-display) text-[80px] font-bold leading-none text-rust">
        404
      </h1>
      <p className="mt-4 text-[20px] text-ink">Page not found</p>
      <p className="mt-2 max-w-md text-[16px] text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-[44px] items-center justify-center rounded-button bg-rust px-[35px] font-semibold text-white transition-colors hover:bg-rust-dark"
      >
        Back to Home
      </Link>
    </div>
  );
}
