import type { Metadata } from "next";
import { CategoryView } from "@/components/CategoryView";

export const metadata: Metadata = {
  title: "Commercial",
};

export default function CommercialPage() {
  return <CategoryView category="commercial" />;
}
