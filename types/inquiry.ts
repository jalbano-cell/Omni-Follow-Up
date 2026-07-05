export type InquiryStatus = "New Inquiry" | "Converted" | "Archived";

/** A website contact-form submission, captured via POST /api/intake. */
export interface Inquiry {
  id: string;
  businessId: string;
  /** Human-readable unique ID (e.g. "INQ-M3F2K1-A9C") shown in the UI, distinct from the Airtable record id. */
  inquiryId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  service: string;
  message: string;
  status: InquiryStatus;
  /** Always "Website" today — kept as a field rather than a literal for future intake sources (e.g. phone, referral). */
  source: string;
  submittedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** Set once "Convert to Estimate" creates an Estimate from this inquiry. */
  convertedEstimateId: string | null;
}

export type NewInquiryInput = Pick<Inquiry, "name" | "email" | "message"> &
  Partial<Pick<Inquiry, "phone" | "company" | "service" | "ipAddress" | "userAgent">>;

export type UpdateInquiryInput = Partial<Pick<Inquiry, "status" | "convertedEstimateId">>;
