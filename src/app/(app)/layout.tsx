import { getSessionUser, requireAuth } from "@/lib/session";
import { signOutAction } from "@/app/login/actions";
import { AppNav } from "./app-nav";

/**
 * The signed-in shell: a fixed sidebar and a header carrying the account.
 *
 * `requireAuth()` is called only as a guard. A missing token means the cookie
 * was dropped (it expired, or was cleared) and there is nothing to render, so
 * this redirects rather than showing an empty shell that would fail on every
 * child fetch. `proxy.ts` normally catches this first; the check here is what
 * makes the shell correct on its own, since a page is not required to go
 * through proxy.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">Salary</p>
            <p className="truncate text-xs text-muted">Management</p>
          </div>
        </div>

        <AppNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          {/* The sidebar is hidden below `lg`, so the product mark comes here
              instead — otherwise the mobile header has no way home. */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <Logo />
            <span className="text-sm font-semibold text-ink">Salary Management</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-ink">{user?.email}</p>
              <p className="text-[11px] text-muted">HR Manager</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="btn btn-secondary"
                title="Sign out"
                aria-label="Sign out"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 4.5h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-2" />
                  <path d="M10 8.5L6 12l4 3.5" />
                  <path d="M6 12h9" />
                </svg>
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </svg>
    </span>
  );
}
