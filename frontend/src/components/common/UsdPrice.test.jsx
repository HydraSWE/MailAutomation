import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import UsdPrice, { formatUsd, usdFromBdt } from "./UsdPrice";

describe("USD price display", () => {
  test("converts BDT with the configured platform rate", () => {
    expect(usdFromBdt(2500, {
      usd_price_display_enabled: true,
      usd_bdt_rate: "122.0000",
    })).toBe("20.49");
  });

  test("returns no equivalent when the owner disables it", () => {
    expect(usdFromBdt(2500, {
      usd_price_display_enabled: false,
      usd_bdt_rate: "122.0000",
    })).toBeNull();
  });

  test("renders a consistent USD badge", () => {
    render(<UsdPrice value="20.49" />);
    expect(screen.getByText("$20.49 USD")).toBeInTheDocument();
    expect(formatUsd("4000.5")).toBe("$4,000.50 USD");
  });
});
