import { cookies } from "next/headers";
import { SESSION_COOKIE, USER_COOKIE } from "./api";

/**
 * Cookie options for the JWT.
 *
 * `httpOnly` is the point of the whole design: the token is never reachable from
 * client JavaScript, so an injected script cannot read it. `sameSite: "lax"`
 * keeps it off cross-site requests, and `secure` is set outside development so
 * it only ever travels over HTTPS in a deployment. `maxAge` matches the token's
 * own lifetime (`expiration_time` in config/initializers/devise_jwt.rb, 1800s),
 * so the cookie and the token expire together rather than the cookie outliving a
 * token that no longer verifies.
 *
 * Keeping the two in step is deliberate. A cookie that outlives its token would
 * keep `proxy.ts` treating the holder as signed in — that check only tests for
 * presence — while every real request came back 401 from the API, which reads as
 * a broken app rather than an expired session.
 */
const THIRTY_MINUTES_SECONDS = 30 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
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
