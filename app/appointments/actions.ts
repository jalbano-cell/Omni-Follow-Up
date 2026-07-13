"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  approveAppointment,
  flagNoShow,
  flagCancelled,
  dismissRequestedAppointment,
  approveReminder,
  editReminderMessage,
  skipReminder,
  sendReminder,
  type ApproveAppointmentInput,
  type ApproveAppointmentResult,
  type FlagOutcomeResult,
  type ReminderActionResult,
} from "@/services/appointmentService";
import { requireAppointmentsEnabled } from "@/lib/session";
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
  const businessId = (await requireAppointmentsEnabled()).id;
  const appHost = await resolveAppHost();
  const result = await approveAppointment(businessId, id, input, appHost);
  logAction("appointment.approve", { appointmentId: id, ok: result.ok });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

export async function dismissAppointmentAction(id: string): Promise<FlagOutcomeResult> {
  const businessId = (await requireAppointmentsEnabled()).id;
  const result = await dismissRequestedAppointment(businessId, id);
  logAction("appointment.dismiss", { appointmentId: id });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

export async function flagNoShowAction(id: string): Promise<FlagOutcomeResult> {
  const businessId = (await requireAppointmentsEnabled()).id;
  const result = await flagNoShow(businessId, id);
  logAction("appointment.no-show", { appointmentId: id });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

export async function flagCancelledAction(id: string): Promise<FlagOutcomeResult> {
  const businessId = (await requireAppointmentsEnabled()).id;
  const result = await flagCancelled(businessId, id);
  logAction("appointment.cancel", { appointmentId: id });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

export async function approveReminderAction(id: string): Promise<ReminderActionResult> {
  const businessId = (await requireAppointmentsEnabled()).id;
  const result = await approveReminder(businessId, id);
  logAction("appointment.reminder-approve", { appointmentId: id, ok: result.ok });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

export async function editReminderMessageAction(id: string, message: string): Promise<ReminderActionResult> {
  const businessId = (await requireAppointmentsEnabled()).id;
  const result = await editReminderMessage(businessId, id, message);
  logAction("appointment.reminder-edit", { appointmentId: id, ok: result.ok });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

export async function skipReminderAction(id: string): Promise<ReminderActionResult> {
  const businessId = (await requireAppointmentsEnabled()).id;
  const result = await skipReminder(businessId, id);
  logAction("appointment.reminder-skip", { appointmentId: id, ok: result.ok });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}

/** The only path that actually emails the reminder — see services/appointmentService.ts's sendReminder. */
export async function sendReminderAction(id: string): Promise<ReminderActionResult> {
  const businessId = (await requireAppointmentsEnabled()).id;
  const appHost = await resolveAppHost();
  const result = await sendReminder(businessId, id, appHost);
  logAction("appointment.reminder-send", { appointmentId: id, ok: result.ok });
  if (result.ok) revalidateAppointment(result.appointment);
  else revalidatePath("/appointments");
  return result;
}
