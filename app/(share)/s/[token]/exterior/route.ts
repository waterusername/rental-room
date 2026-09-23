import { readSharedExterior, shareImageResponse } from "@/lib/auth/share-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return shareImageResponse(await readSharedExterior(token));
  } catch (error) {
    console.error("Share exterior failed", error instanceof Error ? error.message : "unknown");
    return shareImageResponse(null);
  }
}
