import { readSharedFloorPlan, shareImageResponse } from "@/lib/auth/share-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; index: string }> }) {
  const { token, index } = await params;
  if (!/^\d{1,2}$/.test(index)) return shareImageResponse(null);
  try {
    return shareImageResponse(await readSharedFloorPlan(token, Number(index)));
  } catch (error) {
    console.error("Share floor plan failed", error instanceof Error ? error.message : "unknown");
    return shareImageResponse(null);
  }
}
