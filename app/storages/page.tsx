import type { Metadata } from "next";
import { CategoryView } from "@/components/CategoryView";

export const metadata: Metadata = {
  title: "Storages",
};

export default function StoragesPage() {
  return <CategoryView category="storage" />;
}
