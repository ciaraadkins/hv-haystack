import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminCatalog from "@/components/AdminCatalog";
import { inAws } from "@/lib/runtime";

// Local-only page for managing the Lummi catalog. It doesn't exist on the live site.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catalog admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  if (inAws()) notFound();
  return <AdminCatalog />;
}
