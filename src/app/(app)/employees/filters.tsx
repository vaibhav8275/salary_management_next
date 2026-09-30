"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchIcon } from "@/components/icons";

/**
 * Search and filter controls.
 *
 * Filter state lives in the URL rather than in component state, because the list
 * is server-rendered from the query string — a client-side filter would need the
 * whole dataset in memory to work, and this page paginates 10,000 employees. The
 * URL is also what makes a filtered view shareable and survives a refresh.
 */
export function EmployeeFilterForm({
  departments,
  countries,
  jobTitles,
}: {
  departments: string[];
  countries: string[];
  jobTitles: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // `useSearchParams` is the source of truth for the selects; the text box keeps
  // local state so typing stays responsive, and is pushed to the URL on a
  // debounce.
  const urlSearch = searchParams.get("search") ?? "";
  const [term, setTerm] = useState(urlSearch);
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch);

  // Follow the URL back into the box, so the back button and "Clear" work.
  //
  // This is adjusted during render rather than in an effect: the URL is a prop
  // changing behind the component, and writing to state from an effect body
  // would render the stale term once more first. React restarts the render
  // immediately, so the box never shows the old value.
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch);
    setTerm(urlSearch);
  }

  useEffect(() => {
    // The box already matches the URL — on first render, and again right after
    // the adjustment above — so there is nothing to push. Without this the page
    // would fire a request as it mounts.
    if (term === urlSearch) return;

    const timer = setTimeout(() => {
      setQuery(router, pathname, searchParams, { search: term, page: null });
    }, 350);

    return () => clearTimeout(timer);
  }, [term, urlSearch, router, pathname, searchParams]);

  const hasFilters = Boolean(
    urlSearch ||
      searchParams.get("department") ||
      searchParams.get("country") ||
      searchParams.get("job_title"),
  );

  return (
    <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="search" className="field-label">
          Search
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input
            id="search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Name, email, job title…"
            className="field pl-9"
          />
        </div>
      </div>

      <div className="w-full sm:w-52">
        <label htmlFor="department" className="field-label">
          Department
        </label>
        <select
          id="department"
          value={searchParams.get("department") ?? ""}
          onChange={(event) =>
            setQuery(router, pathname, searchParams, {
              department: event.target.value,
              page: null,
            })
          }
          className="field"
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full sm:w-52">
        <label htmlFor="country" className="field-label">
          Country
        </label>
        <select
          id="country"
          value={searchParams.get("country") ?? ""}
          onChange={(event) =>
            setQuery(router, pathname, searchParams, {
              country: event.target.value,
              page: null,
            })
          }
          className="field"
        >
          <option value="">All countries</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full sm:w-52">
        <label htmlFor="job_title" className="field-label">
          Job title
        </label>
        <select
          id="job_title"
          value={searchParams.get("job_title") ?? ""}
          onChange={(event) =>
            setQuery(router, pathname, searchParams, {
              job_title: event.target.value,
              page: null,
            })
          }
          className="field"
        >
          <option value="">All job titles</option>
          {jobTitles.map((jobTitle) => (
            <option key={jobTitle} value={jobTitle}>
              {jobTitle}
            </option>
          ))}
        </select>
      </div>

      {hasFilters ? (
        <button type="button" onClick={() => router.replace(pathname)} className="btn btn-ghost">
          Clear
        </button>
      ) : null}
    </div>
  );
}

/**
 * Writes a filter change into the query string.
 *
 * Empty values delete their key rather than writing `?department=`, so the URL
 * only ever carries filters that are actually set. `page: null` drops the page
 * on any filter change: staying on page 7 of a search that now matches two rows
 * would show an empty table.
 */
function setQuery(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  current: URLSearchParams,
  changes: Record<string, string | null>,
) {
  const params = new URLSearchParams(current);

  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else if (value) params.set(key, value);
  }

  const query = params.toString();
  router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
}
