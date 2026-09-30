"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartIcon, UploadIcon, UsersIcon } from "@/components/icons";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: ChartIcon },
  { href: "/employees", label: "Employees", icon: UsersIcon },
  { href: "/imports", label: "Imports", icon: UploadIcon },
] as const;

/**
 * Sidebar navigation.
 *
 * A client component because the active item is read from the current pathname.
 * There is no authorization to reflect here: the API has a single HR persona
 * (ARCHITECTURE §7.4), so every signed-in user sees the same set of links.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Main">
      {LINKS.map(({ href, label, icon: Icon }) => {
        // Exact match for the root of a section, prefix match for the rest, so
        // /employees/42 keeps "Employees" lit.
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
            }`}
          >
            <Icon className="size-4.5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
