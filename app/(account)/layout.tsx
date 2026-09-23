import { AccessHeader } from "@/components/AccessHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { requireUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  return (
    <>
      <AccessHeader email={session.email} role={session.role} section="Account" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter />
    </>
  );
}
