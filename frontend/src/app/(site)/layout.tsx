import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";

// The standard site shell (global green header + footer). Lives in the (site)
// route group so focused routes — e.g. /dealer-directory-onboarding — can opt
// out of the chrome by sitting outside this group.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
