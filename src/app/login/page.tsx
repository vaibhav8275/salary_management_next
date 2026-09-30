import type { Metadata } from "next";
import { getToken } from "@/lib/api";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The only unauthenticated page.
 *
 * `proxy.ts` sends anyone with a session cookie away from here, but the check
 * is repeated server-side so the page is correct on its own: a valid cookie must
 * not render a second sign-in form.
 */
export default async function LoginPage() {
  const token = await getToken();
  if (token) {
    // A plain redirect rather than `redirect()` from the client boundary — this
    // is a Server Component, so the navigation happens before any HTML ships.
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span
            className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-white"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
            </svg>
          </span>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Salary Management
          </h1>
          <p className="mt-1 text-sm text-muted">Sign in to continue</p>
        </div>

        <div className="card p-6">
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-faint">
          This workspace is for HR Managers. Accounts are created by an
          administrator — there is no self sign-up.
        </p>
      </div>
    </div>
  );
}
