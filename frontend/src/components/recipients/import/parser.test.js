import { describe, expect, test } from "vitest";
import { inferColumnMapping, parseRecipientCsv, validateRecipientRows } from "./parser";

describe("recipient import parser", () => {
  test("parses all rows, infers lead fields, and leaves a five-row preview decision to the caller", () => {
    const result = parseRecipientCsv("Email,Company,Phone\nAlice@Example.com,Acme,123\nbob@example.com,Beta,456");
    expect(result.headers).toEqual(["Email", "Company", "Phone"]);
    expect(result.rows).toHaveLength(2);
    expect(result.mapping).toMatchObject({ email: "Email", company: "Company", name: "Company", phone: "Phone" });
  });

  test("classifies valid, invalid, and duplicate emails with original row numbers", () => {
    const result = validateRecipientRows([
      { Email: "Alice@Example.com" },
      { Email: "invalid" },
      { Email: "alice@example.com | duplicate" },
    ], "Email");
    expect(result.validRows).toHaveLength(1);
    expect(result.invalidRows[0]).toMatchObject({ rowNumber: 3, reason: "Missing or Invalid Email Format" });
    expect(result.duplicateRows[0]).toMatchObject({ rowNumber: 4, email: "alice@example.com" });
  });

  test("recognizes supported social and contact columns", () => {
    expect(inferColumnMapping(["Contact Name", "Website", "LinkedIn", "X.com", "YouTube"])).toMatchObject({
      name: "Contact Name", website: "Website", linkedin: "LinkedIn", twitter: "X.com", youtube: "YouTube",
    });
  });
});
