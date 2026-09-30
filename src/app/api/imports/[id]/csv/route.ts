import { cookies } from "next/headers";
import { apiBaseUrl, SESSION_COOKIE } from "@/lib/api";

/**
 * Streams an import's CSV back to the browser.
 *
 * A Route Handler rather than a client-side fetch, for the same reason as
 * `../route.ts`: the token is in an httpOnly cookie, so the browser cannot attach
 * the bearer header without the token becoming readable by JavaScript. This
 * handler reads the cookie server-side and forwards it.
 *
 * The body is passed through as a stream rather than read into a buffer, so the
 * bytes are relayed as they arrive instead of being held in memory on both sides.
 *
 * `Content-Disposition` is forwarded from Rails, which built it from the name the
 * file was uploaded with. That is what gives the browser the download filename —
 * an empty `download` attribute would otherwise make it fall back to the last
 * path segment, which is `csv`.
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

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl}/api/v1/salary-imports/${id}/csv`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return Response.json({ error: "Could not reach the API" }, { status: 502 });
  }

  if (!upstream.ok) {
    if (upstream.status === 404) {
      // Either no such import, or the blob is gone. The detail page cannot tell
      // those apart from the list, so the message covers both.
      return Response.json(
        { error: "The file for this import is no longer available" },
        { status: 404 },
      );
    }
    if (upstream.status === 401) {
      return Response.json({ error: "Session expired" }, { status: 401 });
    }
    return Response.json({ error: "Could not download the file" }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": upstream.headers.get("content-disposition") ?? "attachment",
      // A CSV is a snapshot of an upload; caching one would only risk serving a
      // stale file against a changed import.
      "Cache-Control": "no-store",
    },
  });
}
