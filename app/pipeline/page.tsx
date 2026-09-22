import type { Metadata } from "next";
import { CategoryView } from "@/components/CategoryView";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default function PipelinePage() {
  return <CategoryView category="pipeline" />;
}
