/**
 * Literal {{merge_variable}} substitution — no conditionals, no loops, on
 * purpose. Templates are edited by business owners, not developers, so the
 * syntax stays as simple as possible. An unknown variable is left in place
 * rather than silently dropped, so a typo in a template is visible in the
 * sent email instead of producing an empty gap.
 */
export function renderTemplate(
  template: { subject: string; body: string },
  vars: Record<string, string>
): { subject: string; body: string } {
  const substitute = (text: string) =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);

  return { subject: substitute(template.subject), body: substitute(template.body) };
}

/** Sample data for the Settings page's live preview — pure/no I/O, safe to import from a client component. Never actually sent. */
export function sampleMergeVariables(businessName: string): Record<string, string> {
  return {
    customer_name: "Jamie Chen",
    company: "Chen Renovations",
    service: "Kitchen Remodel",
    estimate_number: "EST-M3F2K1-A9C",
    estimate_value: "$4,200",
    days_since: "3",
    business_name: businessName,
  };
}
