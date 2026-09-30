"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getToken, uploadImport } from "@/lib/api";
import { isApiRequestError } from "@/lib/errors";

export interface UploadState {
  error?: string;
  success?: string;
  importId?: number;
}

/**
 * Uploads a CSV.
 *
 * The API validates the file on arrival — present, at most 2 MB, `.csv`
 * extension, and a content type a CSV plausibly arrives as (LLD §2.6) — and
 * answers a rejection with a 422 carrying the reason, which is surfaced
 * verbatim. The client-side checks here are only about picking a file at all;
 * anything about the file's contents is left to the server, so the rules have one
 * home rather than two that can drift.
 */
export async function uploadCsvAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const token = await getToken();
  if (!token) redirect("/login");

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload." };
  }

  try {
    const record = await uploadImport(token, file);

    // The upload only *queues* the work: the API returns a pending import and
    // the job runs behind it, so the dashboard's figures are not current yet.
    revalidatePath("/imports");
    revalidatePath("/dashboard");

    return {
      success: `${record.filename} uploaded. Processing in the background.`,
      importId: record.id,
    };
  } catch (error) {
    if (isApiRequestError(error) && error.isUnauthorized) redirect("/login");
    if (error instanceof Error) return { error: error.message };
    return { error: "The file could not be uploaded." };
  }
}
