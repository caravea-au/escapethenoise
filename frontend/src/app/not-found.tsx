export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="font-(family-name:--font-display) text-[80px] leading-none text-brand-primary">404</h1>
      <p className="mt-4 font-(family-name:--font-body) text-[20px] text-brand-ink">Page not found</p>
      <p className="mt-2 max-w-md font-(family-name:--font-body) text-[16px] text-text-muted">
        The [project-name] page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <a
        href="/"
        className="mt-8 inline-flex h-[40px] items-center justify-center rounded-[var(--radius-button)] bg-brand-primary px-[35px] font-(family-name:--font-body) font-semibold text-brand-ink transition-all hover:brightness-110"
      >
        Back to Home
      </a>
    </div>
  );
}

