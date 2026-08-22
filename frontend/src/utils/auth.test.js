import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTokens,
  getActiveOrganization,
  setActiveOrganization,
  setUser,
} from "./auth";

describe("active organization", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores the owner's selected tenant", () => {
    setUser({ email: "owner@example.test", role: "owner" });
    setActiveOrganization({ id: 7, name: "Example tenant" });
    expect(getActiveOrganization()).toEqual({ id: 7, name: "Example tenant" });
  });

  it("clears tenant context for non-owner users and logout", () => {
    setActiveOrganization({ id: 7, name: "Example tenant" });
    setUser({ email: "admin@example.test", role: "admin" });
    expect(getActiveOrganization()).toBeNull();
    setActiveOrganization({ id: 7, name: "Example tenant" });
    clearTokens();
    expect(getActiveOrganization()).toBeNull();
  });
});
