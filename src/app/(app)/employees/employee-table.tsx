import Link from "next/link";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "@/components/icons";
import { formatDate, initials } from "@/lib/format";
import type { Employee, PaginationMeta } from "@/lib/types";
import { EmployeeFilterForm } from "./filters";

export function EmployeeTable({
  employees,
  meta,
  departments,
  countries,
  jobTitles,
  query,
}: {
  employees: Employee[];
  meta: PaginationMeta | null;
  departments: string[];
  countries: string[];
  jobTitles: string[];
  /** The active filters, as a query string, so paging can preserve them. */
  query: string;
}) {
  const currentPage = meta?.current_page ?? 1;
  const totalPages = meta?.total_pages ?? 1;
  const total = meta?.total_count ?? 0;

  return (
    <>
      <PageHeader
        title="Employees"
        description={
          total > 0
            ? `${total.toLocaleString("en-US")} employee${total === 1 ? "" : "s"}`
            : "Browse and manage salary records"
        }
      />

      <EmployeeFilterForm
        departments={departments}
        countries={countries}
        jobTitles={jobTitles}
      />

      <Card>
        {employees.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="size-5" />}
            title="No employees match these filters"
            description="Try clearing the search box or widening the department and country filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th className="pl-5">Employee</Th>
                  <Th>Department</Th>
                  <Th>Country</Th>
                  <Th>Job title</Th>
                  <Th>Hired</Th>
                  <Th className="pr-5 text-right">Salary</Th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="border-b border-line last:border-0 hover:bg-surface-sunken"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/employees/${employee.id}`}
                        className="group flex items-center gap-3"
                      >
                        <Avatar name={employee.name} />
                        <span className="min-w-0">
                          {/* The whole row is a link target, but the anchor
                              covers just the name so the row's own hit area
                              does not swallow text selection. */}
                          <span className="block truncate font-medium text-ink group-hover:text-accent">
                            {employee.name}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {employee.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Pill>{employee.department}</Pill>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{employee.country}</td>
                    <td className="px-5 py-3 text-ink-soft">{employee.job_title}</td>
                    <td className="tabular px-5 py-3 text-ink-soft">
                      {formatDate(employee.hire_date)}
                    </td>
                    <td className="pr-5 text-right">
                      <Link
                        href={`/employees/${employee.id}`}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        View salary
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="tabular text-xs text-muted">
              Page {currentPage.toLocaleString("en-US")} of{" "}
              {totalPages.toLocaleString("en-US")}
            </p>
            <Pager currentPage={currentPage} totalPages={totalPages} query={query} />
          </div>
        ) : null}
      </Card>
    </>
  );
}

/**
 * Page links built as query strings rather than through a client component.
 *
 * `page` is a plain search param, so the server component re-renders with the
 * new list on navigation — no client state, and the URL is the pagination.
 */
function Pager({
  currentPage,
  totalPages,
  query,
}: {
  currentPage: number;
  totalPages: number;
  query: string;
}) {
  // A short window around the current page: first, last, and either side of
  // where you are, so the control stays a fixed width on a 5,000-page result.
  const pages = [ 1, totalPages ];
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) pages.push(page);
  }
  const ordered = [ ...new Set(pages) ].sort((a, b) => a - b);

  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <PageLink page={currentPage - 1} query={query} disabled={currentPage <= 1} label="Previous">
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
            <PageLink page={page} query={query} label={`Page ${page}`}>
              <span className="tabular text-xs">
                {page.toLocaleString("en-US")}
              </span>
            </PageLink>
          )}
        </span>
      ))}

      <PageLink
        page={currentPage + 1}
        query={query}
        disabled={currentPage >= totalPages}
        label="Next"
      >
        <ChevronRightIcon className="size-4" />
      </PageLink>
    </nav>
  );
}

/** A relative `Link` is not enough here: the page is held in the query string. */
function PageLink({
  page,
  query,
  disabled,
  label,
  children,
}: {
  page: number;
  query: string;
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
      href={pageQuery(page, query)}
      scroll={false}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-surface-sunken"
    >
      {children}
    </Link>
  );
}

/**
 * Preserves the active filters when paging — dropping them would jump from
 * "Engineering, page 7" back to an unfiltered page 7.
 */
function pageQuery(page: number, query: string): string {
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  return `?${params}`;
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-2.5 text-xs font-medium tracking-wide text-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
