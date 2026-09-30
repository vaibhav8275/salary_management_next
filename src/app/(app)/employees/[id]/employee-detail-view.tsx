import Link from "next/link";
import { Pill } from "@/components/ui";
import { formatDate, initials, money, parseAmount } from "@/lib/format";
import type { EmployeeDetail, SalaryRecord, SalaryRecordAudit } from "@/lib/types";
import { SalaryActions } from "./salary-actions";
import { SalaryHistory } from "./salary-history";

export function EmployeeDetailView({
  employee,
  current,
  history,
  audit,
}: {
  employee: EmployeeDetail;
  current: SalaryRecord | null;
  history: SalaryRecord[];
  audit: SalaryRecordAudit[];
}) {
  const gross = current
    ? parseAmount(current.base_salary) + parseAmount(current.bonus) + parseAmount(current.allowance)
    : 0;

  return (
    <>
      <Link
        href="/employees"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="M11 6l-6 6 6 6" />
        </svg>
        All employees
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent"
          aria-hidden="true"
        >
          {initials(employee.name)}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {employee.name}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {employee.job_title} · {employee.department}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Pill>{employee.country}</Pill>
            <Pill tone="accent">{employee.currency.code}</Pill>
            <Pill>Hired {formatDate(employee.hire_date)}</Pill>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {current ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <SalaryTile
                label="Base salary"
                value={money(current.base_salary, current.currency.code)}
              />
              <SalaryTile label="Bonus" value={money(current.bonus, current.currency.code)} />
              <SalaryTile
                label="Allowance"
                value={money(current.allowance, current.currency.code)}
              />
              <SalaryTile
                label="Gross total"
                value={money(gross, current.currency.code)}
                accent
              />
            </div>
          ) : null}

          <SalaryHistory
            employeeId={String(employee.id)}
            history={history}
            audit={audit}
            currentId={current?.id ?? null}
          />

        </div>

        <div className="space-y-4">
          <SalaryActions employee={employee} current={current} history={history} />

          <div className="card px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Details</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Email">
                <a href={`mailto:${employee.email}`} className="text-accent hover:underline">
                  {employee.email}
                </a>
              </Row>
              <Row label="Employee ID">
                <span className="tabular text-ink-soft">{employee.id}</span>
              </Row>
              <Row label="Department">
                <span className="text-ink-soft">{employee.department}</span>
              </Row>
              <Row label="Country">
                <span className="text-ink-soft">{employee.country}</span>
              </Row>
              <Row label="Currency">
                <span className="text-ink-soft">
                  {employee.currency.name} ({employee.currency.symbol})
                </span>
              </Row>
              <Row label="Hired">
                <span className="tabular text-ink-soft">
                  {formatDate(employee.hire_date)}
                </span>
              </Row>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}

function SalaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card px-4 py-3.5 ${accent ? "ring-1 ring-accent-border" : ""}`}>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}
