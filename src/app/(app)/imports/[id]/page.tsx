import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getImport, listImportErrors } from "@/lib/api";
import { isApiRequestError } from "@/lib/errors";
import { requireAuth } from "@/lib/session";
import type { SalaryImport, SalaryImportErrorPage } from "@/lib/types";
import { ImportDetailView } from "./import-detail-view";

export const metadata: Metadata = { title: "Import detail" };

export default async function ImportDetailPage(props: PageProps<"/imports/[id]">) {
  const { id } = await props.params;
  const { searchParams } = props;

  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  // The API treats a missing or invalid page as the first one, and this keeps the
  // two in step: a URL of ?page=abc renders page 1 without a redirect hop.
  const parsed = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const token = await requireAuth();

  let salaryImport: SalaryImport;
  let failures: SalaryImportErrorPage;

  try {
    // Independent reads, so they go out together rather than as a waterfall.
    [ salaryImport, failures ] = await Promise.all([
      getImport(token, id),
      listImportErrors(token, id, page),
    ]);
  } catch (error) {
    if (isApiRequestError(error) && error.isNotFound) notFound();
    if (isApiRequestError(error) && error.isUnauthorized) redirect("/login");
    throw error;
  }

  /*
   * A page past the end returns no rows, which this page would otherwise render
   * as "no rows were rejected" — the wrong answer for a stale or hand-edited
   * link. Guarded on total_pages >= 1 so an import that has not failed anything
   * yet stays put instead of being redirected to page 0.
   */
  if (failures.meta.total_pages >= 1 && page > failures.meta.total_pages) {
    redirect(`/imports/${id}?page=${failures.meta.total_pages}`);
  }

  return <ImportDetailView salaryImport={salaryImport} failures={failures} />;
}
