/**
 * Minimal CSV parser — handles quoted fields (embedded commas/newlines,
 * escaped "" for a literal quote) without pulling in a dependency for
 * something this small. Not a full RFC 4180 implementation, but covers what
 * a spreadsheet export actually produces.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export interface CsvLeadRow {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  service?: string;
  message: string;
}

/** Maps parsed rows (first row = header) into lead-shaped objects by header name — case-insensitive, column order doesn't matter. Rows missing a name or email are dropped. */
export function csvRowsToLeads(rows: string[][]): CsvLeadRow[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = (name: string) => header.indexOf(name);

  const nameIdx = colIndex("name");
  const emailIdx = colIndex("email");
  const phoneIdx = colIndex("phone");
  const companyIdx = colIndex("company");
  const serviceIdx = colIndex("service");
  const messageIdx = colIndex("message");

  return rows
    .slice(1)
    .map((row) => ({
      name: (nameIdx >= 0 ? row[nameIdx] : "")?.trim() ?? "",
      email: (emailIdx >= 0 ? row[emailIdx] : "")?.trim() ?? "",
      phone: phoneIdx >= 0 ? row[phoneIdx]?.trim() : undefined,
      company: companyIdx >= 0 ? row[companyIdx]?.trim() : undefined,
      service: serviceIdx >= 0 ? row[serviceIdx]?.trim() : undefined,
      message: (messageIdx >= 0 ? row[messageIdx] : "")?.trim() ?? "",
    }))
    .filter((lead) => lead.name && lead.email);
}
