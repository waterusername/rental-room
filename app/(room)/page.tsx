import type { Metadata } from "next";
import { CategoryView } from "@/components/CategoryView";

export const metadata: Metadata = {
  title: "Apartments",
  description: "Browse Grinberg apartment vacancies, rents, NYCHA flags, and Matterport tours.",
};

const CLAIMED_NOTICE =
  "That unit is marked Reserved. The office has the claim, and it is no longer on your board.";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ claimed?: string }>;
}) {
  const query = await searchParams;
  return <CategoryView category="apartment" notice={query.claimed === "1" ? CLAIMED_NOTICE : undefined} />;
}
