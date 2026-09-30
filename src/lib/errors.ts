import type { ApiError } from "./types";

/**
 * A failed API call, carrying the status so callers can react to a 401
 * differently from a 422.
 *
 * The Rails app wraps every failure in one envelope — `ApplicationController`
 * renders `{ errors: [{ code, message }] }` and `JsonFailureApp` does the same
 * for 401s — so the body is always parsed the same way and a 404 reads like a
 * 422. `message` is already joined into a sentence by the server for the
 * multi-error case, so it is safe to drop straight into the UI.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: ApiError[];

  constructor(status: number, errors: ApiError[]) {
    super(errors.map((e) => e.message).join(" ") || "request failed");
    this.name = "ApiRequestError";
    this.status = status;
    this.code = errors[0]?.code ?? "unknown";
    this.errors = errors;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isNotFound() {
    return this.status === 404;
  }

  /** A rejected upload or a failed save: something the user can fix and retry. */
  get isValidation() {
    return this.status === 422;
  }
}

/** Thrown when the Rails app is unreachable — a different failure from a 4xx. */
export class ApiUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      `Could not reach the salary API at ${process.env.RAILS_API_URL ?? "http://localhost:3000"}. ` +
        "Is the Rails server running?",
    );
    this.name = "ApiUnavailableError";
    this.cause = cause;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}
