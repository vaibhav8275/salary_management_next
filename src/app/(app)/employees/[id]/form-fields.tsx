"use client";

import { useFormStatus } from "react-dom";

/**
 * The amount input the salary forms share.
 *
 * It is a controlled input rather than a bare `name`-and-default field because
 * React 19 clears a form's fields once an action settles, and a rejected salary
 * is exactly the case where the user does not want to retype it. Holding the
 * value here leaves it in place when the action comes back with an error.
 */
export function AmountField({
  name,
  label,
  suffix,
  value,
  onChange,
}: {
  name: string;
  label: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
        {suffix ? <span className="ml-1 text-faint">({suffix})</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="decimal"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0.00"
        className="field tabular"
      />
    </div>
  );
}

export function DateField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="date"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field tabular"
      />
    </div>
  );
}

/**
 * A submit button that knows about the form's pending state.
 *
 * `useFormStatus` reads the enclosing form's state, so this only works as a
 * child of the `<form>` it submits.
 */
export function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending || disabled} className="btn btn-primary">
      {pending ? "Saving…" : label}
    </button>
  );
}
