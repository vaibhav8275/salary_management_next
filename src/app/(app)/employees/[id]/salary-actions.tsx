"use client";

import { useActionState, useEffect, useState } from "react";
import { createSalaryAction, type SalaryActionState } from "./actions";
import type { EmployeeDetail, SalaryRecord } from "@/lib/types";
import { ErrorNote } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { AmountField, DateField, SubmitButton } from "./form-fields";

/**
 * The one salary mutation that is not a per-row edit: adding a record.
 *
 * It posts to a Server Action: the page is server-rendered and the token lives in
 * an httpOnly cookie, so a client-side `fetch` could not authenticate without the
 * cookie being readable. `useActionState` carries the result back, and the
 * revalidation in the action refreshes the history list and its change logs
 * without a manual refresh.
 */
export function SalaryActions({
  employee,
  current,
  history,
}: {
  employee: EmployeeDetail;
  current: SalaryRecord | null;
  history: SalaryRecord[];
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">Actions</h2>
        <button
          type="button"
          onClick={() => setCreating((open) => !open)}
          aria-expanded={creating}
          className="btn btn-primary"
        >
          <PlusIcon className="size-4" />
          Add salary
        </button>
      </div>

      <div className="px-5 py-4">
        {creating ? (
          <CreateForm
            employeeId={String(employee.id)}
            currency={current?.currency.code}
            takenDates={history.map((record) => record.effective_date)}
            onDone={() => setCreating(false)}
          />
        ) : (
          <p className="text-sm text-muted">
            {current
              ? "A new salary record with a later effective date is added alongside the current one; the previous record stays in the history. To change an existing record, use Edit on its row in the history."
              : "This employee has no salary record yet. Add one to start tracking pay."}
          </p>
        )}
      </div>
    </div>
  );
}

interface Amounts {
  base_salary: string;
  bonus: string;
  allowance: string;
  effective_date: string;
}

/**
 * React 19 resets the fields of a form with an `action` once that action
 * settles, and it leaves controlled inputs alone. Since a rejected salary is
 * exactly the case where the user does not want to retype it, these forms keep
 * the amounts in state and hand them back to the inputs as `value`.
 */
function CreateForm({
  employeeId,
  currency,
  takenDates,
  onDone,
}: {
  employeeId: string;
  currency?: string;
  takenDates: string[];
  onDone: () => void;
}) {
  const [state, action] = useActionState<SalaryActionState, FormData>(
    createSalaryAction,
    {},
  );
  const [amounts, setAmounts] = useState<Amounts>({
    base_salary: "",
    bonus: "0",
    allowance: "0",
    effective_date: today(),
  });

  // Collapse the form once the change lands, so the user can see the updated
  // history table it just refreshed.
  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  // `effective_date` is unique per employee (SalaryRecord validates
  // `uniqueness: { scope: :employee_id }`), so a second record on a date already
  // in the history is rejected by the API. The date picker is told which days
  // are unavailable: without that, the only feedback is a 422 whose message is
  // the API's generic "invalid request", which says nothing about which field
  // was the problem.
  const conflict = takenDates.includes(amounts.effective_date);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="employee_id" value={employeeId} />

      {state.error ? <ErrorNote message={state.error} /> : null}
      {conflict && !state.error ? (
        <ErrorNote message="This employee already has a salary record effective that date. Choose another date, or use Edit on that record in the history to change it." />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <AmountField
          name="base_salary"
          label="Base salary"
          suffix={currency}
          value={amounts.base_salary}
          onChange={(value) => setAmounts((all) => ({ ...all, base_salary: value }))}
        />
        <DateField
          name="effective_date"
          label="Effective date"
          value={amounts.effective_date}
          onChange={(value) => setAmounts((all) => ({ ...all, effective_date: value }))}
        />
        <AmountField
          name="bonus"
          label="Bonus"
          suffix={currency}
          value={amounts.bonus}
          onChange={(value) => setAmounts((all) => ({ ...all, bonus: value }))}
        />
        <AmountField
          name="allowance"
          label="Allowance"
          suffix={currency}
          value={amounts.allowance}
          onChange={(value) => setAmounts((all) => ({ ...all, allowance: value }))}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <SubmitButton label="Create record" disabled={conflict} />
        <button type="button" onClick={onDone} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
