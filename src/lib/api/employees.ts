import { requestData } from "./client";
import type { Employee, EmployeeDetail, PaginationMeta, SalaryRecord, SalaryRecordAudit } from "@/lib/types";

// --- Employees --------------------------------------------------------------

export interface EmployeeFilters {
  search?: string;
  department?: string;
  country?: string;
  jobTitle?: string;
  page?: number;
  perPage?: number;
}

export async function listEmployees(
  token: string,
  filters: EmployeeFilters = {},
): Promise<{ employees: Employee[]; meta: PaginationMeta | null }> {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.department) query.set("department", filters.department);
  if (filters.country) query.set("country", filters.country);
  if (filters.jobTitle) query.set("job_title", filters.jobTitle);
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  if (filters.perPage) query.set("per_page", String(filters.perPage));

  const suffix = query.toString() ? `?${query}` : "";
  const { data, meta } = await requestData<Employee[]>(
    `/api/v1/employees${suffix}`,
    { token },
  );
  return { employees: data, meta: meta ?? null };
}

export async function getEmployee(
  token: string,
  id: string | number,
): Promise<EmployeeDetail> {
  const { data } = await requestData<EmployeeDetail>(`/api/v1/employees/${id}`, { token });
  return data;
}

export async function getCurrentSalary(
  token: string,
  employeeId: string | number,
): Promise<SalaryRecord | null> {
  // Null is a real answer, not a failure: an employee with no salary record
  // still has a profile (the schema in swagger models `data` as a nullable
  // SalaryRecord), so this must not throw on a 200 with `data: null`.
  const { data } = await requestData<SalaryRecord | null>(
    `/api/v1/employees/${employeeId}/salary`,
    { token },
  );
  return data;
}

export async function getSalaryHistory(
  token: string,
  employeeId: string | number,
): Promise<SalaryRecord[]> {
  const { data } = await requestData<SalaryRecord[]>(
    `/api/v1/employees/${employeeId}/salary/history`,
    { token },
  );
  return data;
}

/**
 * The employee's salary changes, grouped by the record each change belongs to.
 *
 * The grouping is the server's, not something the UI re-derives: it is what lets
 * each row of the salary history carry its own change log.
 */
export async function getSalaryAudit(
  token: string,
  employeeId: string | number,
): Promise<SalaryRecordAudit[]> {
  const { data } = await requestData<SalaryRecordAudit[]>(
    `/api/v1/employees/${employeeId}/salary/audit`,
    { token },
  );
  return data;
}

export interface SalaryInput {
  base_salary: string;
  bonus?: string;
  allowance?: string;
  effective_date: string;
}

export async function createSalaryRecord(
  token: string,
  employeeId: string | number,
  input: SalaryInput,
): Promise<SalaryRecord> {
  const { data } = await requestData<SalaryRecord>(`/api/v1/employees/${employeeId}/salary`, {
    method: "POST",
    token,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    // Built through URLSearchParams rather than passing the object: Rails
    // permits these as scalar params, and an object with optional keys needs
    // dropping the absent ones so a blank bonus is not sent as the string
    // "undefined".
    body: new URLSearchParams(compactParams(input)).toString(),
  });
  return data;
}

/**
 * Edits an existing record. Only the amounts are accepted — the effective date is
 * fixed on a record, so an edit changes what was paid, not when
 * (SalaryRecordsController#update permits the three amounts only).
 */
export async function editSalaryRecord(
  token: string,
  employeeId: string | number,
  salaryRecordId: number,
  input: Omit<SalaryInput, "effective_date">,
): Promise<SalaryRecord> {
  const { data } = await requestData<SalaryRecord>(
    `/api/v1/employees/${employeeId}/salary/${salaryRecordId}`,
    {
      method: "PATCH",
      token,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(compactParams(input)).toString(),
    },
  );
  return data;
}

/**
 * Drops empty optional values so an untouched field is absent from the body
 * rather than sent as an empty string. This matters on an edit: the controller
 * reads `provided_or(salary, key, current)`, and a key that is *present*
 * overrides the stored value, so sending `bonus=""` for a field the user did not
 * mean to change would clear it.
 */
function compactParams(input: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1] !== "",
    ),
  );
}