import type { Metadata } from "next";
import { CategoryView } from "@/components/CategoryView";

export const metadata: Metadata = {
  title: "Garages",
};

export default function GaragesPage() {
  return <CategoryView category="garage" />;
}
