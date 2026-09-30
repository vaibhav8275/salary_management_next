"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { login, SESSION_COOKIE, USER_COOKIE } from "@/lib/api";
import { isApiRequestError } from "@/lib/errors";
import { sessionCookieOptions } from "@/lib/session";

export interface LoginState {
  error?: string;
}

/**
 * Signs in and stores the token.
 *
 * This runs on the server precisely because the token arrives in a response
 * *header*: a browser-side `fetch` could not read it cross-origin without Rails
 * sending `Access-Control-Expose-Headers`, and wiring CORS open enough to solve
 * that would be a worse trade than proxying the sign-in. Server-side also means
 * the token goes straight into an httpOnly cookie and never touches a client
 * bundle at all.
 *
 * Invalid credentials resolve to a state object rather than throwing, so the
 * form can re-render with the message. A missing field is checked here because
 * the API would answer a blank email with the same opaque 401 as a wrong one,
 * and "enter your email" is more useful than "authentication required".
 */
export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) return { error: "Enter your email address." };
  if (!password) return { error: "Enter your password." };

  try {
    const { token, email: signedInEmail } = await login(email, password);

    const store = await cookies();
    store.set(SESSION_COOKIE, token, sessionCookieOptions);
    store.set(USER_COOKIE, signedInEmail, sessionCookieOptions);
  } catch (error) {
    if (isApiRequestError(error) && error.isUnauthorized) {
      return { error: "That email and password do not match an account." };
    }
    if (error instanceof Error) return { error: error.message };
    return { error: "Could not sign in. Please try again." };
  }

  // Only past a successful sign-in, so a failure leaves the form up.
  redirect("/dashboard");
}

/**
 * Signs out by discarding the cookie.
 *
 * There is no server-side revocation to call: the API declares no logout route
 * and the revocation strategy is `Null` (LLD §10.4), so the token stays valid
 * until it expires. Clearing the cookie is what actually ends the session here.
 */
export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(USER_COOKIE);
  redirect("/login");
}
