export const EMPTY_COLUMN_MAPPING = {
  email: "", name: "", company: "", phone: "", website: "",
  facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "", tags: "",
};

export function inferColumnMapping(columns) {
  const mapping = { ...EMPTY_COLUMN_MAPPING };
  columns.forEach((column) => {
    const lower = column.toLowerCase();
    if (lower.includes("email")) mapping.email = column;
    else if (lower.includes("company") || lower.includes("organization")) {
      mapping.company = column;
      if (!mapping.name) mapping.name = column;
    } else if (lower.includes("name") || lower.includes("contact")) mapping.name = column;
    else if (lower.includes("phone") || lower.includes("mobile")) mapping.phone = column;
    else if (lower.includes("website") || lower.includes("site")) mapping.website = column;
    else if (lower.includes("facebook")) mapping.facebook = column;
    else if (lower.includes("instagram")) mapping.instagram = column;
    else if (lower.includes("linkedin")) mapping.linkedin = column;
    else if (lower.includes("twitter") || lower.includes("x.com")) mapping.twitter = column;
    else if (lower.includes("youtube")) mapping.youtube = column;
  });
  return mapping;
}

export function parseRecipientCsv(text) {
  const lines = text.split(/\r\n|\n/).filter((line) => line.trim());
  if (!lines.length) return { headers: [], rows: [], mapping: { ...EMPTY_COLUMN_MAPPING } };
  const headers = lines[0].split(",").map((column) => column.trim().replace(/^["']|["']$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim().replace(/^["']|["']$/g, ""));
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
  return { headers, rows, mapping: inferColumnMapping(headers) };
}

export function validateRecipientRows(rows, emailColumn) {
  const validRows = [];
  const invalidRows = [];
  const duplicateRows = [];
  const seen = new Set();
  rows.forEach((row, index) => {
    const rawEmail = row[emailColumn]?.trim();
    const match = rawEmail?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = match ? match[0].toLowerCase() : "";
    if (!email) invalidRows.push({ rowNumber: index + 2, email: rawEmail || "No Email Provided", reason: "Missing or Invalid Email Format" });
    else if (seen.has(email)) duplicateRows.push({ rowNumber: index + 2, email, reason: "Duplicate Email in File" });
    else { seen.add(email); validRows.push(row); }
  });
  return { validRows, invalidRows, duplicateRows };
}
