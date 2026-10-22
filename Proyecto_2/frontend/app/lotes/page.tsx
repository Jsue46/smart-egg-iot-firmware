import type { Metadata } from "next";
import { LotesContent } from "@/components/lotes/lotes-content";

export const metadata: Metadata = { title: "Lotes" };

export default function LotesPage() {
  return <LotesContent />;
}
