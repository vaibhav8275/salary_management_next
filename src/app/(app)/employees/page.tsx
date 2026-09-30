import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getToken,
  listEmployees,
  employeeCountByDepartment,
  employeeCountByCountry,
  employeeCountByJobTitle,
} from "@/lib/api";
import { isApiRequestError } from "@/lib/errors";
import type { EmployeeCountRow } from "@/lib/types";
import { EmployeeTable } from "./employee-table";

export const metadata: Metadata = { title: "Employees" };

/**
 * Next.js 16: `searchParams` is a Promise and must be awaited — the synchronous
 * form that worked in 15 is removed, not merely deprecated.
 */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = await getToken();
  if (!token) redirect("/login");

  const params = await searchParams;
  const filters = normalizeFilters(params);

  // The headcounts also supply the filter dropdown options, so the page can
  // never offer a department that has no employees behind it. The fetch stays
  // outside the returned JSX: React renders the element after this function has
  // returned, so a try/catch around the JSX would not catch anything anyway.
  let result: Awaited<ReturnType<typeof listEmployees>>;
  let departments: EmployeeCountRow[];
  let countries: EmployeeCountRow[];
  let jobTitles: EmployeeCountRow[];

  try {
    [ result, departments, countries, jobTitles ] = await Promise.all([
      listEmployees(token, filters),
      employeeCountByDepartment(token),
      employeeCountByCountry(token),
      employeeCountByJobTitle(token),
    ]);
  } catch (error) {
    // A 401 here means the token expired between the shell's check and this
    // fetch, which is a sign-in prompt rather than an error page.
    if (isApiRequestError(error) && error.isUnauthorized) redirect("/login");
    throw error;
  }

  return (
    <EmployeeTable
      employees={result.employees}
      meta={result.meta}
      // Only the filters that are set, so the pager preserves exactly what is
      // applied rather than echoing empty keys into every page link.
      query={buildQuery(params)}
      departments={departments
        .filter((row) => row.department)
        .map((row) => row.department!)
        .sort()}
      countries={countries
        .filter((row) => row.country)
        .map((row) => row.country!)
        .sort()}
      jobTitles={jobTitles
        .filter((row) => row.job_title)
        .map((row) => row.job_title!)
        .sort()}
    />
  );
}

/** The active filter keys, as a query string, for pagination links. */
function buildQuery(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const key of [ "search", "department", "country", "job_title" ]) {
    const value = (Array.isArray(params[key]) ? params[key][0] : params[key])?.trim();
    if (value) query.set(key, value);
  }
  return query.toString();
}

function normalizeFilters(params: Record<string, string | string[] | undefined>) {
  const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

  const page = Number(one(params.page) ?? "1");

  return {
    search: one(params.search),
    department: one(params.department),
    country: one(params.country),
    jobTitle: one(params.job_title),
    // Guard the floor: a hand-edited `?page=0` or `?page=abc` must not reach
    // the API as NaN, and page 0 is not a page.
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    perPage: 25,
  };
}
