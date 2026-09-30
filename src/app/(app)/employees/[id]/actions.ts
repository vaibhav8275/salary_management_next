"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSalaryRecord,
  editSalaryRecord,
  getSalaryHistory,
  getToken,
} from "@/lib/api";
import { isApiRequestError } from "@/lib/errors";

export interface SalaryActionState {
  error?: string;
  success?: string;
}

/**
 * Shared plumbing for the two salary mutations.
 *
 * Each action resolves to a state object rather than throwing, so the form can
 * re-render with the reason. A 401 is special: it means the token expired, and
 * the only useful response is to send the user back to sign in rather than
 * showing "invalid request" on a form they filled in correctly.
 */
async function run(
  employeeId: string,
  action: (token: string) => Promise<unknown>,
  success: string,
  paths: string[],
): Promise<SalaryActionState> {
  const token = await getToken();
  if (!token) redirect("/login");

  try {
    await action(token);
  } catch (error) {
    if (isApiRequestError(error) && error.isUnauthorized) redirect("/login");
    if (error instanceof Error) return { error: error.message };
    return { error: "The change could not be saved." };
  }

  // The salary figures appear on the dashboard, the employee list and this
  // page, so all three are revalidated rather than only the page that submitted.
  for (const path of paths) revalidatePath(path);

  return { success };
}

/**
 * Creates a new salary record with a future-or-current effective date.
 *
 * The API decides what that means: SalaryService creates a record, and a newer
 * effective date leaves the old one as history rather than overwriting it.
 */
export async function createSalaryAction(
  _prev: SalaryActionState,
  formData: FormData,
): Promise<SalaryActionState> {
  const employeeId = String(formData.get("employee_id") ?? "");
  const baseSalary = String(formData.get("base_salary") ?? "").trim();
  const bonus = String(formData.get("bonus") ?? "").trim();
  const allowance = String(formData.get("allowance") ?? "").trim();
  const effectiveDate = String(formData.get("effective_date") ?? "").trim();

  // Checked here as well as by the API so the form can point at the field,
  // rather than reporting a single opaque "invalid request" for the submission.
  if (!baseSalary) return { error: "Base salary is required." };
  if (!effectiveDate) return { error: "Effective date is required." };
  if (!/^\d+(\.\d+)?$/.test(baseSalary)) return { error: "Base salary must be a number." };
  for (const [label, value] of [ [ "Bonus", bonus ], [ "Allowance", allowance ] ] as const) {
    if (value && !/^\d+(\.\d+)?$/.test(value)) {
      return { error: `${label} must be a number.` };
    }
  }

  // Checked before the request because the API cannot explain it: a 422 from a
  // non-persisted record is rendered as the bare "invalid request", with the
  // model's own validation message dropped. The date is the only field here with
  // a rule the server enforces but does not report, and it is the one people hit
  // most — re-entering a date already in the history.
  const token = await getToken();
  if (!token) redirect("/login");

  try {
    const taken = (await getSalaryHistory(token, employeeId)).some(
      (record) => record.effective_date === effectiveDate,
    );
    if (taken) {
      return {
        error:
          `This employee already has a salary record effective ${effectiveDate}. ` +
          "Use Edit on that record in the history below, or choose a different date.",
      };
    }
  } catch (error) {
    // A failure to read the history is not a reason to block the save; the API's
    // own uniqueness validation still has the final say.
    if (isApiRequestError(error) && error.isUnauthorized) redirect("/login");
  }

  return run(
    employeeId,
    (token) =>
      createSalaryRecord(token, employeeId, {
        base_salary: baseSalary,
        bonus: bonus || "0",
        allowance: allowance || "0",
        effective_date: effectiveDate,
      }),
    `Salary record created, effective ${effectiveDate}.`,
    [ `/employees/${employeeId}`, "/dashboard", "/employees" ],
  );
}

/**
 * Edits the amounts on an existing record.
 *
 * Only the three amounts are sent: the effective date is fixed once a record
 * exists, so an edit changes what was paid rather than when. Empty inputs are
 * dropped server-side in `lib/api.ts`, which matters because the controller
 * treats a *present* key as an instruction to overwrite.
 */
export async function editSalaryAction(
  _prev: SalaryActionState,
  formData: FormData,
): Promise<SalaryActionState> {
  const employeeId = String(formData.get("employee_id") ?? "");
  const recordId = String(formData.get("salary_record_id") ?? "");
  const baseSalary = String(formData.get("base_salary") ?? "").trim();
  const bonus = String(formData.get("bonus") ?? "").trim();
  const allowance = String(formData.get("allowance") ?? "").trim();

  if (!/^\d+(\.\d+)?$/.test(baseSalary)) return { error: "Base salary must be a number." };
  for (const [label, value] of [ [ "Bonus", bonus ], [ "Allowance", allowance ] ] as const) {
    if (value && !/^\d+(\.\d+)?$/.test(value)) return { error: `${label} must be a number.` };
  }

  return run(
    employeeId,
    (token) =>
      editSalaryRecord(token, employeeId, Number(recordId), {
        base_salary: baseSalary,
        bonus,
        allowance,
      }),
    "Change saved. View logs shows what was changed.",
    [ `/employees/${employeeId}`, "/dashboard", "/employees" ],
  );
}
