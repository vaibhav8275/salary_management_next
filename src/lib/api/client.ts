import { ApiRequestError, ApiUnavailableError } from "@/lib/errors";
import type { ApiError, PaginationMeta } from "@/lib/types";

/**
 * The Rails API base URL. Kept server-side only: every call here is made from a
 * Server Component, a Server Action or a Route Handler, never from the browser.
 * That is what removes the need for CORS entirely — the browser only ever talks
 * to Next, and Next talks to Rails.
 */
const API_URL = process.env.RAILS_API_URL ?? "http://localhost:3000";

/**
 * Exposed for the rare callers that must talk to Rails outside request(): the
 * auth module (login reads the Authorization response header) and the CSV route
 * handler (which proxies a binary stream). Request/response envelope callers use
 * request()/requestData() instead.
 */
export const apiBaseUrl = API_URL;

/**
 * One place where every Rails call goes through, so the bearer header, the
 * envelope parsing and the unreachable-server case are handled once.
 *
 * `noStore` is explicit: this is live HR data that must reflect the database
 * after a mutation, and a cached salary number is worse than a slow one.
 */
export async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (cause) {
    throw new ApiUnavailableError(cause);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errors: ApiError[] = Array.isArray(body?.errors)
      ? body.errors
      : [ { code: "unknown", message: response.statusText || "request failed" } ];
    throw new ApiRequestError(response.status, errors);
  }

  return body as T;
}

/** Unwraps the `{ data }` envelope, keeping `meta` for paginated endpoints. */
export async function requestData<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<{ data: T; meta?: PaginationMeta }> {
  return request<{ data: T; meta?: PaginationMeta }>(path, init);
}