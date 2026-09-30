import { cookies } from "next/headers";
import { getImport, SESSION_COOKIE } from "@/lib/api";
import { isApiRequestError } from "@/lib/errors";
import { IN_FLIGHT_STATUSES } from "@/lib/types";

/**
 * Polls a single import for the imports page.
 *
 * A Route Handler rather than a client-side fetch: the token is in an httpOnly
 * cookie, so a browser request could not attach the bearer header without
 * exposing the token to JavaScript. This handler reads the cookie on the server
 * and forwards it, which keeps the same rule as every other call — the browser
 * never sees the token.
 *
 * `noStore` matters here: a cached status would report a finished import as
 * still running, or a fresh upload as already complete.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const record = await getImport(token, id);

    // `done` lets the client stop polling on its own rather than counting down
    // a fixed number of attempts and possibly stopping early on a slow import.
    return Response.json(
      { data: record, done: !IN_FLIGHT_STATUSES.includes(record.status) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (isApiRequestError(error) && error.isNotFound) {
      return Response.json({ error: "Import not found" }, { status: 404 });
    }
    if (isApiRequestError(error) && error.isUnauthorized) {
      return Response.json({ error: "Session expired" }, { status: 401 });
    }
    return Response.json({ error: "Could not load the import" }, { status: 502 });
  }
}
