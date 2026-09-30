import Link from "next/link";
import { Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui";
import { AlertIcon, ArrowLeftIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import type { SalaryImport, SalaryImportError, SalaryImportErrorPage } from "@/lib/types";

/**
 * `row_number` 0 is the synthetic row the worker writes when a whole file fails
 * before any row can be attributed to it — rejected headers, or an upload that
 * cannot be read back. It is not a line in the CSV, so it is pulled out of the
 * table and shown as a banner instead.
 */
const FILE_LEVEL_ROW = 0;

export function ImportDetailView({
  salaryImport,
  failures,
}: {
  salaryImport: SalaryImport;
  failures: SalaryImportErrorPage;
}) {
  const { errors, meta, summary } = failures;
  const fileFailure = errors.find((error) => error.row_number === FILE_LEVEL_ROW);
  const rowFailures = errors.filter((error) => error.row_number !== FILE_LEVEL_ROW);
  const currentPage = meta.current_page;
  const totalPages = meta.total_pages;

  return (
    <>
      <Link
        href="/imports"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"
      >
        <ArrowLeftIcon className="size-3.5" />
        All imports
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-ink">{salaryImport.filename}</h1>
          <p className="mt-1 text-sm text-muted">
            Uploaded {formatDateTime(salaryImport.created_at)}
            {salaryImport.created_by ? ` by ${salaryImport.created_by}` : ""}
          </p>
        </div>
        <StatusBadge status={salaryImport.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total records" value={salaryImport.total_records} />
        <Stat label="Processed" value={salaryImport.processed_records} tone="positive" />
        <Stat
          label="Failed"
          value={salaryImport.failed_records}
          tone={salaryImport.failed_records > 0 ? "critical" : undefined}
        />
        <Stat label="Uploaded by" text={salaryImport.created_by ?? "Unknown"} />
      </div>

      {/*
        A whole-file failure means not one row was ever read, so a table of failed
        rows would be misleading. The reason is stated on its own instead.
      */}
      {fileFailure ? (
        <Card className="border-critical/30">
          <div className="flex items-start gap-3 px-5 py-4">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-critical-soft text-critical">
              <AlertIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-ink">This file could not be processed</h2>
              <p className="mt-1 text-sm text-ink">{fileFailure.error_message}</p>
              <p className="mt-1.5 text-xs text-muted">
                No rows were read, so none were applied.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/*
        Counts per reason, so the shape of a failure is visible before scrolling a
        long table of rows. Rendered from every row for this import, not just the
        page on screen.
      */}
      {summary.length > 0 ? (
        <Card>
          <CardHeader title="Why it failed" description="Rows grouped by reason" />
          <ul className="divide-y divide-line">
            {summary.map((row) => (
              <li key={row.error_message} className="flex items-baseline justify-between gap-4 px-5 py-2.5">
                <span className="text-sm text-ink-soft">{row.error_message}</span>
                <span className="tabular shrink-0 text-sm font-medium text-ink">
                  {row.count.toLocaleString("en-US")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Failed rows"
          description={
            meta.total_count > 0
              ? `${meta.total_count.toLocaleString("en-US")} rejected row${meta.total_count === 1 ? "" : "s"}`
              : undefined
          }
        />

        {rowFailures.length === 0 ? (
          <EmptyState
            icon={
              fileFailure ? (
                <AlertIcon className="size-5" />
              ) : (
                <CheckIcon className="size-5" />
              )
            }
            title={fileFailure ? "No rows were read" : "No rows were rejected"}
            description={
              fileFailure
                ? "The file failed before any row could be validated — see the reason above."
                : "Every row in this file was applied successfully."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <Th className="pl-5">Row</Th>
                    <Th>Employee</Th>
                    <Th>Reason</Th>
                    <Th className="pr-5">File contents</Th>
                  </tr>
                </thead>
                <tbody>
                  {rowFailures.map((error) => (
                    <tr key={error.id} className="border-b border-line last:border-0">
                      <td className="tabular px-5 py-3 text-ink-soft">{error.row_number}</td>
                      <td className="px-5 py-3">
                        {error.employee_id === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <Link
                            href={`/employees/${error.employee_id}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {error.employee_id}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{error.error_message}</td>
                      <td className="pr-5 py-3">
                        <RawData data={error.raw_data} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
                <p className="tabular text-xs text-muted">
                  Page {currentPage.toLocaleString("en-US")} of{" "}
                  {totalPages.toLocaleString("en-US")}
                </p>
                <Pager currentPage={currentPage} totalPages={totalPages} />
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}

/**
 * The row as it arrived, rather than a re-rendering of it.
 *
 * Kept as the original key/value pairs instead of a one-line string because the
 * point of this column is to show what the file actually contained — including
 * values that are blank or malformed, which a formatted summary would hide.
 */
function RawData({ data }: { data: SalaryImportError["raw_data"] }) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return <span className="text-muted">—</span>;
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="truncate text-muted">{key}</dt>
          <dd
            className={`font-mono ${value === "" ? "text-faint italic" : "text-ink-soft"}`}
          >
            {value === "" ? "(blank)" : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Stat({
  label,
  value,
  text,
  tone,
}: {
  label: string;
  value?: number;
  text?: string;
  tone?: "positive" | "critical";
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      {text !== undefined ? (
        <p className="mt-1.5 truncate text-lg font-semibold text-ink">{text}</p>
      ) : (
        <p
          className={`tabular mt-1.5 text-lg font-semibold ${
            tone === "critical" ? "text-critical" : tone === "positive" ? "text-positive" : "text-ink"
          }`}
        >
          {(value ?? 0).toLocaleString("en-US")}
        </p>
      )}
    </Card>
  );
}

/**
 * Page links as query strings rather than client state, matching the employee
 * list: the URL is the pagination and the server component re-renders.
 */
function Pager({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const pages = [ 1, totalPages ];
  for (let candidate = currentPage - 1; candidate <= currentPage + 1; candidate += 1) {
    if (candidate > 1 && candidate < totalPages) pages.push(candidate);
  }
  const ordered = [ ...new Set(pages) ].sort((a, b) => a - b);

  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <PageLink page={currentPage - 1} disabled={currentPage <= 1} label="Previous">
        <ChevronLeftIcon className="size-4" />
      </PageLink>

      {ordered.map((page, index) => (
        <span key={page} className="flex items-center gap-1">
          {index > 0 && ordered[index - 1] !== page - 1 ? (
            <span className="px-1 text-xs text-faint">…</span>
          ) : null}
          {page === currentPage ? (
            <span
              className="tabular flex size-8 items-center justify-center rounded-md bg-accent text-xs font-medium text-white"
              aria-current="page"
            >
              {page.toLocaleString("en-US")}
            </span>
          ) : (
            <PageLink page={page} label={`Page ${page}`}>
              <span className="tabular text-xs">{page.toLocaleString("en-US")}</span>
            </PageLink>
          )}
        </span>
      ))}

      <PageLink page={currentPage + 1} disabled={currentPage >= totalPages} label="Next">
        <ChevronRightIcon className="size-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  page,
  disabled,
  label,
  children,
}: {
  page: number;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex size-8 cursor-not-allowed items-center justify-center rounded-md text-faint opacity-50"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={`?page=${page}`}
      scroll={false}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-surface-sunken"
    >
      {children}
    </Link>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-5 py-2.5 text-xs font-medium tracking-wide text-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
