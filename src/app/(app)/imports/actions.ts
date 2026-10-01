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
 * The API is the authority on what is acceptable: present, at most 2 MB, `.csv`
 * extension, a content type a CSV plausibly arrives as (LLD §2.6), and within
 * the uploader's 60 MB daily allowance. A rejection comes back as a 422 carrying
 * the reason and is surfaced verbatim.
 *
 * The browser also refuses an obviously wrong file before it is sent — see
 * `rejectionFor` in the view — but only so the answer arrives before the upload
 * rather than after it. That check is not a second home for the rules: a request
 * that skips it, and any change to the model's limits, is still caught here and
 * on the server.
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
