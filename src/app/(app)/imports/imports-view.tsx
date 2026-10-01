"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, startTransition } from "react";
import { Card, CardHeader, EmptyState, ErrorNote, PageHeader, StatusBadge } from "@/components/ui";
import { DownloadIcon, FileIcon, UploadIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { IN_FLIGHT_STATUSES, type SalaryImport } from "@/lib/types";
import { uploadCsvAction, type UploadState } from "./actions";

/** How often to ask the API about an import that is still running. */
const POLL_INTERVAL_MS = 2000;

/**
 * The per-file ceiling, in bytes. Kept in step with `SalaryImport::MAX_FILE_SIZE`
 * on the Rails side, which is the authority: this check exists so a rejected file
 * is refused before it is uploaded rather than after, not so the rule lives here.
 */
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * The reasons a file is refused without being sent anywhere.
 *
 * The wording is the same as the model's, so a file caught here and the same file
 * caught by Rails read identically to the user — which is the point of stating
 * them once per layer rather than inventing a second voice.
 *
 * Both checks are redundant with the server by design. Without them a 5 MB file
 * would reach Next, be refused against its Server Action body limit, and surface
 * as a minified React error instead of a sentence anyone can act on.
 */
function rejectionFor(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "Only CSV files are allowed.";

  if (file.size > MAX_FILE_SIZE_BYTES) return "File size must be 2 MB or smaller.";

  return null;
}

export function ImportsView({ initial }: { initial: SalaryImport[] }) {
  // `key` on the child resets this subtree when the server sends a different
  // list, so a newly queued import appears without syncing props into state in
  // an effect. Inside, the list is owned locally because polling patches rows in
  // place, faster than a round trip.
  return <ImportsBody key={initial[0]?.id ?? "empty"} initial={initial} />;
}

function ImportsBody({ initial }: { initial: SalaryImport[] }) {
  const router = useRouter();
  const [imports, setImports] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable, so it can sit in the upload form's effect dependencies without
  // re-running the refresh on every render.
  const refresh = useCallback(() => router.refresh(), [router]);

  /**
   * Polls while anything is still in flight.
   *
   * The loop is a `setTimeout` chained off each response rather than
   * `setInterval`, so a slow response cannot stack up overlapping requests, and
   * the whole thing is cleaned up on unmount. Polling stops as soon as every
   * import has settled — there is no point asking about a `completed` import.
   */
  useEffect(() => {
    const running = imports.filter((record) => IN_FLIGHT_STATUSES.includes(record.status));
    if (running.length === 0) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const responses = await Promise.all(
          running.map((record) =>
            fetch(`/api/imports/${record.id}`, { cache: "no-store" })
              .then((response) => (response.ok ? response.json() : null))
              .catch(() => null),
          ),
        );

        if (cancelled) return;

        let changed = false;
        const next = imports.map((record) => {
          const payload = responses.find((entry) => entry?.data?.id === record.id);
          if (!payload?.data) return record;
          if (
            payload.data.status !== record.status ||
            payload.data.processed_records !== record.processed_records
          ) {
            changed = true;
          }
          return payload.data as SalaryImport;
        });

        if (changed) {
          setImports(next);
          // Refresh the server components too, so the dashboard and the employee
          // figures reflect the import that just finished.
          router.refresh();
        }
      } finally {
        if (!cancelled) timer.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    timer.current = setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [imports, router]);

  return (
    <>
      <PageHeader
        title="Salary imports"
        description="Upload a CSV of salary changes. Processing runs in the background."
      />

      <div className="space-y-4">
        <UploadCard onUploaded={refresh} />

        <Card>
          <CardHeader
            title="Upload history"
            description={
              imports.some((record) => IN_FLIGHT_STATUSES.includes(record.status))
                ? "Refreshing while imports are running"
                : undefined
            }
          />
          {imports.length === 0 ? (
            <EmptyState
              icon={<FileIcon className="size-5" />}
              title="No imports yet"
              description="Upload a CSV to apply salary changes in bulk."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="px-5 py-2.5 text-xs font-medium tracking-wide text-muted uppercase">
                      File
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-xs font-medium tracking-wide text-muted uppercase">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right text-xs font-medium tracking-wide text-muted uppercase">
                      Total
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right text-xs font-medium tracking-wide text-muted uppercase">
                      Processed
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right text-xs font-medium tracking-wide text-muted uppercase">
                      Failed
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-xs font-medium tracking-wide text-muted uppercase">
                      Uploaded by
                    </th>
                    <th scope="col" className="pr-5 py-2.5 text-right text-xs font-medium tracking-wide text-muted uppercase">
                      Uploaded
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((record) => (
                    <tr key={record.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-muted">
                            <FileIcon className="size-3.5" />
                          </span>
                          <span className="truncate font-medium text-ink">{record.filename}</span>
                          <DownloadLink id={record.id} filename={record.filename} />
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="tabular px-5 py-3 text-right text-ink-soft">
                        {record.total_records.toLocaleString("en-US")}
                      </td>
                      <td className="tabular px-5 py-3 text-right text-ink-soft">
                        {record.processed_records.toLocaleString("en-US")}
                      </td>
                      <td className="tabular px-5 py-3 text-right">
                        <FailedCount record={record} />
                      </td>
                      <td className="px-5 py-3 text-xs text-ink-soft">
                        {record.created_by ?? "—"}
                      </td>
                      <td className="tabular pr-5 py-3 text-right text-xs text-muted">
                        {formatDateTime(record.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/**
 * Downloads the CSV that was uploaded.
 *
 * A plain anchor rather than a fetch: the download is a navigation, so the
 * browser streams the response straight to disk, and a blob-then-object-URL dance
 * would only add a step to hold a few MB in memory. It also means the link
 * behaves like a link — middle-click, "save as", and a status URL.
 *
 * Written as a text link rather than a bare icon because an icon alone did not
 * read as a link at a glance: it sits after a long filename in a muted grey and
 * is easy to take for part of the row. This matches the "View salary" row action
 * on the employees table.
 *
 * The href points at the BFF rather than Rails directly, because the token is in
 * an httpOnly cookie that JavaScript cannot read. The filename comes from the
 * response's Content-Disposition, so the empty `download` attribute is correct.
 */
function DownloadLink({ id, filename }: { id: number; filename: string }) {
  return (
    <a
      href={`/api/imports/${id}/csv`}
      download
      title={`Download ${filename}`}
      // The visible text is the same for every row, so the accessible name
      // repeats the filename — while still starting with the visible words, which
      // is what WCAG's label-in-name rule requires.
      aria-label={`Download ${filename}`}
      className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap text-accent hover:underline"
    >
      <DownloadIcon className="size-3.5" />
      Download
    </a>
  );
}

/**
 * The failure count, linking to the rows behind it.
 *
 * A zero renders as a dash with nothing to click, so the list does not offer a
 * destination for an import that failed nothing.
 */
function FailedCount({ record }: { record: SalaryImport }) {
  if (record.failed_records === 0) {
    return <span className="text-muted">—</span>;
  }

  return (
    <Link
      href={`/imports/${record.id}`}
      className="rounded font-medium text-critical underline decoration-critical/30 underline-offset-2 hover:decoration-critical"
    >
      {record.failed_records.toLocaleString("en-US")}
    </Link>
  );
}

function UploadCard({ onUploaded }: { onUploaded: () => void }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadCsvAction, {});

  // The picked file is dropped by remounting rather than by clearing state in an
  // effect: the successful upload's `importId` is unique, so it is a natural key
  // for the inputs inside. The refresh itself is an effect, below.
  return (
    <UploadForm
      key={state.importId ?? "form"}
      state={state}
      action={action}
      pending={pending}
      onUploaded={onUploaded}
    />
  );
}

function UploadForm({
  state,
  action,
  pending,
  onUploaded,
}: {
  state: UploadState;
  action: (formData: FormData) => void;
  pending: boolean;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  // A refusal the browser made itself, held here because the server action was
  // never dispatched and so has no state to put it in. `clientError ?? state.error`
  // reads it first: it is the more recent of the two.
  const [clientError, setClientError] = useState<string | null>(null);

  const rejection = clientError ?? state.error;

  // `router.refresh()` is a call out to Next rather than a state update, so the
  // effect is its right home. It does not set the picked file — the `key` on
  // this component is what clears that, by remounting with `file` back to null.
  useEffect(() => {
    if (state.success) onUploaded();
  }, [state.success, onUploaded]);

  return (
    <Card>
      <CardHeader
        title="Upload a CSV"
        description="Required columns: employee_id, effective_date, base_salary, bonus, allowance"
      />

      {/*
        The action is dispatched by hand rather than through `<form action>`.
        React 19 clears a form's fields once an action settles, and a file input
        cannot be made controlled — so a rejected upload would silently drop the
        user's selection and make a retry ask for the same file again. Holding
        the File in state and building the FormData here keeps it.

        Dispatching by hand means React no longer wraps the call in a transition,
        so it is wrapped here: without it `useActionState`'s pending flag never
        updates and the button never shows "Uploading…".
      */}
      <form
        className="space-y-3 px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!file) return;
          const refused = rejectionFor(file);
          if (refused) {
            setClientError(refused);
            return;
          }
          setClientError(null);
          const form = new FormData();
          form.append("file", file);
          startTransition(() => {
            action(form);
          });
        }}
      >
        {rejection ? <ErrorNote message={rejection} /> : null}
        {state.success ? (
          <p className="rounded-lg border border-positive/20 bg-positive-soft px-3.5 py-2.5 text-sm text-positive">
            {state.success}
          </p>
        ) : null}

        <div>
          <label htmlFor="file" className="field-label">
            CSV file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setClientError(null);
            }}
            className="field file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-ink-soft"
          />
        </div>

        <p className="text-xs text-muted">
          Up to 2 MB per file, with a <code className="font-mono">.csv</code> extension. 60 MB per
          day.
        </p>

        <UploadButton disabled={!file} pending={pending} />
      </form>
    </Card>
  );
}

function UploadButton({ disabled, pending }: { disabled: boolean; pending: boolean }) {
  return (
    <button type="submit" disabled={pending || disabled} className="btn btn-primary w-full">
      {pending ? (
        "Uploading…"
      ) : (
        <>
          <UploadIcon className="size-4" />
          Upload
        </>
      )}
    </button>
  );
}
