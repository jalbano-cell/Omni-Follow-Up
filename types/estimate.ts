export type EstimateStatus =
  | "Sent"
  | "Follow-up 1"
  | "Follow-up 2"
  | "Booked"
  | "Lost";

export interface Estimate {
  id: string;
  customerName: string;
  customerEmail: string;
  businessName: string;
  serviceType: string;
  estimateValue: number;
  dateSent: string;
  status: EstimateStatus;
  nextFollowUpDate: string | null;
  lastContactDate: string | null;
  notes: string;
}

export type NewEstimateInput = Pick<
  Estimate,
  "customerName" | "customerEmail" | "serviceType" | "estimateValue" | "dateSent"
> &
  Partial<Pick<Estimate, "businessName" | "status" | "nextFollowUpDate" | "lastContactDate" | "notes">>;

export type UpdateEstimateInput = Partial<Omit<Estimate, "id">>;
