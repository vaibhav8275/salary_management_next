"use client";

import { useActionState, useState } from "react";
import { signInAction, type LoginState } from "./actions";

/**
 * The sign-in form.
 *
 * `useActionState` is the React 19 replacement for `useFormState`, and it is
 * what lets the Server Action return a field error without the form being lost:
 * the pending state drives the spinner and the disabled button, so a slow
 * request cannot be submitted twice.
 *
 * The email is a controlled input, and that is not a style choice. React resets
 * the fields of a form with an `action` once the action settles, and it skips
 * controlled ones — so with an uncontrolled email, a wrong password clears the
 * field and the next submit is silently blocked by constraint validation with
 * the user staring at an empty box. The password is deliberately left
 * uncontrolled: it must not be pushed back into the DOM after a round trip.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signInAction,
    {},
  );
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical-soft px-3.5 py-2.5 text-sm text-critical"
        >
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="hr@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? (
          <>
            <svg
              viewBox="0 0 24 24"
              className="size-4 animate-spin"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2.25} />
              <path
                d="M20.5 12a8.5 8.5 0 0 0-8.5-8.5"
                stroke="currentColor"
                strokeWidth={2.25}
                strokeLinecap="round"
              />
            </svg>
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
