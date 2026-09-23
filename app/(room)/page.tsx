import type { Metadata } from "next";
import { CategoryView } from "@/components/CategoryView";

export const metadata: Metadata = {
  title: "Apartments",
  description: "Browse Grinberg apartment vacancies, rents, NYCHA flags, and Matterport tours.",
};

export default function HomePage() {
  return <CategoryView category="apartment" />;
}
