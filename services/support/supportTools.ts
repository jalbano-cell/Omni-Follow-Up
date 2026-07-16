import type Anthropic from "@anthropic-ai/sdk";
import { getLeads, getAppointments, getFollowUps } from "@/services/db";
import { getEffectiveTimezone } from "@/services/business";
import { formatZonedDateTime } from "@/lib/date";
import type { Business } from "@/types";

/**
 * Read-only, workspace-scoped tools the support assistant can call to answer
 * questions about the logged-in business's own data ("how many new leads do I
 * have?", "what's my next appointment?").
 *
 * SECURITY BOUNDARY: the model never supplies a workspace id. Every executor
 * here is called with the `Business` resolved from the authenticated session
 * (app/api/support/chat/route.ts), and every underlying query is scoped by
 * `business.id`. There is no tool input that can widen the scope beyond the
 * caller's own workspace, so a prompt-injected or hallucinated tool call still
 * can only ever read the caller's own data. Tools are read-only — none of them
 * create, update, or delete anything.
 */

const LIST_LIMIT_DEFAULT = 5;
const LIST_LIMIT_MAX = 20;

function clampLimit(input: unknown): number {
  const n = typeof input === "number" ? Math.floor(input) : LIST_LIMIT_DEFAULT;
  if (!Number.isFinite(n) || n < 1) return LIST_LIMIT_DEFAULT;
  return Math.min(n, LIST_LIMIT_MAX);
}

/**
 * The tool set offered for a given business, gated by product mode the same way
 * the nav is: an "estimates_only" workspace has no Appointments surface, so it
 * never gets the appointments tool.
 */
export function supportTools(business: Business): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [
    {
      name: "get_workspace_summary",
      description:
        "Get a live at-a-glance summary of this workspace: how many new leads are waiting, pending appointment requests, and other open items. Use this for 'how am I doing', 'what needs my attention', or any count question.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "list_recent_leads",
      description:
        "List this workspace's most recent leads with their status, requested service, and AI priority. Use for 'show me my recent leads' or questions about specific recent inquiries.",
      input_schema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: `How many to return (1-${LIST_LIMIT_MAX}, default ${LIST_LIMIT_DEFAULT}).` },
        },
        additionalProperties: false,
      },
    },
  ];

  if (business.productMode !== "estimates_only") {
    tools.push({
      name: "list_upcoming_appointments",
      description:
        "List this workspace's upcoming appointments (approved and still-pending requests) with their date/time, customer, service, and status. Use for 'what's my next appointment' or scheduling questions.",
      input_schema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: `How many to return (1-${LIST_LIMIT_MAX}, default ${LIST_LIMIT_DEFAULT}).` },
        },
        additionalProperties: false,
      },
    });
  }

  return tools;
}

/**
 * Execute a tool call against the caller's own workspace. Returns a compact
 * JSON string for the model's tool_result. Never throws — an unknown tool or a
 * transient read failure comes back as a tagged error string so the loop can
 * continue and the model can tell the user it couldn't look that up.
 */
export async function runSupportTool(business: Business, name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "get_workspace_summary":
        return JSON.stringify(await workspaceSummary(business));
      case "list_recent_leads":
        return JSON.stringify(await recentLeads(business, clampLimit(input.limit)));
      case "list_upcoming_appointments":
        if (business.productMode === "estimates_only") {
          return JSON.stringify({ error: "Appointments are not enabled for this workspace." });
        }
        return JSON.stringify(await upcomingAppointments(business, clampLimit(input.limit)));
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch {
    return JSON.stringify({ error: "Could not read that data right now." });
  }
}

async function workspaceSummary(business: Business) {
  const leads = await getLeads(business.id);
  const summary: Record<string, number> = {
    newLeads: leads.filter((lead) => lead.status === "New Inquiry").length,
  };

  if (business.productMode !== "estimates_only") {
    const appointments = await getAppointments(business.id);
    const now = Date.now();
    summary.pendingAppointmentRequests = appointments.filter((a) => a.status === "requested").length;
    summary.upcomingAppointments = appointments.filter(
      (a) => a.status === "approved" && Date.parse(a.scheduledStart) >= now
    ).length;
  }

  if (business.productMode !== "appointments_only") {
    const followUps = await getFollowUps(business.id);
    summary.followUpsInQueue = followUps.filter((f) => f.status === "Pending").length;
  }

  return summary;
}

async function recentLeads(business: Business, limit: number) {
  const leads = await getLeads(business.id);
  return {
    leads: leads.slice(0, limit).map((lead) => ({
      name: lead.name,
      status: lead.status,
      requestedService: lead.requestedService || null,
      priority: lead.aiPriority,
      receivedAt: lead.createdTime,
    })),
  };
}

async function upcomingAppointments(business: Business, limit: number) {
  const tz = getEffectiveTimezone(business);
  const now = Date.now();
  const appointments = await getAppointments(business.id)
    .then((rows) =>
      rows
        .filter((a) => (a.status === "approved" || a.status === "requested") && Date.parse(a.scheduledStart) >= now)
        .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart))
    );

  return {
    appointments: appointments.slice(0, limit).map((appt) => ({
      customer: appt.customerName,
      service: appt.serviceType || null,
      status: appt.status,
      when: formatZonedDateTime(new Date(appt.scheduledStart), tz),
    })),
  };
}
