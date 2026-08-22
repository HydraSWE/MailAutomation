import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { makeBlock, renderBlock } from "./model";

describe("email builder model", () => {
  test("creates blocks with the persisted lowercase schema", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("block-id");
    expect(makeBlock("Heading")).toEqual({ id: "block-id", type: "heading", data: { text: "Hello {name} - Special Announcement for {company}", color: "#1e293b" } });
  });

  test("renders block content without changing its data", () => {
    const block = { id: "1", type: "button", data: { text: "Open", url: "https://example.com", background: "#4f46e5" } };
    render(renderBlock(block));
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "https://example.com");
    expect(block.data.background).toBe("#4f46e5");
  });
});
