import { getSupabase, insertRow, selectById, selectWhere, deleteRow } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import type { EstimateAttachment } from "@/types";

/**
 * Files attached to an estimate (quotes, photos, spec sheets) — stored in
 * the private "estimate-attachments" Supabase Storage bucket, with a row
 * here for each one. Every read/write goes through the server-role client,
 * same access model as the rest of the app; a customer viewing the portal
 * never gets direct Storage access, only a short-lived signed URL minted
 * server-side (see getAttachmentDownloadUrl).
 */
const BUCKET = "estimate-attachments";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type AttachmentRow = Database["public"]["Tables"]["estimate_attachments"]["Row"];

function toAttachment(row: AttachmentRow): EstimateAttachment {
  return {
    id: row.id,
    estimateId: row.estimate_id,
    businessId: row.workspace_id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
  };
}

export async function getAttachmentsForEstimate(businessId: string, estimateId: string): Promise<EstimateAttachment[]> {
  const rows = await selectWhere(
    "estimate_attachments",
    { workspace_id: businessId, estimate_id: estimateId },
    { orderBy: "uploaded_at", ascending: false }
  );
  return rows.map(toAttachment);
}

export async function uploadEstimateAttachment(
  businessId: string,
  estimateId: string,
  file: { name: string; type: string; size: number; buffer: Buffer }
): Promise<EstimateAttachment> {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error("File is too large (10MB max).");
  }

  const storagePath = `${businessId}/${estimateId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await getSupabase()
    .storage.from(BUCKET)
    .upload(storagePath, file.buffer, { contentType: file.type || undefined, upsert: false });
  if (uploadError) {
    throw new Error(`Attachment upload failed: ${uploadError.message}`);
  }

  const row = await insertRow("estimate_attachments", {
    workspace_id: businessId,
    estimate_id: estimateId,
    file_name: file.name,
    storage_path: storagePath,
    content_type: file.type || null,
    size_bytes: file.size,
  });
  return toAttachment(row);
}

/** Removes every attachment's Storage object for an estimate being deleted — the DB rows themselves cascade-delete via the FK, but Storage objects don't, so this must run first or they'd be orphaned blobs. */
export async function deleteAttachmentsForEstimate(businessId: string, estimateId: string): Promise<void> {
  const attachments = await getAttachmentsForEstimate(businessId, estimateId);
  if (attachments.length === 0) return;
  await getSupabase()
    .storage.from(BUCKET)
    .remove(attachments.map((a) => a.storagePath));
}

/** Ownership-verified delete — removes both the Storage object and its row. No-ops if the attachment doesn't exist or belongs to a different business. */
export async function deleteEstimateAttachment(businessId: string, attachmentId: string): Promise<void> {
  const row = await selectById("estimate_attachments", attachmentId);
  if (!row || row.workspace_id !== businessId) return;

  await getSupabase().storage.from(BUCKET).remove([row.storage_path]);
  await deleteRow("estimate_attachments", attachmentId);
}

/** Short-lived signed URL for a customer-facing download — defaults to 10 minutes, long enough to click through from the portal. */
export async function getAttachmentDownloadUrl(storagePath: string, expiresInSeconds = 600): Promise<string | null> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
