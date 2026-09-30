// Response shapes, mirroring swagger/v1/swagger.json in the Rails app.
//
// Money crosses the wire as a *string*, not a number: the API formats decimals
// with a full-precision `to_s` (e.g. "194622.0", "10107688355.0"), and parsing
// those as JS numbers would quietly lose cents on the larger values. Everything
// here keeps them as strings and formats at the edge — see `lib/format.ts`.

export interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
}

export interface Employee {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  job_title: string;
  country: string;
  hire_date: string;
}

export interface EmployeeDetail extends Employee {
  currency: Currency;
}

export interface SalaryRecord {
  id: number;
  base_salary: string;
  bonus: string;
  allowance: string;
  effective_date: string;
  currency: Currency;
}

export interface SalaryAudit {
  id: number;
  whodunnit: string;
  event: string;
  source: string;
  salary_import_id: number | null;
  salary_record_id: number;
  created_at: string;
  changed_by: string;
  changed_at: string;
  changes: Record<string, unknown>;
  changeset: Record<string, unknown>;
}

/**
 * One salary record's changes, as the API groups them.
 *
 * The API returns one of these per salary record rather than one flat list of
 * changes, because a log attached to a record has to be that record's log: a
 * combined feed cannot answer "what happened to this period?" without the reader
 * picking entries apart.
 */
export interface SalaryRecordAudit {
  salary_record_id: number;
  versions: SalaryAudit[];
}

export type ImportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed";

export interface SalaryImport {
  id: number;
  filename: string;
  status: ImportStatus;
  total_records: number;
  processed_records: number;
  failed_records: number;
  /** Uploader's email; null when the account no longer exists. */
  created_by: string | null;
  created_at: string;
}

/**
 * One rejected row. `row_number` is the line in the CSV counting the header as
 * line 1, so the first data row is 2. A whole-file failure is recorded as a
 * single synthetic row at 0, with no employee and no raw data.
 */
export interface SalaryImportError {
  id: number;
  row_number: number;
  employee_id: number | null;
  error_message: string;
  raw_data: Record<string, string>;
  created_at: string;
}

/** Failure counts per reason, most frequent first. */
export interface SalaryImportErrorSummaryRow {
  error_message: string;
  count: number;
}

/** Statuses the worker can still move out of, so a poll has somewhere to go. */
export const IN_FLIGHT_STATUSES: ImportStatus[] = ["pending", "processing"];

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

/** A page of failed rows, plus the roll-up of every row for the same import. */
export interface SalaryImportErrorPage {
  errors: SalaryImportError[];
  meta: PaginationMeta;
  summary: SalaryImportErrorSummaryRow[];
}

// Report rows. `department` and `country` are each present on the endpoint that
// groups by them and absent on the other, so both are optional.

export interface ReportRow {
  amount: string;
  currency: string;
  department?: string;
  country?: string;
}

export interface DistributionRow {
  range: string;
  count: number;
  currency: string;
}

export interface TrendRow {
  effective_date: string;
  currency: string;
  amount: string;
}

/**
 * One row of `GET /api/v1/reports/employee-counts`.
 *
 * Which grouping key is present depends on the `group_by` that was requested, so
 * all three are optional and the caller reads the one it asked for.
 */
export interface EmployeeCountRow {
  department?: string;
  country?: string;
  job_title?: string;
  count: number;
}

export interface SignedInUser {
  email: string;
}

// The single error envelope every failure uses (ApplicationController,
// JsonFailureApp): 401, 404, 422 and bad `group_by` all arrive in this shape.

export interface ApiError {
  code: string;
  message: string;
}
