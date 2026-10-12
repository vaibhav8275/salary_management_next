import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listImports } from "@/lib/api";
import { isApiRequestError } from "@/lib/errors";
import { requireAuth } from "@/lib/session";
import type { SalaryImport } from "@/lib/types";
import { ImportsView } from "./imports-view";

export const metadata: Metadata = { title: "Salary imports" };

export default async function ImportsPage() {
  const token = await requireAuth();

  let initial: SalaryImport[];

  try {
    initial = await listImports(token);
  } catch (error) {
    if (isApiRequestError(error) && error.isUnauthorized) redirect("/login");
    throw error;
  }

  return <ImportsView initial={initial} />;
}
