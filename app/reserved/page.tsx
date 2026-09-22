import type { Metadata } from "next";
import { CategoryView } from "@/components/CategoryView";

export const metadata: Metadata = {
  title: "Reserved",
};

export default function ReservedPage() {
  return <CategoryView category="reserved" />;
}
