"use client";

import { useEffect } from "react";
import { ErrorNote } from "@/components/ui";

/**
 * A route-level error boundary.
 *
 * Next.js renders this instead of the page when a server component throws, and
 * it is a client component because it needs `reset` to re-render the failed
 * segment. The Rails server being down is the case worth designing for: the
 * message from `ApiUnavailableError` says so plainly, and "Try again" works
 * without a full page reload.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what correlates this with the server log.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md space-y-4">
        <ErrorNote
          message={
            error.message ||
            "Something went wrong loading this page. The salary API may be unavailable."
          }
        />
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <a href="/dashboard" className="btn btn-secondary">
            Go to dashboard
          </a>
        </div>
        {error.digest ? (
          <p className="text-xs text-faint">Reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
