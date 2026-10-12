import type { Metadata } from "next";
import { loadDashboard } from "@/components/dashboard-data";
import { requireAuth } from "@/lib/session";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const token = await requireAuth();

  // The five reports are independent, so they are fetched together rather than
  // in sequence — this is the one page where the wall-clock cost of waterfalling
  // five round trips would be visible.
  const data = await loadDashboard(token);

  return <DashboardView {...data} />;
}
