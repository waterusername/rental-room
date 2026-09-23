import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { requireBrowse } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  const session = await requireBrowse();

  return (
    <>
      <a
        href="#inventory"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2"
      >
        Skip to listings
      </a>
      <SiteHeader viewer={{ email: session.email, name: session.name, role: session.role }} />
      <main id="inventory" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
