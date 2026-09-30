"use client";

import { useActionState, useEffect, useState } from "react";
import { EmptyState, ErrorNote, Pill } from "@/components/ui";
import { ChevronDownIcon, ClockIcon, PencilIcon } from "@/components/icons";
import { formatDate, formatDateTime, money, parseAmount } from "@/lib/format";
import type { SalaryAudit, SalaryRecord, SalaryRecordAudit } from "@/lib/types";
import { editSalaryAction, type SalaryActionState } from "./actions";
import { AmountField, SubmitButton } from "./form-fields";

/**
 * The salary history, with each record's own edit form and change log.
 *
 * Everything is per row on purpose. A single combined change list across an
 * employee's records cannot answer "what happened to *this* period?" — the
 * reader has to pick entries apart by date and amount — so each record carries
 * its own log, and its own edit, in the row it describes.
 *
 * The API sends the logs already grouped by record, so no grouping is done here.
 */
export function SalaryHistory({
  employeeId,
  history,
  audit,
  currentId,
}: {
  employeeId: string;
  history: SalaryRecord[];
  audit: SalaryRecordAudit[];
  currentId: number | null;
}) {
  const [openLogs, setOpenLogs] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Records with no group at all would render an empty panel; the API sends one
  // group per record, so this is a guard rather than the normal path.
  const versionsBy = new Map(audit.map((group) => [group.salary_record_id, group.versions]));

  return (
    <div className="card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">Salary history</h2>
        <p className="mt-0.5 text-xs text-muted">
          Most recent effective date first. Each record keeps its own change log.
        </p>
      </div>

      {history.length === 0 ? (
        <EmptyState title="No salary records yet" />
      ) : (
        <ul className="divide-y divide-line">
          {history.map((record) => {
            const total =
              parseAmount(record.base_salary) +
              parseAmount(record.bonus) +
              parseAmount(record.allowance);
            const isCurrent = currentId === record.id;
            const logsOpen = openLogs === record.id;
            const versions = versionsBy.get(record.id) ?? [];

            return (
              <li key={record.id}>
                <div
                  className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 ${
                    isCurrent ? "bg-accent-soft/40" : ""
                  }`}
                >
                  <span className="tabular w-44 shrink-0 text-ink-soft">
                    {formatDate(record.effective_date)}
                  </span>
                  {isCurrent ? <Pill tone="accent">current</Pill> : null}

                  <span className="tabular w-32 text-xs text-muted">
                    <span className="sr-only">Base </span>
                    {money(record.base_salary, record.currency.code)}
                  </span>
                  <span className="tabular w-32 text-xs text-muted">
                    <span className="sr-only">Bonus </span>
                    {money(record.bonus, record.currency.code)}
                  </span>
                  <span className="tabular w-32 text-xs text-muted">
                    <span className="sr-only">Allowance </span>
                    {money(record.allowance, record.currency.code)}
                  </span>
                  <span className="tabular w-32 text-xs font-medium">
                    <span className="sr-only">Gross </span>
                    {money(total, record.currency.code)}
                  </span>

                  <div className="ml-auto flex shrink-0 gap-1.5">
                    <RowButton
                      expanded={editingId === record.id}
                      onClick={() => setEditingId(editingId === record.id ? null : record.id)}
                      icon={<PencilIcon className="size-3.5" />}
                    >
                      Edit
                    </RowButton>
                    <RowButton
                      expanded={logsOpen}
                      onClick={() => setOpenLogs(logsOpen ? null : record.id)}
                      icon={
                        logsOpen ? (
                          <ChevronDownIcon className="size-3.5" />
                        ) : (
                          <ClockIcon className="size-3.5" />
                        )
                      }
                    >
                      View logs
                    </RowButton>
                  </div>
                </div>

                {editingId === record.id ? (
                  <div className="border-t border-line bg-surface-sunken/40 px-5 py-4">
                    <EditForm
                      employeeId={employeeId}
                      record={record}
                      onDone={() => setEditingId(null)}
                    />
                  </div>
                ) : null}

                {logsOpen ? (
                  <div className="border-t border-line bg-surface-sunken/40 px-5 py-4">
                    <ChangeLog versions={versions} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RowButton({
  children,
  icon,
  expanded,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={`btn btn-xs ${expanded ? "btn-secondary" : "btn-ghost"}`}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Edits the amounts of one record.
 *
 * The effective date is not editable: it is unique per employee and is what the
 * record is identified by throughout the history, so moving it would reorder the
 * periods rather than correct one.
 */
function EditForm({
  employeeId,
  record,
  onDone,
}: {
  employeeId: string;
  record: SalaryRecord;
  onDone: () => void;
}) {
  const [state, action] = useActionState<SalaryActionState, FormData>(
    editSalaryAction,
    {},
  );
  const [amounts, setAmounts] = useState({
    base_salary: record.base_salary,
    bonus: record.bonus,
    allowance: record.allowance,
  });

  // Collapse on success so the updated amounts are visible in the row itself.
  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="employee_id" value={employeeId} />
      <input type="hidden" name="salary_record_id" value={record.id} />

      {state.error ? <ErrorNote message={state.error} /> : null}

      <p className="text-xs text-muted">
        Editing the record effective {record.effective_date}. The effective date is
        fixed on a record — an edit changes the amounts, not the date.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <AmountField
          name="base_salary"
          label="Base salary"
          suffix={record.currency.code}
          value={amounts.base_salary}
          onChange={(value) => setAmounts((all) => ({ ...all, base_salary: value }))}
        />
        <AmountField
          name="bonus"
          label="Bonus"
          suffix={record.currency.code}
          value={amounts.bonus}
          onChange={(value) => setAmounts((all) => ({ ...all, bonus: value }))}
        />
        <AmountField
          name="allowance"
          label="Allowance"
          suffix={record.currency.code}
          value={amounts.allowance}
          onChange={(value) => setAmounts((all) => ({ ...all, allowance: value }))}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <SubmitButton label="Save change" />
        <button type="button" onClick={onDone} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * One salary record's change log.
 *
 * These are this record's versions only, which is what makes the log readable:
 * a change to the 2026 period says which period it belongs to without the
 * reader inferring it from a date column in a shared feed.
 */
function ChangeLog({ versions }: { versions: SalaryAudit[] }) {
  if (versions.length === 0) {
    return <p className="text-sm text-muted">No changes recorded for this record.</p>;
  }

  return (
    <ol className="space-y-3">
      {versions.map((version) => (
        <li key={version.id} className="border-l-2 border-line pl-3">
          <div className="flex flex-wrap items-center gap-2">
            <EventPill event={version.event} />
            <span className="text-sm text-ink">{version.changed_by}</span>
            <span className="text-xs text-muted">
              {version.source === "bulk_import"
                ? `via CSV import${version.salary_import_id ? ` #${version.salary_import_id}` : ""}`
                : "manually"}
            </span>
            <span className="tabular ml-auto text-xs text-muted">
              {formatDateTime(version.changed_at)}
            </span>
          </div>
          {describeChanges(version.changes) ? (
            <p className="mt-1 text-xs text-muted">{describeChanges(version.changes)}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function EventPill({ event }: { event: string }) {
  const tone =
    event === "create"
      ? "bg-positive-soft text-positive"
      : event === "update"
        ? "bg-accent-soft text-accent"
        : event === "destroy"
          ? "bg-critical-soft text-critical"
          : "bg-surface-sunken text-ink-soft";

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>
      {event === "create" ? "added" : event === "update" ? "changed" : event}
    </span>
  );
}

/**
 * Renders a PaperTrail changeset as "base salary 194,622 → 194,733".
 *
 * Only the three pay fields are listed. The changeset also carries `updated_at`
 * and ids, which say nothing about the change and would bury the one figure the
 * reader opened the log to check.
 */
function describeChanges(changes: Record<string, unknown> | undefined): string {
  const parts: string[] = [];

  for (const field of AMOUNT_FIELDS) {
    const pair = changes?.[field];
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const [before, after] = pair;
    // A nil before value is a create, which the event label above already says.
    if (before === null || before === undefined) continue;
    parts.push(`${field.replace(/_/g, " ")} ${formatAmount(before)} → ${formatAmount(after)}`);
  }

  return parts.join(" · ");
}

const AMOUNT_FIELDS = ["base_salary", "bonus", "allowance"] as const;

/** Decimals arrive as strings, sometimes in exponent form, so normalise them. */
function formatAmount(value: unknown): string {
  const text = String(value);

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  return text;
}
