import { requestData } from "./client";
import type { DistributionRow, EmployeeCountRow, ReportRow, TrendRow } from "@/lib/types";

// --- Reports ----------------------------------------------------------------

/** Every report endpoint takes the same optional department/country/date filter. */
export interface ReportFilters {
  department?: string;
  country?: string;
  from?: string;
  to?: string;
}

function reportQuery(filters: ReportFilters = {}): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.department) query.set("department", filters.department);
  if (filters.country) query.set("country", filters.country);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  return query;
}

/**
 * Reports are behind the same authentication as everything else
 * (ApplicationController before_action :authenticate_request!), so the token
 * has to be threaded through here too. The helpers below take it as their first
 * argument for exactly that reason — a report that silently dropped the bearer
 * header would come back 401 rather than as data.
 */
async function report<T>(
  token: string,
  endpoint: string,
  filters?: ReportFilters,
): Promise<T[]> {
  const query = reportQuery(filters);
  const suffix = query.toString();
  const { data } = await requestData<T[]>(
    `/api/v1/reports/${endpoint}${suffix ? `?${suffix}` : ""}`,
    { token },
  );
  return data;
}

export const averageSalaryByDepartment = (token: string, filters?: ReportFilters) =>
  report<ReportRow>(token, "average-salary-by-department", filters);

export const totalPayrollByCountry = (token: string, filters?: ReportFilters) =>
  report<ReportRow>(token, "total-payroll-by-country", filters);

export const salaryDistribution = (token: string, filters?: ReportFilters) =>
  report<DistributionRow>(token, "salary-distribution", filters);

export const salaryTrends = (token: string, filters?: ReportFilters) =>
  report<TrendRow>(token, "salary-trends", filters);

/**
 * `group_by` is required and the API 422s on anything else
 * (ReportsController::GROUPINGS), so the two callers are named rather than
 * taking a loose string.
 */
async function employeeCounts(
  token: string,
  groupBy: "department" | "country" | "job_title",
  filters?: ReportFilters,
): Promise<EmployeeCountRow[]> {
  const query = reportQuery(filters);
  query.set("group_by", groupBy);
  const { data } = await requestData<EmployeeCountRow[]>(
    `/api/v1/reports/employee-counts?${query}`,
    { token },
  );
  return data;
}

export const employeeCountByDepartment = (token: string, filters?: ReportFilters) =>
  employeeCounts(token, "department", filters);

export const employeeCountByCountry = (token: string, filters?: ReportFilters) =>
  employeeCounts(token, "country", filters);

export const employeeCountByJobTitle = (token: string, filters?: ReportFilters) =>
  employeeCounts(token, "job_title", filters);