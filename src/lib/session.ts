import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getToken, SESSION_COOKIE, USER_COOKIE } from "./api";

/**
 * The authenticated pages' one-line guard: the token is required for any
 * server-rendered shell, page or action, so this reads it and redirects when it
 * is missing. Centralizing the check — instead of every page repeating
 * `if (!token) redirect("/login")` — keeps the failure mode identical in one
 * place. The return value is the caller's token to pass to the API.
 *
 * This is still a *presence* check: the token's signature is verified by Rails
 * on the data call it gets attached to, never here.
 */
export async function requireAuth(): Promise<string> {
  const token = await getToken();
  if (!token) redirect("/login");
  return token;
}

/**
 * Whether to mark the cookies `Secure`.
 *
 * This is read from the environment rather than inferred from `NODE_ENV`, and
 * that distinction is load-bearing. A browser silently *discards* a `Secure`
 * cookie that arrives over plain `http://`, so tying the flag to production mode
 * made every sign-in appear to succeed and then bounce straight back to
 * `/login` on the next click: `proxy.ts` saw no cookie, because the browser had
 * never stored it. Development was the only place it worked, since localhost is
 * treated as a secure origin and accepts the flag over http.
 *
 * The deployment is currently http on a bare IP with TLS off, hence `false` in
 * `deploy.yml`. Flip `COOKIE_SECURE` to `"true"` in the same commit that puts a
 * certificate in front of the app &mdash; never before, or sign-in breaks again.
 */
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

/**
 * Cookie options for the JWT.
 *
 * `httpOnly` is the point of the whole design: the token is never reachable from
 * client JavaScript, so an injected script cannot read it. `sameSite: "lax"`
 * keeps it off cross-site requests, and `secure` follows `COOKIE_SECURE` so it
 * only travels over HTTPS once TLS is actually in front of the site.
 * `maxAge` matches the token's own lifetime (`expiration_time` in
 * config/initializers/devise_jwt.rb, 1800s), so the cookie and the token expire
 * together rather than the cookie outliving a token that no longer verifies.
 *
 * Keeping the two in step is deliberate. A cookie that outlives its token would
 * keep `proxy.ts` treating the holder as signed in &mdash; that check only tests for
 * presence &mdash; while every real request came back 401 from the API, which reads as
 * a broken app rather than an expired session.
 */
const THIRTY_MINUTES_SECONDS = 30 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: COOKIE_SECURE,
  path: "/",
  maxAge: THIRTY_MINUTES_SECONDS,
};

/**
 * The signed-in user, as shown in the header.
 *
 * The email is stored in its own cookie at sign-in because the token carries only
 * the `sub` (the user's id): devise-jwt issues `{ sub, scp, aud, iat, exp, jti }`
 * with no email claim, so the address would otherwise need a second lookup.
 *
 * Neither cookie is trusted for anything. `proxy.ts` only checks that a token is
 * present, and every page's data comes from a request the API authorises on its
 * own — so a tampered email shows a wrong name in the corner while all the real
 * data stays behind a genuine 401.
 */
export async function getSessionUser(): Promise<{ email: string; sub: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sub = decodeJwtPayload(token)?.sub;
  return {
    email: store.get(USER_COOKIE)?.value ?? `#${sub ?? "unknown"}`,
    sub: sub ? String(sub) : "",
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split(".")[1];
  if (!segment) return null;

  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
