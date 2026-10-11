import { cookies } from "next/headers";
import { ApiRequestError } from "@/lib/errors";
import type { ApiError } from "@/lib/types";
import { apiBaseUrl } from "./client";

// --- Authentication ---------------------------------------------------------

export const SESSION_COOKIE = "salary_session";

/**
 * The signed-in user's email, kept in a second cookie because the token itself
 * carries only the `sub` claim (see `lib/session.ts`).
 */
export const USER_COOKIE = "salary_user";

/**
 * The bearer token, read from the httpOnly cookie the login route set.
 *
 * The cookie is httpOnly, so this is the only place the token is ever read, and
 * no client bundle can see it. Nothing in `src/app` calls the Rails API from the
 * browser, which is also why an XSS here cannot exfiltrate the token.
 */
export async function getToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

/**
 * Signs in and returns the token.
 *
 * The token is not in the body. Devise answers a successful sign-in by writing
 * the JWT into the `Authorization` *response* header (devise-jwt hooks Warden's
 * authentication callback), and the body carries only `{ data: { email } }`. So
 * this reads the header, and a 401 throws for the caller to turn into a form
 * error.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ token: string; email: string }> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ user: { email, password } }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errors: ApiError[] = Array.isArray(body?.errors)
      ? body.errors
      : [ { code: "unauthorized", message: "invalid email or password" } ];
    throw new ApiRequestError(response.status, errors);
  }

  const header = response.headers.get("authorization");
  if (!header) {
    // Devise minted a session but no token came back, so there is nothing to
    // store and the next request would be an unauthenticated 401. Failing here
    // keeps that from looking like a mysterious sign-out later.
    throw new ApiRequestError(500, [
      { code: "no_token", message: "sign-in succeeded but no token was returned" },
    ]);
  }

  return { token: header.replace(/^Bearer\s+/i, ""), email: body?.data?.email ?? email };
}