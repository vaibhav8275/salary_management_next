import { request, requestData } from "./client";
import type {
  PaginationMeta,
  SalaryImport,
  SalaryImportError,
  SalaryImportErrorPage,
  SalaryImportErrorSummaryRow,
} from "@/lib/types";

// --- Imports ----------------------------------------------------------------

export async function listImports(token: string): Promise<SalaryImport[]> {
  const { data } = await requestData<SalaryImport[]>("/api/v1/salary-imports", { token });
  return data;
}

export async function getImport(
  token: string,
  id: string | number,
): Promise<SalaryImport> {
  const { data } = await requestData<SalaryImport>(`/api/v1/salary-imports/${id}`, { token });
  return data;
}

/**
 * A page of the rows behind an import's `failed_records`, plus the roll-up of
 * every row for that import.
 *
 * Uses `request` rather than `requestData` because `summary` is a third key in
 * the envelope and the shared unwrapper keeps only `data` and `meta`. Widening
 * that unwrapper would have touched every other paginated call for one caller.
 */
export async function listImportErrors(
  token: string,
  id: string | number,
  page: number,
): Promise<SalaryImportErrorPage> {
  const body = await request<{
    data: SalaryImportError[];
    meta: PaginationMeta;
    summary: SalaryImportErrorSummaryRow[];
  }>(`/api/v1/salary-imports/${id}/errors?page=${page}`, { token });

  return { errors: body.data, meta: body.meta, summary: body.summary };
}

/**
 * Uploads a CSV. Multipart, because Rails reads `params[:file]` as an
 * `ActionDispatch::Http::UploadedFile` and the model validates the attachment's
 * filename extension, byte size and content type.
 */
export async function uploadImport(
  token: string,
  file: File,
): Promise<SalaryImport> {
  const form = new FormData();
  form.append("file", file);

  const { data } = await requestData<SalaryImport>("/api/v1/salary-imports", {
    method: "POST",
    token,
    body: form,
  });
  return data;
}