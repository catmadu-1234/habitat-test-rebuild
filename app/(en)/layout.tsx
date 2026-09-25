import type { Metadata } from "next";
import SiteShell from "@/components/layout/SiteShell";
import { buildMetadata } from "@/sanity/lib/build-metadata";
import "../globals.css";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("en");
}

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell locale="en">{children}</SiteShell>;
}
