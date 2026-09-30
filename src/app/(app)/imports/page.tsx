import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getToken, listImports } from "@/lib/api";
import { isApiRequestError } from "@/lib/errors";
import type { SalaryImport } from "@/lib/types";
import { ImportsView } from "./imports-view";

export const metadata: Metadata = { title: "Salary imports" };

export default async function ImportsPage() {
  const token = await getToken();
  if (!token) redirect("/login");

  let initial: SalaryImport[];

  try {
    initial = await listImports(token);
  } catch (error) {
    if (isApiRequestError(error) && error.isUnauthorized) redirect("/login");
    throw error;
  }

  return <ImportsView initial={initial} />;
}
