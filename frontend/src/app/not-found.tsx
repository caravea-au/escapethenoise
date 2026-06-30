import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-oswald text-[80px] font-bold leading-none text-rust">404</h1>
      <p className="mt-4 font-oswald text-[20px] uppercase tracking-[1px] text-green">Page not found</p>
      <p className="mt-2 max-w-md text-[16px] text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button href="/" className="mt-8">
        Back to Home
      </Button>
    </div>
  );
}
