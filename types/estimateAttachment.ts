export interface EstimateAttachment {
  id: string;
  estimateId: string;
  businessId: string;
  fileName: string;
  /** Path within the private "estimate-attachments" Storage bucket — never exposed directly, only via a short-lived signed URL. */
  storagePath: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
}
