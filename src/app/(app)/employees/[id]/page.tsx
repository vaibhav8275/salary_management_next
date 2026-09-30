import { notFound, redirect } from "next/navigation";
import {
  getCurrentSalary,
  getEmployee,
  getSalaryAudit,
  getSalaryHistory,
  getToken,
} from "@/lib/api";
import { isApiRequestError } from "@/lib/errors";
import type { EmployeeDetail, SalaryRecordAudit, SalaryRecord } from "@/lib/types";
import { EmployeeDetailView } from "./employee-detail-view";

/**
 * `params` is a Promise in Next.js 16 — the synchronous form was removed, not
 * deprecated. `PageProps<'/employees/[id]'>` is the generated helper that types
 * the resolved keys, and it is globally available after typegen.
 */
export default async function EmployeePage(props: PageProps<"/employees/[id]">) {
  const { id } = await props.params;

  const token = await getToken();
  if (!token) redirect("/login");

  // The data is fetched outside the JSX: React renders the returned element
  // after this function has already returned, so a try/catch wrapped around the
  // JSX would not actually catch render-time errors anyway. The four reads are
  // independent, so they go out together rather than as a waterfall.
  let employee: EmployeeDetail;
  let current: SalaryRecord | null;
  let history: SalaryRecord[];
  let audit: SalaryRecordAudit[];

  try {
    [ employee, current, history, audit ] = await Promise.all([
      getEmployee(token, id),
      getCurrentSalary(token, id),
      getSalaryHistory(token, id),
      getSalaryAudit(token, id),
    ]);
  } catch (error) {
    // A missing employee is a 404, which the not-found page renders — not a
    // thrown error. A 401 means the token expired mid-visit.
    if (isApiRequestError(error) && error.isNotFound) notFound();
    if (isApiRequestError(error) && error.isUnauthorized) redirect("/login");
    throw error;
  }

  return <EmployeeDetailView employee={employee} current={current} history={history} audit={audit} />;
}
