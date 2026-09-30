import { cookies } from "next/headers";
import { ApiRequestError, ApiUnavailableError } from "./errors";
import type {
  ApiError,
  DistributionRow,
  Employee,
  EmployeeCountRow,
  EmployeeDetail,
  PaginationMeta,
  ReportRow,
  SalaryRecordAudit,
  SalaryImport,
  SalaryImportError,
  SalaryImportErrorPage,
  SalaryImportErrorSummaryRow,
  SalaryRecord,
  TrendRow,
} from "./types";

/**
 * The Rails API base URL. Kept server-side only: every call here is made from a
 * Server Component, a Server Action or a Route Handler, never from the browser.
 * That is what removes the need for CORS entirely — the browser only ever talks
 * to Next, and Next talks to Rails.
 */
const API_URL = process.env.RAILS_API_URL ?? "http://localhost:3000";

export const SESSION_COOKIE = "salary_session";

/**
 * The signed-in user's email, kept in a second cookie because the token itself
 * carries only the `sub` claim (see `lib/session.ts`).
 */
export const USER_COOKIE = "salary_user";

/**
 * The bearer token, read from the httpOnly cookie the login route set.
 *
 * The cookie is httpOnly, so this is the only place the token is ever read, and
 * no client bundle can see it. Nothing in `src/app` calls the Rails API from the
 * browser, which is also why an XSS here cannot exfiltrate the token.
 */
export async function getToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

/** Exposed for the login route, which sets the cookie on the response directly. */
export const apiBaseUrl = API_URL;

/**
 * One place where every Rails call goes through, so the bearer header, the
 * envelope parsing and the unreachable-server case are handled once.
 *
 * `noStore` is explicit: this is live HR data that must reflect the database
 * after a mutation, and a cached salary number is worse than a slow one.
 */
async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (cause) {
    throw new ApiUnavailableError(cause);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errors: ApiError[] = Array.isArray(body?.errors)
      ? body.errors
      : [ { code: "unknown", message: response.statusText || "request failed" } ];
    throw new ApiRequestError(response.status, errors);
  }

  return body as T;
}

/** Unwraps the `{ data }` envelope, keeping `meta` for paginated endpoints. */
async function requestData<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<{ data: T; meta?: PaginationMeta }> {
  return request<{ data: T; meta?: PaginationMeta }>(path, init);
}

// --- Authentication ---------------------------------------------------------

/**
 * Signs in and returns the token.
 *
 * The token is not in the body. Devise answers a successful sign-in by writing
 * the JWT into the `Authorization` *response* header (devise-jwt hooks Warden's
 * authentication callback), and the body carries only `{ data: { email } }`. So
 * this reads the header, and a 401 throws for the caller to turn into a form
 * error.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ token: string; email: string }> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ user: { email, password } }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errors: ApiError[] = Array.isArray(body?.errors)
      ? body.errors
      : [ { code: "unauthorized", message: "invalid email or password" } ];
    throw new ApiRequestError(response.status, errors);
  }

  const header = response.headers.get("authorization");
  if (!header) {
    // Devise minted a session but no token came back, so there is nothing to
    // store and the next request would be an unauthenticated 401. Failing here
    // keeps that from looking like a mysterious sign-out later.
    throw new ApiRequestError(500, [
      { code: "no_token", message: "sign-in succeeded but no token was returned" },
    ]);
  }

  return { token: header.replace(/^Bearer\s+/i, ""), email: body?.data?.email ?? email };
}

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

// --- Imports ----------------------------------------------------------------

export async function listImports(token: string): Promise<SalaryImport[]> {
  const { data } = await requestData<SalaryImport[]>("/api/v1/salary-imports", { token });
  return data;
}

export async function getImport(
  token: string,
  id: string | number,
): Promise<SalaryImport> {
  const { data } = await requestData<SalaryImport>(`/api/v1/salary-imports/${id}`, { token });
  return data;
}

/**
 * A page of the rows behind an import's `failed_records`, plus the roll-up of
 * every row for that import.
 *
 * Uses `request` rather than `requestData` because `summary` is a third key in
 * the envelope and the shared unwrapper keeps only `data` and `meta`. Widening
 * that unwrapper would have touched every other paginated call for one caller.
 */
export async function listImportErrors(
  token: string,
  id: string | number,
  page: number,
): Promise<SalaryImportErrorPage> {
  const body = await request<{
    data: SalaryImportError[];
    meta: PaginationMeta;
    summary: SalaryImportErrorSummaryRow[];
  }>(`/api/v1/salary-imports/${id}/errors?page=${page}`, { token });

  return { errors: body.data, meta: body.meta, summary: body.summary };
}

/**
 * Uploads a CSV. Multipart, because Rails reads `params[:file]` as an
 * `ActionDispatch::Http::UploadedFile` and the model validates the attachment's
 * filename extension, byte size and content type.
 */
export async function uploadImport(
  token: string,
  file: File,
): Promise<SalaryImport> {
  const form = new FormData();
  form.append("file", file);

  const { data } = await requestData<SalaryImport>("/api/v1/salary-imports", {
    method: "POST",
    token,
    body: form,
  });
  return data;
}

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
