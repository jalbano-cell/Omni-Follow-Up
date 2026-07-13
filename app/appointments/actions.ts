"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  approveAppointment,
  flagNoShow,
  flagCancelled,
  dismissRequestedAppointment,
  type ApproveAppointmentInput,
  type ApproveAppointmentResult,
  type FlagOutcomeResult,
} from "@/services/appointmentService";
import { getCurrentBusinessId } from "@/lib/session";
import { logAction } from "@/lib/logger";

/** Resolves the request's own host for building absolute links (unsubscribe, etc.) in outbound emails — see lib/url.ts. */
async function resolveAppHost(): Promise<string> {
  return (await headers()).get("host") ?? "localhost:3000";
}

function revalidateAppointment(appointment: { leadId: string | null }) {
  revalidatePath("/appointments");
  revalidatePath("/");
  if (appointment.leadId) revalidatePath(`/leads/${appointment.leadId}`);
}

export async function approveAppointmentAction(id: string, input: ApproveAppointmentInput): Promise<ApproveAppointmentResult> {
  const businessId = await getCurrentBusinessId();
  const appHost = await resolveAppHost();
  const result = await approveAppointment(businessId, id, input, appHost);
  logAction("appointment.approve", { appointmentId: id, ok: result.ok });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

export async function dismissAppointmentAction(id: string): Promise<FlagOutcomeResult> {
  const businessId = await getCurrentBusinessId();
  const result = await dismissRequestedAppointment(businessId, id);
  logAction("appointment.dismiss", { appointmentId: id });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

export async function flagNoShowAction(id: string): Promise<FlagOutcomeResult> {
  const businessId = await getCurrentBusinessId();
  const result = await flagNoShow(businessId, id);
  logAction("appointment.no-show", { appointmentId: id });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

export async function flagCancelledAction(id: string): Promise<FlagOutcomeResult> {
  const businessId = await getCurrentBusinessId();
  const result = await flagCancelled(businessId, id);
  logAction("appointment.cancel", { appointmentId: id });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}
